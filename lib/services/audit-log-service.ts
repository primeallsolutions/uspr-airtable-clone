import { supabase } from '../supabaseClient';

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: 'create' | 'update' | 'delete' | string;
  entity_type: 'workspace' | 'base' | 'table' | 'field' | 'record' | 'automation' | string;
  entity_id: string;
  scope_type: 'workspace' | 'base' | null;
  scope_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: { id: string; full_name: string | null; email?: string | null } | null;
};

export class AuditLogService {
  static async getWorkspaceLogs(workspaceId: string, limit = 50, before?: string): Promise<AuditLogRow[]> {
    let query = supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, scope_type, scope_id, metadata, created_at')
      .eq('scope_type', 'workspace')
      .eq('scope_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    const logs = (data ?? []) as AuditLogRow[];
    const actorIds = Array.from(new Set(logs.map(l => l.actor_id).filter((v): v is string => Boolean(v))));

    if (actorIds.length === 0) {
      return logs.map(l => ({ ...l, actor: null }));
    }

    const { data: actors, error: actorErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);
    if (actorErr) {
      // If actor hydration fails, still return logs without actor details
      return logs.map(l => ({ ...l, actor: null }));
    }
    const idToActor = new Map((actors ?? []).map((a: { id: string; full_name: string | null; email?: string | null }) => [
      a.id,
      { id: a.id, full_name: a.full_name, email: a.email ?? null },
    ]));

    return logs.map(l => ({
      ...l,
      actor: l.actor_id ? (idToActor.get(l.actor_id) ?? null) : null,
    }));
  }

  static async getRecordLogs(recordId: string, limit = 10): Promise<AuditLogRow[]> {
    let query = supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, scope_type, scope_id, metadata, created_at')
      .eq('entity_type', 'record')
      .eq('entity_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    const logs = (data ?? []) as AuditLogRow[];
    const actorIds = Array.from(new Set(logs.map(l => l.actor_id).filter((v): v is string => Boolean(v))));

    if (actorIds.length === 0) {
      return logs.map(l => ({ ...l, actor: null }));
    }

    const { data: actors, error: actorErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);

    if (actorErr) {
      return logs.map(l => ({ ...l, actor: null }));
    }

    const idToActor = new Map(
      (actors ?? []).map((a: { id: string; full_name: string | null; email?: string | null }) => [
        a.id,
        { id: a.id, full_name: a.full_name, email: a.email ?? null },
      ])
    );

    return logs.map(l => ({
      ...l,
      actor: l.actor_id ? (idToActor.get(l.actor_id) ?? null) : null,
    }));
  }
}




