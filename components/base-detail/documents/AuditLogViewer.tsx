"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  FileText,
  Folder,
  Upload,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  ChevronDown,
  X,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import {
  DocumentActivityService,
  DocumentActivityLog,
  DocumentActivityAction,
  ACTION_CONFIG,
} from "@/lib/services/document-activity-service";
import { toast } from "sonner";

type AuditLogViewerProps = {
  baseId: string;
  tableId?: string | null;
  recordId?: string | null; // Filter to record-specific activities
  onClose?: () => void;
};

const ACTIONS_LIST: DocumentActivityAction[] = [
  "upload",
  "download",
  "view",
  "edit",
  "delete",
  "rename",
  "move",
  "folder_create",
  "folder_rename",
  "folder_delete",
  "signature_request",
  "signature_sent",
  "signature_viewed",
  "signature_signed",
  "signature_declined",
  "signature_completed",
  "template_create",
  "template_edit",
  "template_delete",
  "document_generate",
  "share_create",
  "share_revoke",
];

const ACTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  upload: Upload,
  download: Download,
  view: Eye,
  edit: Edit,
  delete: Trash2,
  rename: Edit,
  move: RefreshCw,
  folder_create: Folder,
  folder_rename: Folder,
  folder_delete: Folder,
  default: FileText,
};

