import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AuditLogService, type AuditLogRow } from "@/lib/services/audit-log-service";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";

interface WorkspaceActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

function formatAction(log: AuditLogRow): string {
  const actor = log.actor?.full_name || log.actor?.email || "Someone";
  const entity = log.entity_type;
  const action = log.action;
  if (entity === 'base' && action === 'create') return `${actor} created a new base`;
  if (entity === 'workspace' && action === 'update') return `${actor} updated workspace`;
  return `${actor} ${action} ${entity}`;
}

export const WorkspaceActivityModal = ({ isOpen, onClose, workspaceId }: WorkspaceActivityModalProps) => {
  const { timezone } = useTimezone();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

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
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Workspace Activity</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
          )}

          {loading && logs.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Loading activity...</div>
          ) : logs.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No activity yet</div>
          ) : (
            <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
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

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


