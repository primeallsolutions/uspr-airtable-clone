import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
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
  loading?: boolean;
};

const FolderItem = ({
  folder,
  level = 0,
  currentPrefix,
  onFolderSelect,
  expandedFolders,
  toggleFolder,
}: {
  folder: FolderNode;
  level?: number;
  currentPrefix: string;
  onFolderSelect: (folder: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}) => {
  const isExpanded = expandedFolders.has(folder.path);
  const isSelected = currentPrefix === folder.path || currentPrefix.startsWith(folder.path + "/");
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            toggleFolder(folder.path);
          }
          onFolderSelect(folder.path);
        }}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
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
          <div className="w-4 h-4 flex-shrink-0" /> // Spacer for alignment
        )}
        <span className="truncate">{folder.name}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.path}
              folder={child}
              level={level + 1}
              currentPrefix={currentPrefix}
              onFolderSelect={onFolderSelect}
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
        currentPath += (currentPath ? "/" : "") + part + "/";
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

