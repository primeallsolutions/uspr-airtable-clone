import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreVertical, Pencil, Trash2, Inbox, Clock, Files, CalendarPlus, Home, ChevronsRight, AlertCircle, PenTool, Bell, GripVertical } from "lucide-react";
import { FolderSkeleton } from "./DocumentsSkeleton";
import type { DocumentStatus } from "./DocumentStatusBadge";

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

// Pending action item type
type PendingActionItem = {
  id: string;
  type: "pending_signature" | "awaiting_review" | "incomplete_request";
  label: string;
  documentPath: string;
  documentName: string;
  count?: number;
};

// Drag and drop data types
type FolderDragData = {
  type: "folder";
  path: string;
  name: string;
  parent_path: string | null;
};

type DocumentDragData = {
  type: "document";
  path: string;
  name: string;
};

type DragData = FolderDragData | DocumentDragData;

type DocumentsSidebarProps = {
  folderTree: FolderNode[];
  currentPrefix: string;
  onFolderSelect: (folder: string) => void;
  onFolderRename?: (folderPath: string, folderName: string) => void;
  onFolderDelete?: (folderPath: string, folderName: string) => void;
  onFolderMove?: (sourcePath: string, targetParentPath: string) => Promise<void>;
  onDocumentMove?: (documentPath: string, targetFolderPath: string) => Promise<void>;
  loading?: boolean;
  uncategorizedCount?: number; // Count of files in root (no folder)
  recentCount?: number;        // Count of recent uploads (last 7 days)
  totalDocCount?: number;      // Total document count
  todayCount?: number;         // Count of files uploaded today
  currentView?: DocumentView;  // Current active view
  onViewChange?: (view: DocumentView) => void;  // Handler for view changes
  // Recent folders for quick navigation
  recentFolders?: string[];
  // Pending actions
  pendingSignatures?: number;  // Count of documents awaiting signature
  pendingReviews?: number;     // Count of documents needing review
  onPendingClick?: (type: "signatures" | "reviews") => void;
};

