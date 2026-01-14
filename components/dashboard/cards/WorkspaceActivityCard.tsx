import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuditLogService, type AuditLogRow } from "@/lib/services/audit-log-service";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";

interface WorkspaceActivityCardProps {
  workspaceId: string;
  className?: string;
}

function formatAction(log: AuditLogRow): string {
  const actor = log.actor?.full_name || log.actor?.email || "Someone";
  const entity = log.entity_type;
  const action = log.action;
  const meta = log.metadata as { name?: string; old_name?: string; new_name?: string; original_name?: string } | undefined;

  // Workspace actions
  if (entity === 'workspace') {
    if (action === 'create') return `${actor} created this workspace`;
    if (action === 'update') {
      if (meta?.old_name && meta?.new_name) {
        return `${actor} renamed workspace from "${meta.old_name}" to "${meta.new_name}"`;
      }
      return `${actor} updated workspace settings`;
    }
    if (action === 'delete') return `${actor} deleted workspace "${meta?.name || 'unknown'}"`;
  }

  // Base actions
  if (entity === 'base') {
    const baseMeta = meta as { 
      name?: string; 
      base_name?: string;
      old_name?: string; 
      new_name?: string; 
      original_name?: string;
      source?: string;
      contacts_synced?: number;
      contacts_created?: number;
      contacts_updated?: number;
    } | undefined;
    
    if (action === 'create') return `${actor} created base "${baseMeta?.name || 'unknown'}"`;
    if (action === 'update') {
      if (baseMeta?.old_name && baseMeta?.new_name) {
        return `${actor} renamed base from "${baseMeta.old_name}" to "${baseMeta.new_name}"`;
      }
      return `${actor} updated base "${baseMeta?.name || 'unknown'}"`;
    }
    if (action === 'delete') return `${actor} deleted base "${baseMeta?.name || 'unknown'}"`;
    if (action === 'duplicate') return `${actor} duplicated base "${baseMeta?.original_name || 'unknown'}"`;
    if (action === 'import') {
      if (baseMeta?.source === 'ghl') {
        const synced = baseMeta.contacts_synced ?? 0;
        const created = baseMeta.contacts_created ?? 0;
        const updated = baseMeta.contacts_updated ?? 0;
        return `${actor} synced ${synced} contacts from GoHighLevel (${created} new, ${updated} updated)`;
      }
      return `${actor} imported data to base "${baseMeta?.base_name || baseMeta?.name || 'unknown'}"`;
    }
  }

  // Table actions
  if (entity === 'table') {
    if (action === 'create') return `${actor} created table "${meta?.name || 'unknown'}"`;
    if (action === 'delete') return `${actor} deleted table "${meta?.name || 'unknown'}"`;
  }

  // Field actions
  if (entity === 'field') {
    if (action === 'create') return `${actor} added field "${meta?.name || 'unknown'}"`;
    if (action === 'update') return `${actor} updated field "${meta?.name || 'unknown'}"`;
    if (action === 'delete') return `${actor} removed field "${meta?.name || 'unknown'}"`;
  }

  // Record actions
  if (entity === 'record') {
    if (action === 'create') return `${actor} created a record`;
    if (action === 'update') return `${actor} updated a record`;
    if (action === 'delete') return `${actor} deleted a record`;
  }

  // Automation actions (including GHL integrations)
  if (entity === 'automation') {
    const autoMeta = meta as { type?: string; base_name?: string; name?: string } | undefined;
    if (autoMeta?.type === 'ghl_integration') {
      if (action === 'create') return `${actor} connected GoHighLevel to base "${autoMeta.base_name || 'unknown'}"`;
      if (action === 'delete') return `${actor} disconnected GoHighLevel from base "${autoMeta.base_name || 'unknown'}"`;
    }
    if (action === 'create') return `${actor} created automation "${meta?.name || 'unknown'}"`;
    if (action === 'update') return `${actor} updated automation "${meta?.name || 'unknown'}"`;
    if (action === 'delete') return `${actor} deleted automation "${meta?.name || 'unknown'}"`;
  }

  // Member actions
  if (entity === 'member') {
    const memberMeta = meta as { email?: string; type?: string; old_role?: string; new_role?: string } | undefined;
    if (action === 'create') {
      if (memberMeta?.type === 'invite') {
        return `${actor} invited ${memberMeta.email || 'someone'} to the workspace`;
      }
      return `${actor} added a member`;
    }
    if (action === 'update') {
      if (memberMeta?.old_role && memberMeta?.new_role) {
        return `${actor} changed a member's role from ${memberMeta.old_role} to ${memberMeta.new_role}`;
      }
      return `${actor} updated member role`;
    }
    if (action === 'delete') return `${actor} removed a member`;
  }

  // Fallback
  return `${actor} ${action}d ${entity}`;
}

export const WorkspaceActivityCard = ({ workspaceId, className }: WorkspaceActivityCardProps) => {
  const { timezone } = useTimezone();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const load = useMemo(() => async (cursor?: string) => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await AuditLogService.getWorkspaceLogs(workspaceId, 50, cursor);
      if (cursor) {
        setLogs(prev => [...prev, ...data]);
      } else {
        setLogs(data);
      }
      setNextCursor(data.length ? data[data.length - 1].created_at : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className || "w-3/4"}`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full border-b border-gray-200 px-6 py-4 transition-colors text-left ${isCollapsed ? 'rounded-lg' : ''} hover:bg-gray-50`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Workspace Activity</h3>
          <ChevronDown size={14} className={`text-gray-600 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {!isCollapsed && (
        <div className="flex-1 min-h-0 px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
          )}

          {loading && logs.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Loading activity...</div>
          ) : logs.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No activity yet</div>
          ) : (
            <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 text-sm">
                  <div className="text-gray-900">{formatAction(log)}</div>
                  <div className="text-xs text-gray-500">{formatInTimezone(log.created_at, timezone, { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              onClick={() => load(nextCursor ?? undefined)}
              disabled={loading || !nextCursor}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Load more
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
