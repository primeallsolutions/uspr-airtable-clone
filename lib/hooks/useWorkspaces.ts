import { useState, useCallback } from 'react';
import { WorkspaceService } from '../services/workspace-service';
import type { WorkspaceRecord, CreateWorkspaceFormData } from '../types/dashboard';
import { supabase } from '../supabaseClient';
import type { RoleType } from '../services/membership-service';

const mergeWorkspacesById = (primary: WorkspaceRecord[], secondary: WorkspaceRecord[]) => {
  const byId = new Map<string, WorkspaceRecord>();
  [...primary, ...secondary].forEach((ws) => {
    if (ws?.id) byId.set(ws.id, ws);
  });
  return Array.from(byId.values());
};

const fetchSharedWorkspaces = async (userId: string | undefined): Promise<WorkspaceRecord[]> => {
  if (!userId) return [];

  try {
    // Get workspace IDs where user is a member (with role)
    const { data: memberships, error: mErr } = await supabase
      .from('workspace_memberships')
      .select('workspace_id, role')
      .eq('user_id', userId);
      
    if (mErr) {
      console.error('Error fetching memberships:', mErr);
      return [];
    }
    
    const ids = (memberships || []).map((m: { workspace_id: string }) => m.workspace_id);
    if (ids.length === 0) return [];

    const roleMap = new Map<string, RoleType>();
    (memberships || []).forEach((m: { workspace_id: string; role: RoleType }) => {
      if (m.workspace_id) {
        roleMap.set(m.workspace_id, m.role);
      }
    });
    
    // Get workspace details
    const { data: ws, error: wErr } = await supabase
      .from('workspaces')
      .select('id, name, owner, created_at')
      .in('id', ids);
      
    if (wErr) {
      console.error('Error fetching shared workspaces:', wErr);
      return [];
    }
    
    // Normalize and deduplicate results
    const normalized = (ws || []).map((w: { id: string; name: string; owner?: string; created_at?: string }) => ({
      id: w.id,
      name: w.name,
      created_at: w.created_at,
      accessRole: roleMap.get(w.id) ?? 'member',
      isShared: w.owner !== userId,
    }));
    const uniqMap = new Map<string, WorkspaceRecord>();
    normalized.forEach((w) => uniqMap.set(w.id, w));
    return Array.from(uniqMap.values());
  } catch (err) {
    console.error('Error in fetchSharedWorkspaces:', err);
    return [];
  }
};

export const useWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<Array<WorkspaceRecord & { owner_name?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async (): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp.user?.id;
      if (!uid) {
        setWorkspaces([]);
        setSharedWorkspaces([]);
        return null;
      }
      
      // First get owned workspaces only (avoid duplicates with shared)
      const { data: ownerList, error: ownerError } = await supabase
        .from("workspaces")
        .select("id, name, owner, created_at")
        .eq("owner", uid)
        .order("created_at", { ascending: true });
        
      if (ownerError) throw ownerError;

      const ownedWorkspaces: WorkspaceRecord[] = (ownerList ?? []).map((w: { id: string; name: string; created_at?: string }) => ({
        id: w.id,
        name: w.name,
        created_at: w.created_at,
        accessRole: 'owner',
        isShared: false,
      }));

      // Get shared workspaces (membership-based)
      const shared = await fetchSharedWorkspaces(uid);

      // Merge owned + shared and dedupe by id to keep the UI consistent
      const mergedWorkspaces = mergeWorkspacesById(ownedWorkspaces, shared);

      // Handle first-time users with no access to any workspace
      if (mergedWorkspaces.length === 0) {
        try {
          // Create a default workspace for first-time users
          const defaultWorkspace = await WorkspaceService.createDefaultWorkspace();
          const decoratedDefault: WorkspaceRecord = {
            ...defaultWorkspace,
            accessRole: 'owner',
            isShared: false,
          };
          setWorkspaces([decoratedDefault]);
          
          // Still try to get shared workspaces (will be empty here)
          setSharedWorkspaces([]);
          
          return decoratedDefault.id;
        } catch (createErr) {
          console.error('Error creating default workspace:', createErr);
          throw createErr;
        }
      }
      
      // Set state with results
      setWorkspaces(mergedWorkspaces);
      setSharedWorkspaces(shared);
      
      return mergedWorkspaces[0]?.id ?? null;
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to load workspaces';
      setError(message);
      console.error('Error loading workspaces:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorkspace = useCallback(async (formData: CreateWorkspaceFormData): Promise<WorkspaceRecord> => {
    try {
      setError(null);
      
      // Direct Supabase query for better error handling
      const { data, error } = await supabase
        .from("workspaces")
        .insert({ name: formData.name.trim() })
        .select("id, name")
        .single();
      
      if (error) {
        console.error('Supabase error creating workspace:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('No workspace data returned after creation');
      }
      
      // Explicitly type to satisfy WorkspaceRecord's accessRole union
      const newWorkspace: WorkspaceRecord = {
        ...(data as WorkspaceRecord),
        accessRole: 'owner',
        isShared: false,
      };
      setWorkspaces(prev => [...prev, newWorkspace]);
      return newWorkspace;
    } catch (err: unknown) {
      // Detailed error handling with proper message extraction
      const message = err instanceof Error 
        ? err.message 
        : (typeof err === 'object' && err && 'message' in err) 
          ? String((err as { message: unknown }).message)
          : (typeof err === 'object' && err && 'details' in err)
            ? String((err as { details: unknown }).details)
            : 'Failed to create workspace';
      
      setError(message);
      console.error('Error creating workspace:', err);
      throw new Error(message); // Re-throw as proper Error
    }
  }, []);

  const updateWorkspace = useCallback(async (workspaceId: string, name: string): Promise<void> => {
    try {
      setError(null);
      await WorkspaceService.updateWorkspace(workspaceId, name);
      setWorkspaces(prev => prev.map(w => 
        w.id === workspaceId ? { ...w, name: name.trim() } : w
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace';
      setError(message);
      throw err;
    }
  }, []);

  const deleteWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    try {
      setError(null);
      await WorkspaceService.deleteWorkspace(workspaceId);
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
      setSharedWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err && 'message' in err)
          ? String((err as { message: unknown }).message)
          : (typeof err === 'object' && err && 'details' in err)
            ? String((err as { details: unknown }).details)
            : 'Failed to delete workspace';
      setError(message);
      // Re-throw as a proper Error so upstream handlers receive a meaningful message
      throw new Error(message);
    }
  }, []);

  return {
    workspaces,
    sharedWorkspaces,
    loading,
    error,
    loadWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    clearError: () => setError(null)
  };
};
