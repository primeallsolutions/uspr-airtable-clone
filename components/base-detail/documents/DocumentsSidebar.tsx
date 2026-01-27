import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { FolderSkeleton } from "./DocumentsSkeleton";

type FolderNode = {
  name: string;
  path: string;
  parent_path: string | null;
  children: FolderNode[];
};

type DocumentsSidebarProps = {
  folderTree: FolderNode[];
  currentPrefix: string;
  onFolderSelect: (folder: string) => void;
  onFolderRename?: (folderPath: string, folderName: string) => void;
  onFolderDelete?: (folderPath: string, folderName: string) => void;
  loading?: boolean;
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
}: DocumentsSidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand folders that contain the current prefix
  useEffect(() => {
    if (currentPrefix) {
      const parts = currentPrefix.split("/").filter(Boolean);
      const pathsToExpand = new Set<string>();
      let currentPath = "";
      parts.forEach((part) => {
        currentPath += part + "/";
        pathsToExpand.add(currentPath);
      });
      setExpandedFolders(pathsToExpand);
    }
  }, [currentPrefix]);

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

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0 overflow-y-auto">
      <div className="p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-600 uppercase">Folders</div>
        <div className="space-y-1">
          {loading ? (
            <FolderSkeleton count={8} />
          ) : folderTree.length === 0 ? (
            <div className="text-xs text-gray-500">No folders yet.</div>
          ) : (
            folderTree.map((folder) => (
              <FolderItem
                key={folder.path}
                folder={folder}
                level={0}
                currentPrefix={currentPrefix}
                onFolderSelect={onFolderSelect}
                onFolderRename={onFolderRename}
                onFolderDelete={onFolderDelete}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

