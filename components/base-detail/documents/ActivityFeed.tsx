"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  Download,
  Eye,
  Edit,
  Trash2,
  Edit2,
  Move,
  FolderPlus,
  Folder,
  FolderMinus,
  PenTool,
  Send,
  Check,
  X,
  CheckCircle,
  FilePlus,
  FileText,
  FileMinus,
  File,
  Share2,
  Lock,
  Activity,
  RefreshCw,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  DocumentActivityService,
  DocumentActivityLog,
  DocumentActivityAction,
  ACTION_CONFIG,
} from "@/lib/services/document-activity-service";

type ActivityFeedProps = {
  baseId: string;
  tableId?: string | null;
  className?: string;
};

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  upload: Upload,
  download: Download,
  eye: Eye,
  edit: Edit,
  trash: Trash2,
  "edit-2": Edit2,
  move: Move,
  "folder-plus": FolderPlus,
  folder: Folder,
  "folder-minus": FolderMinus,
  "pen-tool": PenTool,
  send: Send,
  check: Check,
  x: X,
  "check-circle": CheckCircle,
  "file-plus": FilePlus,
  "file-text": FileText,
  "file-minus": FileMinus,
  file: File,
  "share-2": Share2,
  lock: Lock,
  activity: Activity,
};

export const ActivityFeed = ({ baseId, tableId, className = "" }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<DocumentActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load initial activities
  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const logs = await DocumentActivityService.getActivityLogs(baseId, tableId, {
        limit: 30,
      });
      setActivities(logs);
      setHasMore(logs.length >= 30);
    } catch (err) {
      console.error("Failed to load activities:", err);
      setError("Failed to load activity feed");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

  // Load more activities (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || activities.length === 0) return;

    try {
      setLoadingMore(true);
      const lastActivity = activities[activities.length - 1];
      const moreLogs = await DocumentActivityService.getActivityLogs(baseId, tableId, {
        limit: 30,
        before: lastActivity.created_at,
      });
      
      if (moreLogs.length < 30) {
        setHasMore(false);
      }
      
      setActivities((prev) => [...prev, ...moreLogs]);
    } catch (err) {
      console.error("Failed to load more activities:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [baseId, tableId, activities, loadingMore, hasMore]);

  // Subscribe to real-time updates
  useEffect(() => {
    loadActivities();

    // Subscribe to new activities
    const unsubscribe = DocumentActivityService.subscribeToActivity(
      baseId,
      tableId || null,
      (newActivity) => {
        setActivities((prev) => [newActivity, ...prev]);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [baseId, tableId, loadActivities]);

  // Render activity icon
  const renderIcon = (action: DocumentActivityAction) => {
    const config = ACTION_CONFIG[action];
    const IconComponent = ICON_MAP[config.icon] || Activity;
    return <IconComponent className={`w-4 h-4 ${config.color}`} />;
  };

  // Render single activity item
  const renderActivityItem = (activity: DocumentActivityLog) => {
    const config = DocumentActivityService.getActionConfig(activity.action);
    const userName = activity.user?.full_name || "Someone";
    const targetName = activity.document_name || activity.folder_path?.split("/").pop() || "item";
    const relativeTime = DocumentActivityService.formatRelativeTime(activity.created_at);

    return (
      <div
        key={activity.id}
        className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
      >
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            {renderIcon(activity.action)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">
            <span className="font-medium">{userName}</span>{" "}
            <span className={config.color}>{config.label}</span>{" "}
            <span className="font-medium truncate inline-block max-w-[150px] align-bottom">
              {targetName}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{relativeTime}</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={loadActivities}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Activity
        </h3>
        <button
          onClick={loadActivities}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Activity className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Activity will appear here when documents are uploaded, edited, or signed.
            </p>
          </div>
        ) : (
          <>
            {activities.map(renderActivityItem)}
            
            {/* Load More */}
            {hasMore && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