const FolderItem = ({
  folder,
  level = 0,
  currentPrefix,
  onFolderSelect,
  onFolderRename,
  onFolderDelete,
  onFolderMove,
  onDocumentMove,
  expandedFolders,
  toggleFolder,
  draggingItem,
  setDraggingItem,
}: {
  folder: FolderNode;
  level?: number;
  currentPrefix: string;
  onFolderSelect: (folder: string) => void;
  onFolderRename?: (folderPath: string, folderName: string) => void;
  onFolderDelete?: (folderPath: string, folderName: string) => void;
  onFolderMove?: (sourcePath: string, targetParentPath: string) => Promise<void>;
  onDocumentMove?: (documentPath: string, targetFolderPath: string) => Promise<void>;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  draggingItem: DragData | null;
  setDraggingItem: (item: DragData | null) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedFolders.has(folder.path);
  const isSelected = currentPrefix === folder.path || currentPrefix.startsWith(folder.path + "/");
  const hasChildren = folder.children.length > 0;
  const isDragging = draggingItem?.type === "folder" && draggingItem.path === folder.path;

  // Check if this folder can accept the drop (not itself or its children for folders)
  const canAcceptDrop = useMemo(() => {
    if (!draggingItem) return false;
    
    if (draggingItem.type === "folder") {
      // Can't drop folder on itself
      if (draggingItem.path === folder.path) return false;
      // Can't drop folder on a descendant (would create circular reference)
      if (folder.path.startsWith(draggingItem.path)) return false;
      // Can't drop on current parent (no change)
      if (draggingItem.parent_path === folder.path) return false;
    }
    
    if (draggingItem.type === "document") {
      // Check if document is already in this folder
      const docFolder = draggingItem.path.substring(0, draggingItem.path.lastIndexOf("/") + 1);
      if (docFolder === folder.path) return false;
    }
    
    return true;
  }, [draggingItem, folder.path]);

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

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const dragData: FolderDragData = {
      type: "folder",
      path: folder.path,
      name: folder.name,
      parent_path: folder.parent_path,
    };
    e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "move";
    
    // Set a custom drag image
    if (dragRef.current) {
      e.dataTransfer.setDragImage(dragRef.current, 10, 10);
    }
    
    // Delay setting dragging state to allow drag image to be captured
    setTimeout(() => {
      setDraggingItem(dragData);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if there's drag data
    const hasData = e.dataTransfer.types.includes("text/plain") || 
                    e.dataTransfer.types.includes("application/json");
    
    if (hasData && canAcceptDrop) {
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    } else if (hasData) {
      e.dataTransfer.dropEffect = "none";
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canAcceptDrop) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag over if we're actually leaving this element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
      if (!jsonData) return;
      
      const data = JSON.parse(jsonData) as DragData;
      
      if (data.type === "folder" && onFolderMove && canAcceptDrop) {
        setIsMoving(true);
        // Move the dropped folder into this folder (this folder becomes the parent)
        await onFolderMove(data.path, folder.path);
      } else if (data.type === "document" && onDocumentMove && canAcceptDrop) {
        setIsMoving(true);
        // Move the document into this folder
        await onDocumentMove(data.path, folder.path);
      }
    } catch (err) {
      console.error("Failed to process drop:", err);
    } finally {
      setIsMoving(false);
      setDraggingItem(null);
    }
  };

  return (
    <div className="group relative">
      <div
        ref={dragRef}
        className={`flex items-center transition-all duration-200 rounded-lg ${
          isDragOver && canAcceptDrop
            ? "bg-blue-100 ring-2 ring-blue-400 ring-inset scale-[1.02]"
            : ""
        } ${isDragging ? "opacity-40 scale-95" : ""} ${isMoving ? "opacity-70 animate-pulse" : ""}`}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag handle - always visible to indicate draggable */}
        <div 
          className="pl-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors"
          style={{ paddingLeft: `${0.25 + level * 0.5}rem` }}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleFolder(folder.path);
            }
            onFolderSelect(folder.path);
          }}
          className={`flex-1 text-left px-2 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isSelected
              ? "bg-blue-100 text-blue-800"
              : "hover:bg-white text-gray-700"
          }`}
        >
          {hasChildren ? (
            <>
              <span onClick={(e) => { e.stopPropagation(); toggleFolder(folder.path); }}>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 flex-shrink-0 text-amber-500" />
              ) : (
                <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
              )}
            </>
          ) : (
            <>
              <div className="w-4 h-4 flex-shrink-0" />
              <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
            </>
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
        <div className="ml-2 border-l border-gray-200">
          {folder.children.map((child) => (
            <FolderItem
              key={child.path}
              folder={child}
              level={level + 1}
              currentPrefix={currentPrefix}
              onFolderSelect={onFolderSelect}
              onFolderRename={onFolderRename}
              onFolderDelete={onFolderDelete}
              onFolderMove={onFolderMove}
              onDocumentMove={onDocumentMove}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              draggingItem={draggingItem}
              setDraggingItem={setDraggingItem}
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
  onFolderMove,
  onDocumentMove,
  loading = false,
  uncategorizedCount = 0,
  recentCount = 0,
  totalDocCount = 0,
  todayCount = 0,
  currentView = 'folder',
  onViewChange,
  recentFolders = [],
  pendingSignatures = 0,
  pendingReviews = 0,
  onPendingClick,
}: DocumentsSidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showBreadcrumbDropdown, setShowBreadcrumbDropdown] = useState(false);
  const [draggingItem, setDraggingItem] = useState<DragData | null>(null);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [isUncategorizedDragOver, setIsUncategorizedDragOver] = useState(false);
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
        {/* Needs Attention Section */}
        {(pendingSignatures > 0 || pendingReviews > 0) && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1.5">
              <Bell className="w-3 h-3" />
              Needs Attention
            </div>
            <div className="space-y-1">
              {/* Pending Signatures */}
              {pendingSignatures > 0 && (
                <button
                  onClick={() => onPendingClick?.("signatures")}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 hover:from-purple-100 hover:to-violet-100 border border-purple-200"
                >
                  <PenTool className="w-4 h-4 flex-shrink-0 text-purple-600" />
                  <span className="truncate">Awaiting Signature</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500 text-white font-semibold">
                    {pendingSignatures}
                  </span>
                </button>
              )}
              
              {/* Pending Reviews (recently uploaded, not categorized) */}
              {pendingReviews > 0 && (
                <button
                  onClick={() => onPendingClick?.("reviews")}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 hover:from-amber-100 hover:to-orange-100 border border-amber-200"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                  <span className="truncate">Needs Review</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white font-semibold">
                    {pendingReviews}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

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
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                currentView === 'today'
                  ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 ring-2 ring-green-300"
                  : todayCount > 0
                    ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 border border-green-200 shadow-sm"
                    : "hover:bg-white text-gray-700"
              }`}
            >
              <div className={`p-1 rounded ${todayCount > 0 ? "bg-green-500 text-white" : ""}`}>
                <CalendarPlus className={`w-4 h-4 flex-shrink-0 ${todayCount > 0 && currentView !== 'today' ? "" : ""}`} />
              </div>
              <span className="truncate">Uploaded Today</span>
              {todayCount > 0 && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
                  currentView === 'today'
                    ? "bg-green-200 text-green-900"
                    : "bg-green-500 text-white animate-pulse"
                }`}>
                  {todayCount} NEW
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
          <div className="text-xs font-semibold text-gray-600 uppercase flex items-center justify-between">
            <span>Folders</span>
            {draggingItem && (
              <span className="text-blue-600 font-normal normal-case animate-pulse">
                Drop to move
              </span>
            )}
          </div>
          <div className="space-y-1">
            {loading ? (
              <FolderSkeleton count={8} />
            ) : (
              <>
                {/* Root drop zone - shows when dragging a nested folder */}
                {draggingItem?.type === "folder" && (draggingItem as FolderDragData).parent_path && onFolderMove && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-2 text-center text-xs transition-all cursor-pointer ${
                      isRootDragOver
                        ? "border-blue-400 bg-blue-50 text-blue-700 scale-[1.02]"
                        : "border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      setIsRootDragOver(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsRootDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsRootDragOver(false);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsRootDragOver(false);
                      try {
                        const jsonData = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                        const data = JSON.parse(jsonData) as DragData;
                        if (data.type === "folder" && (data as FolderDragData).parent_path) {
                          await onFolderMove(data.path, "");
                        }
                      } catch (err) {
                        console.error("Failed to process drop:", err);
                      }
                      setDraggingItem(null);
                    }}
                  >
                    <Home className="w-4 h-4 mx-auto mb-1" />
                    Drop here to move to root level
                  </div>
                )}

                {/* Uncategorized files (root folder) - also a drop target for documents */}
                <div
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    isUncategorizedDragOver && draggingItem?.type === "document"
                      ? "bg-blue-100 ring-2 ring-blue-400 scale-[1.02]"
                      : isUncategorizedSelected
                        ? "bg-amber-100 text-amber-800"
                        : "hover:bg-white text-gray-700"
                  }`}
                  onClick={() => handleFolderSelect("")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggingItem?.type === "document") {
                      e.dataTransfer.dropEffect = "move";
                      setIsUncategorizedDragOver(true);
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggingItem?.type === "document") {
                      setIsUncategorizedDragOver(true);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsUncategorizedDragOver(false);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsUncategorizedDragOver(false);
                    try {
                      const jsonData = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                      const data = JSON.parse(jsonData) as DragData;
                      if (data.type === "document" && onDocumentMove) {
                        await onDocumentMove(data.path, "");
                      }
                    } catch (err) {
                      console.error("Failed to process drop:", err);
                    }
                    setDraggingItem(null);
                  }}
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
                </div>
                
                {/* Divider if there are folders */}
                {folderTree.length > 0 && (
                  <div className="border-t border-gray-200 my-2" />
                )}
                
                {/* Drag hint when dragging */}
                {draggingItem && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg mb-2 flex items-center gap-2">
                    <GripVertical className="w-3 h-3" />
                    <span>
                      {draggingItem.type === "folder" 
                        ? `Moving folder "${draggingItem.name}"` 
                        : `Moving file "${draggingItem.name}"`}
                    </span>
                  </div>
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
                      onFolderMove={onFolderMove}
                      onDocumentMove={onDocumentMove}
                      expandedFolders={expandedFolders}
                      toggleFolder={toggleFolder}
                      draggingItem={draggingItem}
                      setDraggingItem={setDraggingItem}
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

// Export the drag data type for use in other components
export type { DragData, DocumentDragData, FolderDragData };