export const AuditLogViewer = ({
  baseId,
  tableId,
  recordId,
  onClose,
}: AuditLogViewerProps) => {
  const [logs, setLogs] = useState<DocumentActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActions, setSelectedActions] = useState<DocumentActivityAction[]>([]);
  const [showActionFilter, setShowActionFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [uniqueUsers, setUniqueUsers] = useState<{ id: string; name: string }[]>([]);

  // Load audit logs
  const loadLogs = useCallback(
    async (before?: string) => {
      try {
        if (before) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const fetchedLogs = await DocumentActivityService.getActivityLogs(
          baseId,
          tableId,
          {
            limit: 50,
            before,
            actions: selectedActions.length > 0 ? selectedActions : undefined,
            recordId, // Pass recordId for filtering
          }
        );

        if (before) {
          setLogs((prev) => [...prev, ...fetchedLogs]);
        } else {
          setLogs(fetchedLogs);
        }

        // Extract unique users
        const userMap = new Map<string, string>();
        fetchedLogs.forEach((log) => {
          if (log.user_id && log.user) {
            userMap.set(log.user_id, log.user.full_name || "Unknown User");
          }
        });
        setUniqueUsers((prev) => {
          const existing = new Map(prev.map((u) => [u.id, u.name]));
          userMap.forEach((name, id) => existing.set(id, name));
          return Array.from(existing.entries()).map(([id, name]) => ({
            id,
            name,
          }));
        });

        setHasMore(fetchedLogs.length === 50);
      } catch (error) {
        console.error("Failed to load audit logs:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [baseId, tableId, recordId, selectedActions]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Filter logs based on search and filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          log.document_name?.toLowerCase().includes(query) ||
          log.document_path?.toLowerCase().includes(query) ||
          log.folder_path?.toLowerCase().includes(query) ||
          log.user?.full_name?.toLowerCase().includes(query) ||
          ACTION_CONFIG[log.action]?.label.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Date filter
      if (dateFrom) {
        const logDate = new Date(log.created_at);
        const fromDate = new Date(dateFrom);
        if (logDate < fromDate) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (logDate > toDate) return false;
      }

      // User filter
      if (selectedUser && log.user_id !== selectedUser) return false;

      return true;
    });
  }, [logs, searchQuery, dateFrom, dateTo, selectedUser]);

  // Load more
  const handleLoadMore = () => {
    if (logs.length > 0 && hasMore) {
      const lastLog = logs[logs.length - 1];
      loadLogs(lastLog.created_at);
    }
  };

  // Toggle action filter
  const toggleAction = (action: DocumentActivityAction) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedActions([]);
    setDateFrom("");
    setDateTo("");
    setSelectedUser(null);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Get icon for action
  const getActionIcon = (action: string) => {
    const IconComponent = ACTION_ICONS[action] || ACTION_ICONS.default;
    return IconComponent;
  };

  const hasActiveFilters =
    searchQuery ||
    selectedActions.length > 0 ||
    dateFrom ||
    dateTo ||
    selectedUser;

  // Export to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Date", "User", "Action", "Document/Folder", "Path", "Details"];
    const rows = filteredLogs.map((log) => {
      const config = ACTION_CONFIG[log.action];
      return [
        formatDate(log.created_at),
        log.user?.full_name || "System",
        config?.label || log.action,
        log.document_name || log.folder_path || "-",
        log.document_path || log.folder_path || "-",
        log.metadata ? JSON.stringify(log.metadata) : "-",
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Exported to CSV", {
      description: `${filteredLogs.length} activities exported`,
    });
  };

  // Export to PDF (generates printable HTML)
  const exportToPDF = () => {
    if (filteredLogs.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Create printable HTML
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Log Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 10px; }
          .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f3f4f6; padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) { background: #f9fafb; }
          .action { font-weight: 500; }
          .path { color: #666; font-size: 10px; word-break: break-all; }
          .metadata { font-size: 10px; color: #888; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>Audit Log</h1>
        <p class="subtitle">Exported on ${new Date().toLocaleString()} | ${filteredLogs.length} activities</p>
        <table>
          <thead>
            <tr>
              <th style="width: 15%">Date</th>
              <th style="width: 15%">User</th>
              <th style="width: 12%">Action</th>
              <th style="width: 20%">Document/Folder</th>
              <th style="width: 25%">Path</th>
              <th style="width: 13%">Details</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLogs
              .map((log) => {
                const config = ACTION_CONFIG[log.action];
                const metadata = log.metadata && Object.keys(log.metadata).length > 0
                  ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(", ")
                  : "-";
                return `
                  <tr>
                    <td>${formatDate(log.created_at)}</td>
                    <td>${log.user?.full_name || "System"}</td>
                    <td class="action">${config?.label || log.action}</td>
                    <td>${log.document_name || log.folder_path || "-"}</td>
                    <td class="path">${log.document_path || log.folder_path || "-"}</td>
                    <td class="metadata">${metadata}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      toast.error("Popup blocked", {
        description: "Please allow popups to export to PDF",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Audit Log
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredLogs.length} activities
            {hasActiveFilters && " (filtered)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Buttons */}
          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportToPDF}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to PDF"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-200 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name, user, or action..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Filter */}
          <div className="relative">
            <button
              onClick={() => setShowActionFilter(!showActionFilter)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                selectedActions.length > 0
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Actions
              {selectedActions.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {selectedActions.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showActionFilter && (
              <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-2 space-y-1">
                  {ACTIONS_LIST.map((action) => {
                    const config = ACTION_CONFIG[action];
                    return (
                      <label
                        key={action}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedActions.includes(action)}
                          onChange={() => toggleAction(action)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${config?.color || ""}`}>
                          {config?.label || action}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Date Filters */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="From"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="To"
            />
          </div>

          {/* User Filter */}
          {uniqueUsers.length > 0 && (
            <select
              value={selectedUser || ""}
              onChange={(e) => setSelectedUser(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Users</option>
              {uniqueUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <FileText className="w-12 h-12 mb-2 opacity-50" />
            <p>No activities found</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => {
              const config = ACTION_CONFIG[log.action];
              const IconComponent = getActionIcon(log.action);

              return (
                <div
                  key={log.id}
                  className="px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-lg ${
                        config?.color
                          ? config.color.replace("text-", "bg-").replace("-600", "-100")
                          : "bg-gray-100"
                      }`}
                    >
                      <IconComponent
                        className={`w-4 h-4 ${config?.color || "text-gray-600"}`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {log.user?.full_name || "System"}
                        </span>
                        <span className={`text-sm ${config?.color || "text-gray-600"}`}>
                          {config?.label || log.action}
                        </span>
                        {log.document_name && (
                          <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
                            {log.document_name}
                          </span>
                        )}
                        {log.folder_path && !log.document_name && (
                          <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
                            {log.folder_path}
                          </span>
                        )}
                      </div>

                      {/* Path */}
                      {log.document_path && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {log.document_path}
                        </p>
                      )}

                      {/* Metadata */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-block mr-2 px-1.5 py-0.5 bg-gray-100 rounded"
                            >
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && filteredLogs.length > 0 && !loading && (
          <div className="p-4 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
