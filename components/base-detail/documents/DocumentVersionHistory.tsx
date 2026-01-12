"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History,
  Clock,
  Download,
  RotateCcw,
  Trash2,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  DocumentVersionService,
  type DocumentVersion,
} from "@/lib/services/document-version-service";

type DocumentVersionHistoryProps = {
  documentPath: string;
  baseId: string;
  tableId?: string | null;
  onVersionRestored?: () => void;
};

// Format file size
const formatSize = (bytes: number | null): string => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

export const DocumentVersionHistory = ({
  documentPath,
  baseId,
  tableId,
  onVersionRestored,
}: DocumentVersionHistoryProps) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

  // Load versions
  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await DocumentVersionService.getVersions(documentPath, baseId);
      setVersions(data);
    } catch (err) {
      console.error("Failed to load versions:", err);
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [documentPath, baseId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Handle restore
  const handleRestore = async (version: DocumentVersion) => {
    if (!window.confirm(`Restore version ${version.version_number}? This will create a new version with this content.`)) {
      return;
    }

    setRestoring(version.id);
    try {
      await DocumentVersionService.restoreVersion(version.id);
      toast.success(`Restored to version ${version.version_number}`);
      await loadVersions();
      onVersionRestored?.();
    } catch (err) {
      console.error("Failed to restore version:", err);
      toast.error("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  // Handle delete
  const handleDelete = async (version: DocumentVersion) => {
    if (version.is_current) {
      toast.error("Cannot delete the current version");
      return;
    }

    if (!window.confirm(`Delete version ${version.version_number}? This cannot be undone.`)) {
      return;
    }

    setDeleting(version.id);
    try {
      await DocumentVersionService.deleteVersion(version.id);
      toast.success("Version deleted");
      await loadVersions();
    } catch (err) {
      console.error("Failed to delete version:", err);
      toast.error("Failed to delete version");
    } finally {
      setDeleting(null);
    }
  };

  // Handle preview
  const handlePreview = async (version: DocumentVersion) => {
    try {
      const url = await DocumentVersionService.getVersionSignedUrl(version.version_path);
      setPreviewUrl(url);
      setPreviewVersion(version);
    } catch (err) {
      console.error("Failed to get preview URL:", err);
      toast.error("Failed to load preview");
    }
  };

  // Handle download
  const handleDownload = async (version: DocumentVersion) => {
    try {
      const url = await DocumentVersionService.getVersionSignedUrl(version.version_path);
      const link = document.createElement("a");
      link.href = url;
      link.download = `v${version.version_number}-${version.file_name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download version:", err);
      toast.error("Failed to download version");
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return null; // Don't show if no versions exist
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Version History</h3>
          <span className="text-sm text-gray-500">({versions.length} version{versions.length !== 1 ? "s" : ""})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Version List */}
      {expanded && (
        <div className="border-t border-gray-200 max-h-80 overflow-y-auto">
          {versions.map((version) => (
            <div
              key={version.id}
              className={`px-4 py-3 flex items-center gap-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                version.is_current ? "bg-blue-50/50" : ""
              }`}
            >
              {/* Version Number Badge */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  version.is_current
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                v{version.version_number}
              </div>

              {/* Version Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {version.file_name}
                  </span>
                  {version.is_current && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(version.created_at)}
                  </span>
                  <span>•</span>
                  <span>{formatSize(version.size_bytes)}</span>
                  {version.notes && (
                    <>
                      <span>•</span>
                      <span className="italic truncate max-w-[150px]" title={version.notes}>
                        {version.notes}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePreview(version)}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(version)}
                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                {!version.is_current && (
                  <>
                    <button
                      onClick={() => handleRestore(version)}
                      disabled={restoring === version.id}
                      className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Restore this version"
                    >
                      {restoring === version.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(version)}
                      disabled={deleting === version.id}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete this version"
                    >
                      {deleting === version.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewVersion && previewUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setPreviewVersion(null);
            setPreviewUrl(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] w-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">
                  Version {previewVersion.version_number} - {previewVersion.file_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewVersion)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
                {!previewVersion.is_current && (
                  <button
                    onClick={() => {
                      handleRestore(previewVersion);
                      setPreviewVersion(null);
                      setPreviewUrl(null);
                    }}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Restore this version"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setPreviewVersion(null);
                    setPreviewUrl(null);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {previewVersion.mime_type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewVersion.file_name}
                  className="max-w-full max-h-[70vh] mx-auto object-contain"
                />
              ) : previewVersion.mime_type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] border-0 rounded-lg"
                  title={previewVersion.file_name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FileText className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium mb-2">Preview not available</p>
                  <p className="text-sm">Click download to view this file</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
