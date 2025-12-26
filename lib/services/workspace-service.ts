import { supabase } from '../supabaseClient';
import type { WorkspaceRecord, CreateWorkspaceFormData } from '../types/dashboard';
import { AuditLogService } from './audit-log-service';

export class WorkspaceService {
  static async getWorkspaces(): Promise<WorkspaceRecord[]> {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name")
      .order("created_at", { ascending: true });
    
    if (error) throw error;
    return (data ?? []) as WorkspaceRecord[];
  }

  static async createWorkspace(formData: CreateWorkspaceFormData): Promise<WorkspaceRecord> {
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: formData.name.trim() })
      .select("id, name")
      .single();
    
    if (error) throw error;

    const workspace = data as WorkspaceRecord;

    // Log workspace creation
    await AuditLogService.log({
      action: 'create',
      entity_type: 'workspace',
      entity_id: workspace.id,
      scope_type: 'workspace',
      scope_id: workspace.id,
      metadata: { name: workspace.name },
    });

    return workspace;
  }

  static async createDefaultWorkspace(): Promise<WorkspaceRecord> {
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: "My First Workspace" })
      .select("id, name")
      .single();
    
    if (error) throw error;

    const workspace = data as WorkspaceRecord;

    // Log workspace creation
    await AuditLogService.log({
      action: 'create',
      entity_type: 'workspace',
      entity_id: workspace.id,
      scope_type: 'workspace',
      scope_id: workspace.id,
      metadata: { name: workspace.name },
    });

    return workspace;
  }

  static async updateWorkspace(workspaceId: string, name: string): Promise<void> {
    // Get old name for audit log
    const { data: oldData } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim() })
      .eq("id", workspaceId);
    
    if (error) throw error;

    // Log workspace update
    await AuditLogService.log({
      action: 'update',
      entity_type: 'workspace',
      entity_id: workspaceId,
      scope_type: 'workspace',
      scope_id: workspaceId,
      metadata: { old_name: oldData?.name, new_name: name.trim() },
    });
  }

  static async deleteWorkspace(workspaceId: string): Promise<void> {
    // Get workspace info for audit log before deletion
    const { data: wsData } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    const { error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspaceId);
    
    if (error) throw error;

    // Log workspace deletion
    await AuditLogService.log({
      action: 'delete',
      entity_type: 'workspace',
      entity_id: workspaceId,
      scope_type: 'workspace',
      scope_id: workspaceId,
      metadata: { name: wsData?.name },
    });
  }
}
