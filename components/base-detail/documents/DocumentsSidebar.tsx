import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreVertical, Pencil, Trash2, Inbox, Clock, Files, CalendarPlus, Home, ChevronsRight } from "lucide-react";
import { FolderSkeleton } from "./DocumentsSkeleton";

type FolderNode = {
  name: string;
  path: string;
  parent_path: string | null;
  children: FolderNode[];
};

export type DocumentView = 'recent' | 'all' | 'folder' | 'today';

type BreadcrumbItem = {
  name: string;
  path: string;
};

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
  // Recent folders for quick navigation
  recentFolders?: string[];
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
  recentFolders = [],
}: DocumentsSidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showBreadcrumbDropdown, setShowBreadcrumbDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build breadcrumb trail from current prefix
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    if (!currentPrefix || currentView !== 'folder') return [];
    
    const parts = currentPrefix.split("/").filter(Boolean);
    const items: BreadcrumbItem[] = [];
    let cumulativePath = "";
    
    parts.forEach((part) => {
      cumulativePath += part + "/";
      items.push({
        name: part,
        path: cumulativePath,
      });
    });
    
    return items;
  }, [currentPrefix, currentView]);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBreadcrumbDropdown(false);
      }
    };

    if (showBreadcrumbDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showBreadcrumbDropdown]);

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

  // Handle breadcrumb click
  const handleBreadcrumbClick = (path: string) => {
    handleFolderSelect(path);
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0 overflow-y-auto flex flex-col">
      {/* Breadcrumb Navigation */}
      {currentView === 'folder' && breadcrumbs.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-1 text-xs">
            {/* Home/Root button */}
            <button
              onClick={() => handleFolderSelect("")}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500"
              title="Root folder"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
            
            <ChevronsRight className="w-3 h-3 text-gray-400" />
            
            {/* If too many breadcrumbs, show dropdown */}
            {breadcrumbs.length > 2 ? (
              <>
                {/* Dropdown for middle breadcrumbs */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowBreadcrumbDropdown(!showBreadcrumbDropdown)}
                    className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    ...
                  </button>
                  {showBreadcrumbDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                      {breadcrumbs.slice(0, -1).map((crumb, idx) => (
                        <button
                          key={crumb.path}
                          onClick={() => {
                            handleBreadcrumbClick(crumb.path);
                            setShowBreadcrumbDropdown(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          style={{ paddingLeft: `${0.75 + idx * 0.5}rem` }}
                        >
                          <Folder className="w-3 h-3 text-gray-400" />
                          {crumb.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronsRight className="w-3 h-3 text-gray-400" />
                
                {/* Last breadcrumb (current folder) */}
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium truncate max-w-[100px]">
                  {breadcrumbs[breadcrumbs.length - 1].name}
                </span>
              </>
            ) : (
              /* Show all breadcrumbs if <= 2 */
              breadcrumbs.map((crumb, idx) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  {idx > 0 && <ChevronsRight className="w-3 h-3 text-gray-400" />}
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium truncate max-w-[100px]">
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBreadcrumbClick(crumb.path)}
                      className="px-1.5 py-0.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors truncate max-w-[80px]"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
      )}
      
      <div className="p-3 space-y-4 flex-1 overflow-y-auto">
        {/* Recent Folders Section (if any) */}
        {recentFolders.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600 uppercase">Recent Folders</div>
            <div className="space-y-1">
              {recentFolders.slice(0, 3).map((folder) => {
                const folderName = folder.split("/").filter(Boolean).pop() || "Root";
                return (
                  <button
                    key={folder}
                    onClick={() => handleFolderSelect(folder)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                      currentPrefix === folder && currentView === 'folder'
                        ? "bg-gray-200 text-gray-800"
                        : "hover:bg-white text-gray-600"
                    }`}
                  >
                    <Clock className="w-3 h-3 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{folderName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
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

