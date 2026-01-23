import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

export type EffectiveRole = 'owner' | 'admin' | 'member' | null;

export function useRole(params: { workspaceId?: string | null; baseId?: string | null }) {
  const { workspaceId, baseId } = params;
  const [role, setRole] = useState<EffectiveRole>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function resolveRole() {
      if (!workspaceId && !baseId) {
        setRole(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Prefer base-level resolution when baseId provided
        if (baseId) {
          // Get base to check ownership and workspace relation
          const { data: base, error: baseErr } = await supabase
            .from('bases')
            .select('id, owner, workspace_id')
            .eq('id', baseId)
            .single();
          if (baseErr) throw baseErr;

          const { data: userResp } = await supabase.auth.getUser();
          const uid = userResp.user?.id;
          if (!uid) {
            setRole(null);
            return;
          }

          if (base.owner === uid) {
            setRole('owner');
            return;
          }

          // Base membership
          const { data: bm } = await supabase
            .from('base_memberships')
            .select('role')
            .eq('base_id', baseId)
            .eq('user_id', uid)
            .maybeSingle();

          if (bm?.role === 'owner') { setRole('owner'); return; }
          if (bm?.role === 'admin') { setRole('admin'); return; }
          if (bm?.role === 'member') { setRole('member'); return; }

          // Inherit from workspace
          const { data: wm } = await supabase
            .from('workspace_memberships')
            .select('role')
            .eq('workspace_id', base.workspace_id)
            .eq('user_id', uid)
            .maybeSingle();
          if (wm?.role === 'owner') { setRole('owner'); return; }
          if (wm?.role === 'admin') { setRole('admin'); return; }
          if (wm?.role === 'member') { setRole('member'); return; }

          setRole(null);
          return;
        }

        // Workspace-level
        if (workspaceId) {
          const { data: ws, error: wsErr } = await supabase
            .from('workspaces')
            .select('id, owner')
            .eq('id', workspaceId)
            .single();
          if (wsErr) throw wsErr;

          const { data: userResp } = await supabase.auth.getUser();
          const uid = userResp.user?.id;
          if (!uid) { setRole(null); return; }
          if (ws.owner === uid) { setRole('owner'); return; }

          const { data: wm } = await supabase
            .from('workspace_memberships')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', uid)
            .maybeSingle();
          if (wm?.role === 'owner') { setRole('owner'); return; }
          if (wm?.role === 'admin') { setRole('admin'); return; }
          if (wm?.role === 'member') { setRole('member'); return; }
          setRole(null);
          return;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolveRole();
    return () => { cancelled = true; };
  }, [workspaceId, baseId]);

  const can = useMemo(() => {
    const flags = { read: false, create: false, update: false, delete: false };
    if (role === 'owner' || role === 'admin') {
      return { read: true, create: true, update: true, delete: true };
    }
    if (role === 'member') {
      return { read: true, create: true, update: true, delete: false };
    }
    return flags;
  }, [role]);

  return { role, can, loading };
}


