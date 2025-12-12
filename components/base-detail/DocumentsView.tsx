import { useMemo, useState, useEffect, useCallback } from "react";
import type { TableRow } from "@/lib/types/base-detail";
import { DocumentsService, type StoredDocument } from "@/lib/services/documents-service";
import { DocumentsHeader } from "./documents/DocumentsHeader";
import { DocumentsSidebar } from "./documents/DocumentsSidebar";
import { DocumentsList } from "./documents/DocumentsList";
import { DocumentPreview } from "./documents/DocumentPreview";
import { PlateEditor } from "./documents/PlateEditor";
import { PdfEditor } from "./documents/PdfEditor";
import { isFolder, isPdf } from "./documents/utils";

type DocumentsViewProps = {
  baseId: string;
  baseName?: string;
  selectedTable?: TableRow | null;
};

export const DocumentsView = ({ baseId, baseName = "Base", selectedTable }: DocumentsViewProps) => {
  const prefixLabel = useMemo(() => {
    return selectedTable ? `${baseName} / ${selectedTable.name}` : baseName;
  }, [baseName, selectedTable]);

  const [allDocs, setAllDocs] = useState<StoredDocument[]>([]);
  const [rawDocs, setRawDocs] = useState<StoredDocument[]>([]);
  const [folderPath, setFolderPath] = useState<string>("");
  const [selectedDocPath, setSelectedDocPath] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [defaultFolderEnsured, setDefaultFolderEnsured] = useState<boolean>(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [dbFolders, setDbFolders] = useState<Array<{ name: string; path: string; parent_path: string | null }>>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [editorDoc, setEditorDoc] = useState<StoredDocument | null>(null);
  const [editorSignedUrl, setEditorSignedUrl] = useState<string | null>(null);

  const currentPrefix = useMemo(
    () => (folderPath && !folderPath.endsWith("/") ? `${folderPath}/` : folderPath),
    [folderPath]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load documents and folders in parallel
      const [docs, folders] = await Promise.all([
        DocumentsService.listDocuments(baseId, selectedTable?.id),
        DocumentsService.listFolders(baseId, selectedTable?.id ?? null, null, true).catch(() => []), // Include all folders for tree building
      ]);

      setRawDocs(docs);
      setDbFolders(folders);

      // Filter out all folder representations (.keep files and trailing slashes)
      const filtered = docs.filter((doc) => !isFolder(doc));
      setAllDocs(filtered);

      // Validate selectedDocPath - clear it if it's a folder or no longer exists
      if (selectedDocPath) {
        const selectedDoc = filtered.find((d) => d.path === selectedDocPath);
        if (!selectedDoc || isFolder(selectedDoc)) {
          setSelectedDocPath(null);
          setSignedUrl(null);
          setViewerError(null);
        }
        // Don't auto-select a new file if the current selection is invalid
      }
      // Don't auto-select first document when folder changes or on initial load
    } catch (err) {
      console.error("Failed to load documents", err);
      setError("Unable to load documents");
    } finally {
      setLoading(false);
      // Mark initial load as complete after first successful load
      setIsInitialLoad((prev) => {
        if (prev) return false;
        return prev;
      });
    }
  }, [baseId, selectedTable?.id, selectedDocPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setFolderPath("");
    setSelectedDocPath(null);
    setIsInitialLoad(true); // Reset initial load state when base/table changes
  }, [baseId, selectedTable?.id]);

  const handleAddFolder = async () => {
    const name = window.prompt("Folder name?");
    if (!name) return;
    try {
      await DocumentsService.createFolder(baseId, selectedTable?.id ?? null, currentPrefix, name);
      await refresh();
      setFolderPath(currentPrefix + name + "/");
    } catch (err) {
      console.error("Failed to create folder", err);
      alert("Unable to create folder");
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    try {
      const arr = Array.from(files);
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        await DocumentsService.uploadDocument({
          baseId,
          tableId: selectedTable?.id,
          folderPath: currentPrefix,
          file,
        });
        setUploadProgress({ current: i + 1, total: arr.length });
      }
      await refresh();
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDropUpload = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      await handleUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const visibleDocs = useMemo(() => {
    const prefixLen = currentPrefix.length;
    return allDocs
      .filter((doc) => {
        // Only include files, not folders
        if (isFolder(doc)) return false;
        // Only include files in the current folder (not subfolders)
        if (!doc.path.startsWith(currentPrefix)) return false;
        const relative = doc.path.slice(prefixLen);
        return !relative.includes("/"); // Exclude files in subfolders
      })
      .map((doc) => {
        const relative = doc.path.slice(prefixLen);
        return { ...doc, relative };
      });
  }, [allDocs, currentPrefix]);

  // Build folder tree structure
  const folderTree = useMemo(() => {
    if (dbFolders.length === 0) return [];
    
    // Normalize paths to ensure consistent matching (ensure trailing slash)
    const normalizePath = (path: string | null): string | null => {
      if (!path) return null;
      return path.endsWith("/") ? path : `${path}/`;
    };
    
    // Build a map of folders by path
    const folderMap = new Map<string, { name: string; path: string; parent_path: string | null; children: any[] }>();
    
    // First pass: create all folder nodes with normalized paths
    dbFolders.forEach((folder) => {
      const normalizedPath = normalizePath(folder.path)!;
      const normalizedParentPath = normalizePath(folder.parent_path);
      folderMap.set(normalizedPath, {
        name: folder.name,
        path: normalizedPath,
        parent_path: normalizedParentPath,
        children: []
      });
    });
    
    // Second pass: build tree structure
    const rootFolders: any[] = [];
    folderMap.forEach((folder) => {
      if (!folder.parent_path) {
        rootFolders.push(folder);
      } else {
        const parent = folderMap.get(folder.parent_path);
        if (parent) {
          parent.children.push(folder);
        } else {
          // Parent not found, treat as root (might happen if parent folder was deleted)
          console.warn(`Parent folder not found for: ${folder.path}, parent_path: ${folder.parent_path}`);
          rootFolders.push(folder);
        }
      }
    });
    
    // Sort folders recursively
    const sortFolders = (folders: any[]) => {
      folders.sort((a, b) => a.name.localeCompare(b.name));
      folders.forEach((folder) => {
        if (folder.children.length > 0) {
          sortFolders(folder.children);
        }
      });
    };
    
    sortFolders(rootFolders);
    return rootFolders;
  }, [dbFolders]);

  const rootFolders = useMemo(() => {
    // For backward compatibility, also return flat list of root folder names
    if (dbFolders.length > 0) {
      return dbFolders
        .filter((folder) => {
          // Only include root folders (parent_path is null or empty, or path has no parent segments)
          const pathParts = folder.path.split("/").filter(Boolean);
          return pathParts.length === 1; // Root folders have only one segment
        })
        .map((folder) => folder.name)
        .sort();
    }

    // Fallback: extract folders from storage listings
    const set = new Set<string>();

    // Extract folders from .keep files (folder markers)
    rawDocs.forEach((doc) => {
      // Check if this is a folder marker file
      if (!isFolder(doc)) return;

      // Handle folder path formats:
      // - "Documents/.keep" -> "Documents"
      // - "folderName/.keep" -> "folderName"
      let folderPath = doc.path;

      // Remove .keep suffix if present
      if (folderPath.endsWith("/.keep")) {
        folderPath = folderPath.slice(0, -5); // Remove "/.keep"
      } else if (folderPath.endsWith(".keep")) {
        folderPath = folderPath.slice(0, -5); // Remove ".keep"
      }

      // Remove trailing slash if present
      if (folderPath.endsWith("/")) {
        folderPath = folderPath.slice(0, -1);
      }

      // Extract the root folder name (first segment only, for root folders)
      const parts = folderPath.split("/").filter(Boolean);
      if (parts.length > 0) {
        const rootFolderName = parts[0];
        // Only add if it's a root-level folder (single segment) and not ".keep"
        if (rootFolderName && rootFolderName !== ".keep" && parts.length === 1) {
          set.add(rootFolderName);
        }
      }
    });

    // Also detect folders from file paths (if a file is in a subdirectory, that subdirectory is a folder)
    rawDocs.forEach((doc) => {
      // Skip folder markers (already processed above)
      if (isFolder(doc)) return;

      // Extract root folder from file paths like "Documents/file.pdf" -> "Documents"
      const parts = doc.path.split("/").filter(Boolean);
      if (parts.length > 1) {
        // File is in a subdirectory, so the first part is a folder
        const rootFolderName = parts[0];
        if (rootFolderName) {
          set.add(rootFolderName);
        }
      }
    });

    return Array.from(set).sort();
  }, [dbFolders, rawDocs]);

  // Default folders to create if none exist
  const defaultFolders = useMemo(
    () => [
      "Contract",
      "Buyer docs",
      "Seller docs",
      "HOA",
      "Lender docs",
      "Title",
      "Inspection",
      "Appraisal",
      "Insurance",
      "Closing",
    ],
    []
  );

  // Ensure default folders exist if none are present
  useEffect(() => {
    const ensureDefaultFolders = async () => {
      if (defaultFolderEnsured) return;
      if (rootFolders.length > 0) {
        setDefaultFolderEnsured(true);
        return;
      }
      try {
        // Create all default folders
        for (const folderName of defaultFolders) {
          try {
            await DocumentsService.createFolder(baseId, selectedTable?.id ?? null, "", folderName);
          } catch (err) {
            console.error(`Failed to create default folder "${folderName}"`, err);
            // Continue creating other folders even if one fails
          }
        }
        setDefaultFolderEnsured(true);
        await refresh();
      } catch (err) {
        console.error("Failed to ensure default folders", err);
        setDefaultFolderEnsured(true);
      }
    };
    ensureDefaultFolders();
  }, [baseId, selectedTable?.id, rootFolders.length, defaultFolderEnsured, refresh, defaultFolders]);

  // Auto-select the first folder when none selected
  useEffect(() => {
    if (!folderPath && rootFolders.length > 0) {
      setFolderPath(`${rootFolders[0]}/`);
      setSelectedDocPath(null);
    }
  }, [folderPath, rootFolders]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocPath) return null;
    const doc = allDocs.find((d) => d.path === selectedDocPath);
    // Ensure selected document is not a folder
    if (!doc || isFolder(doc)) {
      return null;
    }
    return doc;
  }, [selectedDocPath, allDocs]);

  useEffect(() => {
    let active = true;
    const loadUrl = async () => {
      if (!selectedDoc) {
        setSignedUrl(null);
        setViewerError(null);
        return;
      }

      // Double-check: if somehow a folder got through, don't try to load it
      if (isFolder(selectedDoc)) {
        if (active) {
          setSignedUrl(null);
          setViewerError("This is a folder. Please select a file to preview.");
        }
        return;
      }

      try {
        const url = await DocumentsService.getSignedUrl(
          baseId,
          selectedTable?.id ?? null,
          selectedDoc.path
        );
        if (active) {
          setSignedUrl(url);
          setViewerError(null);
        }
      } catch (err: any) {
        console.error("Failed to get signed URL", err);
        if (active) {
          setSignedUrl(null);
          // Improved error handling for "Object not found" errors
          if (err?.message?.includes("Object not found") || err?.statusCode === 404) {
            setViewerError("File not found. It may have been deleted or moved.");
          } else {
            setViewerError("Unable to load file preview. Please try again.");
          }
        }
      }
    };
    loadUrl();
    return () => {
      active = false;
    };
  }, [selectedDoc, baseId, selectedTable?.id]);

  const handleDeleteSelected = async () => {
    if (!selectedDoc || isFolder(selectedDoc)) return;
    const confirmDelete = window.confirm(
      `Delete "${selectedDoc.path.split("/").pop()}"? This cannot be undone.`
    );
    if (!confirmDelete) return;
    try {
      await DocumentsService.deleteDocument(baseId, selectedTable?.id ?? null, selectedDoc.path);
      setSelectedDocPath(null);
      await refresh();
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Unable to delete document");
    }
  };

  const handleRenameSelected = async () => {
    if (!selectedDoc || isFolder(selectedDoc)) return;
    const currentName = selectedDoc.path.split("/").pop() || selectedDoc.path;
    const newName = window.prompt("New file name", currentName);
    if (!newName || newName === currentName) return;
    const basePath = selectedDoc.path.slice(0, selectedDoc.path.lastIndexOf("/") + 1);
    const newRelative = `${basePath}${newName}`;
    try {
      await DocumentsService.renameDocument(
        baseId,
        selectedTable?.id ?? null,
        selectedDoc.path,
        newRelative
      );
      setSelectedDocPath(newRelative);
      await refresh();
    } catch (err) {
      console.error("Failed to rename document", err);
      alert("Unable to rename document");
    }
  };

  const handleFolderSelect = (folder: string) => {
    setFolderPath(folder);
    setSelectedDocPath(null);
  };

  const handleDocumentEdit = async (doc: StoredDocument & { relative: string }) => {
    try {
      // Get signed URL for the document to edit
      const url = await DocumentsService.getSignedUrl(
        baseId,
        selectedTable?.id ?? null,
        doc.path
      );
      setEditorDoc(doc);
      setEditorSignedUrl(url);
    } catch (err) {
      console.error("Failed to open document for editing", err);
      alert("Unable to open document for editing. Please try again.");
    }
  };

  const handleEditorClose = () => {
    setEditorDoc(null);
    setEditorSignedUrl(null);
  };

  const handleEditorSave = async (file: File) => {
    if (!editorDoc) return;
    
    try {
      // Get the original file path and name
      const originalPath = editorDoc.path;
      const originalFileName = originalPath.split("/").pop() || file.name;
      
      // Delete the old file first
      await DocumentsService.deleteDocument(baseId, selectedTable?.id ?? null, originalPath);
      
      // Upload the edited file with the SAME name (preserving original filename)
      const editedFile = new File([file], originalFileName, { type: file.type });
      
      const newPath = await DocumentsService.uploadDocument({
        baseId,
        tableId: selectedTable?.id,
        folderPath: currentPrefix,
        file: editedFile,
        preserveName: true, // Keep the original filename
      });
      
      // Refresh to show updated document
      await refresh();
      
      // Update selected document path to the new path
      const fullNewPath = currentPrefix + originalFileName;
      if (selectedDocPath === originalPath) {
        setSelectedDocPath(fullNewPath);
      }
    } catch (err) {
      console.error("Failed to save edited document", err);
      throw err; // Re-throw to let DocumentEditor handle the error
    }
  };

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm mx-6 my-4 overflow-hidden ${
        isDragging ? "border-blue-400 ring-4 ring-blue-200" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropUpload}
    >
      <DocumentsHeader
        prefixLabel={prefixLabel}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onAddFolder={handleAddFolder}
        onUpload={handleUpload}
      />

      <div className="flex flex-1 min-h-0">
        <DocumentsSidebar
          folderTree={folderTree}
          currentPrefix={currentPrefix}
          onFolderSelect={handleFolderSelect}
          loading={loading && isInitialLoad}
        />

        {/* Documents list and viewer */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
          <DocumentsList
            documents={visibleDocs}
            selectedDocPath={selectedDocPath}
            loading={loading && isInitialLoad}
            error={error}
            folderPath={folderPath}
            onDocumentSelect={setSelectedDocPath}
            onDocumentEdit={handleDocumentEdit}
          />

          <DocumentPreview
            selectedDoc={selectedDoc}
            signedUrl={signedUrl}
            viewerError={viewerError}
            onRename={handleRenameSelected}
            onDelete={handleDeleteSelected}
            loading={loading && isInitialLoad && !selectedDoc}
          />
        </div>
      </div>

      <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200 bg-white">
        Files are stored in Supabase Storage bucket:{" "}
        {process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents"}. Paths are scoped per
        base and table.
      </div>

      {/* Document Editor Modals */}
      {/* PDF Editor - Adobe Acrobat-like viewer with annotations */}
      {editorDoc && isPdf(editorDoc.mimeType) && (
        <PdfEditor
          document={editorDoc}
          signedUrl={editorSignedUrl}
          isOpen={Boolean(editorDoc)}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}
      
      {/* Plate Editor - For text-based documents */}
      {editorDoc && !isPdf(editorDoc.mimeType) && (
        <PlateEditor
          document={editorDoc}
          signedUrl={editorSignedUrl}
          isOpen={Boolean(editorDoc)}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
};
