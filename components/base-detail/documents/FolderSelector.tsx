"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, ChevronRight, Check } from "lucide-react";
import { DocumentsService } from "@/lib/services/documents-service";

type FolderNode = {
  name: string;
  path: string;
  parent_path: string | null;
  children: FolderNode[];
};

type FolderSelectorProps = {
  baseId: string;
  tableId?: string | null;
  selectedPath: string;
  onSelect: (path: string) => void;
};

export const FolderSelector = ({ baseId, tableId, selectedPath, onSelect }: FolderSelectorProps) => {
  const [folders, setFolders] = useState<Array<{ name: string; path: string; parent_path: string | null }>>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      const allFolders = await DocumentsService.listFolders(baseId, tableId || null, null, true);
      setFolders(allFolders);
    } catch (err) {
      console.error("Failed to load folders", err);
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

  useEffect(() => {
    loadFolders();
  }, [baseId, tableId, loadFolders]);

  const buildFolderTree = (): FolderNode[] => {
    const folderMap = new Map<string, FolderNode>();
    const rootFolders: FolderNode[] = [];

    // Create nodes
    folders.forEach((folder) => {
      folderMap.set(folder.path, {
        name: folder.name,
        path: folder.path,
        parent_path: folder.parent_path,
        children: [],
      });
    });

    // Build tree
    folderMap.forEach((folder) => {
      if (folder.parent_path === null || folder.parent_path === "") {
        rootFolders.push(folder);
      } else {
        const parent = folderMap.get(folder.parent_path);
        if (parent) {
          parent.children.push(folder);
        } else {
          rootFolders.push(folder); // Orphan folder
        }
      }
    });

    // Sort children
    const sortFolders = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => sortFolders(node.children));
    };
    sortFolders(rootFolders);

    return rootFolders;
  };

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

  const FolderItem = ({ folder, level = 0 }: { folder: FolderNode; level?: number }) => {
    const isExpanded = expandedFolders.has(folder.path);
    const isSelected = selectedPath === folder.path;

    return (
      <div>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
            isSelected ? "bg-blue-50 text-blue-700" : ""
          }`}
          style={{ paddingLeft: `${level * 1 + 0.5}rem` }}
          onClick={() => onSelect(folder.path)}
        >
          {folder.children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.path);
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            </button>
          )}
          {folder.children.length === 0 && <div className="w-4" />}
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm truncate flex-1">{folder.name}</span>
          {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
        </div>
        {isExpanded && folder.children.length > 0 && (
          <div>
            {folder.children.map((child) => (
              <FolderItem key={child.path} folder={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const folderTree = buildFolderTree();

  return (
    <div className="border border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto">
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-600 uppercase mb-2 px-2">Select Folder</div>
        {loading ? (
          <div className="text-xs text-gray-500 px-2">Loading folders...</div>
        ) : folderTree.length === 0 ? (
          <div className="text-xs text-gray-500 px-2">No folders available.</div>
        ) : (
          <div>
            {folderTree.map((folder) => (
              <FolderItem key={folder.path} folder={folder} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


