import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreVertical, Pencil, Trash2, Inbox, Clock, Files, CalendarPlus } from "lucide-react";
import { FolderSkeleton } from "./DocumentsSkeleton";

type FolderNode = {
  name: string;
  path: string;
  parent_path: string | null;
  children: FolderNode[];
};

export type DocumentView = 'recent' | 'all' | 'folder' | 'today';

type DocumentsSidebarProps = {
  folderTree: FolderNode[];
  currentPrefix: string;
  onFolderSelect: (folder: string) => void;
  onFolderRename?: (folderPath: string, folderName: string) => void;
  onFolderDelete?: (folderPath: string, folderName: string) => void;
  loading?: boolean;
  uncategorizedCount?: number; // Count of files in root (no folder)
  recentCount?: number;        // Count of recent uploads (last 7 days)
  totalDocCount?: number;      // Total document count
  todayCount?: number;         // Count of files uploaded today
  currentView?: DocumentView;  // Current active view
  onViewChange?: (view: DocumentView) => void;  // Handler for view changes
};

const FolderItem = ({
  folder,
  level = 0,
  currentPrefix,
  onFolderSelect,
  onFolderRename,
  onFolderDelete,
  expandedFolders,
  toggleFolder,
}: {
  folder: FolderNode;
  level?: number;
  currentPrefix: string;
  onFolderSelect: (folder: string) => void;
  onFolderRename?: (folderPath: string, folderName: string) => void;
  onFolderDelete?: (folderPath: string, folderName: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedFolders.has(folder.path);
  const isSelected = currentPrefix === folder.path || currentPrefix.startsWith(folder.path + "/");
  const hasChildren = folder.children.length > 0;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="group relative">
      <div className="flex items-center">
        <button
          onClick={() => {
            if (hasChildren) {
              toggleFolder(folder.path);
            }
            onFolderSelect(folder.path);
          }}
          className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isSelected
              ? "bg-blue-100 text-blue-800"
              : "hover:bg-white text-gray-700"
          }`}
          style={{ paddingLeft: `${0.75 + level * 1}rem` }}
        >
          {hasChildren ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 flex-shrink-0" />
              )}
            </>
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
        {(onFolderRename || onFolderDelete) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
              aria-label="Folder actions"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {onFolderRename && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onFolderRename(folder.path, folder.name);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                )}
                {onFolderDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onFolderDelete(folder.path, folder.name);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.path}
              folder={child}
              level={level + 1}
              currentPrefix={currentPrefix}
              onFolderSelect={onFolderSelect}
              onFolderRename={onFolderRename}
              onFolderDelete={onFolderDelete}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DocumentsSidebar = ({
  folderTree,
  currentPrefix,
  onFolderSelect,
  onFolderRename,
  onFolderDelete,
  loading = false,
  uncategorizedCount = 0,
  recentCount = 0,
  totalDocCount = 0,
  todayCount = 0,
  currentView = 'folder',
  onViewChange,
}: DocumentsSidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand folders that contain the current prefix
  useEffect(() => {
    if (currentPrefix && currentView === 'folder') {
      const parts = currentPrefix.split("/").filter(Boolean);
      const pathsToExpand = new Set<string>();
      let currentPath = "";
      parts.forEach((part) => {
        currentPath += part + "/";
        pathsToExpand.add(currentPath);
      });
      setExpandedFolders(pathsToExpand);
    }
  }, [currentPrefix, currentView]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Check if "Uncategorized" (root) is selected
  const isUncategorizedSelected = currentView === 'folder' && currentPrefix === "";

  // Handle view selection
  const handleViewSelect = (view: DocumentView) => {
    if (onViewChange) {
      onViewChange(view);
    }
  };

  // Handle folder selection (switches to folder view)
  const handleFolderSelect = (folder: string) => {
    if (onViewChange) {
      onViewChange('folder');
    }
    onFolderSelect(folder);
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0 overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Quick Access Section */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-600 uppercase">Quick Access</div>
          <div className="space-y-1">
            {/* Uploaded Today - highlighted when there are new uploads */}
            <button
              onClick={() => handleViewSelect('today')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                currentView === 'today'
                  ? "bg-green-100 text-green-800"
                  : todayCount > 0
                    ? "bg-green-50 text-green-700 hover:bg-green-100 animate-pulse-subtle"
                    : "hover:bg-white text-gray-700"
              }`}
            >
              <CalendarPlus className={`w-4 h-4 flex-shrink-0 ${todayCount > 0 && currentView !== 'today' ? "text-green-600" : ""}`} />
              <span className="truncate">Uploaded Today</span>
              {todayCount > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  currentView === 'today'
                    ? "bg-green-200 text-green-900"
                    : "bg-green-500 text-white"
                }`}>
                  {todayCount} new
                </span>
              )}
            </button>

            {/* Recent Uploads */}
            <button
              onClick={() => handleViewSelect('recent')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                currentView === 'recent'
                  ? "bg-blue-100 text-blue-800"
                  : "hover:bg-white text-gray-700"
              }`}
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Recent (7 days)</span>
              {recentCount > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                  currentView === 'recent'
                    ? "bg-blue-200 text-blue-900"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {recentCount}
                </span>
              )}
            </button>
            
            {/* All Documents */}
            <button
              onClick={() => handleViewSelect('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                currentView === 'all'
                  ? "bg-purple-100 text-purple-800"
                  : "hover:bg-white text-gray-700"
              }`}
            >
              <Files className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">All Documents</span>
              {totalDocCount > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                  currentView === 'all'
                    ? "bg-purple-200 text-purple-900"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {totalDocCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Folders Section */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-600 uppercase">Folders</div>
          <div className="space-y-1">
            {loading ? (
              <FolderSkeleton count={8} />
            ) : (
              <>
                {/* Uncategorized files (root folder) */}
                <button
                  onClick={() => handleFolderSelect("")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    isUncategorizedSelected
                      ? "bg-amber-100 text-amber-800"
                      : "hover:bg-white text-gray-700"
                  }`}
                >
                  <Inbox className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Uncategorized</span>
                  {uncategorizedCount > 0 && (
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                      isUncategorizedSelected
                        ? "bg-amber-200 text-amber-900"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {uncategorizedCount}
                    </span>
                  )}
                </button>
                
                {/* Divider if there are folders */}
                {folderTree.length > 0 && (
                  <div className="border-t border-gray-200 my-2" />
                )}
                
                {/* Folder tree */}
                {folderTree.length === 0 ? (
                  <div className="text-xs text-gray-500 pl-3">No folders yet.</div>
                ) : (
                  folderTree.map((folder) => (
                    <FolderItem
                      key={folder.path}
                      folder={folder}
                      level={0}
                      currentPrefix={currentPrefix}
                      onFolderSelect={handleFolderSelect}
                      onFolderRename={onFolderRename}
                      onFolderDelete={onFolderDelete}
                      expandedFolders={expandedFolders}
                      toggleFolder={toggleFolder}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

