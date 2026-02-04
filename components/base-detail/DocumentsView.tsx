import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import type { FieldRow, RecordRow, TableRow } from "@/lib/types/base-detail";
import { DocumentsService, type StoredDocument } from "@/lib/services/documents-service";
import { DocumentActivityService } from "@/lib/services/document-activity-service";
import { DocumentVersionService } from "@/lib/services/document-version-service";
import { DocumentsHeader } from "./documents/DocumentsHeader";
import { DocumentsSidebar, type DocumentView, type DocumentDragData } from "./documents/DocumentsSidebar";
import { DocumentsList } from "./documents/DocumentsList";
import { DocumentPreview } from "./documents/DocumentPreview";
import { ActivityFeed } from "./documents/ActivityFeed";
import { PdfEditor } from "./documents/pdf-editor";
import { TemplateManagementModal } from "./documents/TemplateManagementModal";
import { SignatureRequestModal } from "./documents/SignatureRequestModal";
import { SignatureRequestStatus } from "./documents/SignatureRequestStatus";
import { MergePackModal } from "./documents/MergePackModal";
import { PdfMergeWithReorderModal } from "./documents/PdfMergeWithReorderModal";
import { TemplateFieldEditor } from "./documents/TemplateFieldEditor";
import { DocumentGeneratorForm } from "./documents/DocumentGeneratorForm";
import { FolderNameModal } from "./documents/FolderNameModal";
import { RenameDocumentModal } from "./documents/RenameDocumentModal";
import { RenameFolderModal } from "./documents/RenameFolderModal";
import { DeleteFolderModal } from "./documents/DeleteFolderModal";
import { PdfSplitModal } from "./documents/PdfSplitModal";
import { AuditLogViewer } from "./documents/AuditLogViewer";
import { TransactionFolderSetupModal } from "./documents/TransactionFolderSetupModal";
import { PhotoGallery } from "./documents/PhotoGallery";
import { isFolder, isPdf } from "./documents/utils";
import { BaseDetailService } from "@/lib/services/base-detail-service";
import type { DocumentTemplate } from "@/lib/services/template-service";
import { PostActionPrompt, createUploadSuggestions } from "./documents/PostActionPrompt";
import { KeyboardShortcutsPanel, useKeyboardShortcutsPanel } from "./documents/KeyboardShortcutsPanel";

// Type for folder tree nodes
type FolderNode = {
  name: string;
  path: string;
  parent_path: string | null;
  children: FolderNode[];
};

type DocumentsViewProps = {
  baseId: string;
  baseName?: string;
  selectedTable?: TableRow | null;
  recordId?: string | null; // When provided, scopes documents to this specific record
  recordName?: string; // Display name for the record
};

export const DocumentsView = ({ baseId, baseName = "Base", selectedTable, recordId, recordName }: DocumentsViewProps) => {
  // If recordId is provided, show record context in prefix
  const prefixLabel = useMemo(() => {
    if (recordId && recordName) {
      return `${baseName}${selectedTable ? ` / ${selectedTable.name}` : ""} / ${recordName}`;
    }
    return selectedTable ? `${baseName} / ${selectedTable.name}` : baseName;
  }, [baseName, selectedTable, recordId, recordName]);

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
  const [showTemplateFieldEditor, setShowTemplateFieldEditor] = useState<boolean>(false);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState<boolean>(false);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState<boolean>(false);
  const [selectedFolder, setSelectedFolder] = useState<{ path: string; name: string } | null>(null);
  const [showSignatureRequestModal, setShowSignatureRequestModal] = useState<boolean>(false);
  const [showSignatureStatus, setShowSignatureStatus] = useState<boolean>(false);
  const [signatureRequestDoc, setSignatureRequestDoc] = useState<StoredDocument | null>(null);
  const [showMergePackModal, setShowMergePackModal] = useState<boolean>(false);
  const [showMergeWithReorderModal, setShowMergeWithReorderModal] = useState<boolean>(false);
  const [showActivityFeed, setShowActivityFeed] = useState<boolean>(true);
  const [showPdfSplitModal, setShowPdfSplitModal] = useState<boolean>(false);
  const [splitDoc, setSplitDoc] = useState<StoredDocument | null>(null);
  const [splitSignedUrl, setSplitSignedUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "photos">("documents");
  const [showAuditLog, setShowAuditLog] = useState<boolean>(false);
  const [showFolderSetup, setShowFolderSetup] = useState<boolean>(false);
  const [checkedDocuments, setCheckedDocuments] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<DocumentView>('folder');
  
  // Post-upload prompt state
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const [lastUploadedDoc, setLastUploadedDoc] = useState<StoredDocument | null>(null);
  
  // Drag and drop state for documents
  const [draggingDocument, setDraggingDocument] = useState<DocumentDragData | null>(null);

  // Keyboard shortcuts panel
  const keyboardShortcuts = useKeyboardShortcutsPanel();

  const currentPrefix = useMemo(
    () => (folderPath && !folderPath.endsWith("/") ? `${folderPath}/` : folderPath),
    [folderPath]
  );

  const [recordsData, setRecordsData] = useState<RecordRow[]>([]);
  const [tableFields, setTableFields] = useState<FieldRow[]>([]);
  useEffect(() => {
    const fetchFields = async () => {
      const [recordsData, fieldsData] = await Promise.all([
        BaseDetailService.getRecords(selectedTable?.id || ""),
        BaseDetailService.getFields(selectedTable?.id || "")
      ]);
      setRecordsData(recordsData);
      setTableFields(fieldsData);
    };
    fetchFields();
  }, [selectedTable?.id]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load documents and folders in parallel
      // When recordId is provided, use record-scoped methods
      const [docs, folders] = await Promise.all([
        DocumentsService.listDocuments(baseId, selectedTable?.id, recordId),
        recordId 
          ? DocumentsService.listRecordFolders(baseId, recordId).catch(() => [])
          : DocumentsService.listFolders(baseId, selectedTable?.id ?? null, null, true).catch(() => []), // Include all folders for tree building
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
      const errorMessage = err instanceof Error ? err.message : "Unable to load documents";
      setError(errorMessage);
      toast.error("Failed to load documents", {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
      // Mark initial load as complete after first successful load
      setIsInitialLoad((prev) => {
        if (prev) return false;
        return prev;
      });
    }
  }, [baseId, selectedTable?.id, selectedDocPath, recordId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setFolderPath("");
    setSelectedDocPath(null);
    setIsInitialLoad(true); // Reset initial load state when base/table/record changes
  }, [baseId, selectedTable?.id, recordId]);

  const handleAddFolder = () => {
    setShowFolderModal(true);
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await DocumentsService.createFolder(baseId, selectedTable?.id ?? null, currentPrefix, name, recordId);
      await refresh();
      setFolderPath(currentPrefix + name + "/");
      
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'folder_create',
        folderPath: currentPrefix + name + "/",
        documentName: name
      });
      
      toast.success("Folder created successfully", {
        description: `Folder "${name}" has been created.`,
      });
    } catch (err) {
      console.error("Failed to create folder", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to create folder";
      toast.error("Failed to create folder", {
        description: errorMessage,
      });
      throw err; // Re-throw to let modal handle it
    }
  };

  // File validation constants
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const UPLOAD_CONCURRENCY = 3; // Upload 3 files at a time

  const validateFile = (file: File): string | null => {
    if (file.size === 0) {
      return `"${file.name}" is empty`;
    }
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return `"${file.name}" is too large (${sizeMB}MB). Maximum size is 100MB`;
    }
    return null;
  };

  const uploadBatch = async (files: File[], concurrency: number): Promise<{ success: number; failed: number; errors: Array<{ file: string; error: string }> }> => {
    const results = { success: 0, failed: 0, errors: [] as Array<{ file: string; error: string }> };
    
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map(async (file) => {
        try {
        await DocumentsService.uploadDocument({
          baseId,
          tableId: selectedTable?.id,
          recordId, // Pass recordId for record-scoped uploads
          folderPath: currentPrefix,
          file,
        });
          results.success++;
          return { success: true, file: file.name };
        } catch (err) {
          results.failed++;
          const errorMessage = err instanceof Error ? err.message : "Upload failed";
          results.errors.push({ file: file.name, error: errorMessage });
          return { success: false, file: file.name, error: errorMessage };
        }
      });
      
      await Promise.all(batchPromises);
      setUploadProgress({ current: Math.min(i + concurrency, files.length), total: files.length });
    }
    
    return results;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    
    // Validate all files first
    const validationErrors: string[] = [];
    const validFiles: File[] = [];
    
    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
      } else {
        validFiles.push(file);
      }
    });
    
    // Show validation errors if any
    if (validationErrors.length > 0) {
      toast.error("Some files were skipped", {
        description: validationErrors.slice(0, 3).join(", ") + (validationErrors.length > 3 ? ` and ${validationErrors.length - 3} more` : ""),
        duration: 6000,
      });
    }
    
    if (validFiles.length === 0) {
      return;
    }
    
    setUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });
    
    const toastId = toast.loading(`Uploading ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}...`);
    
    try {
      const results = await uploadBatch(validFiles, UPLOAD_CONCURRENCY);
      
      await refresh();
      
      // Log upload activities
      for (const file of validFiles) {
        await DocumentActivityService.logActivity({
          baseId,
          tableId: selectedTable?.id,
          recordId,
          action: 'upload',
          documentPath: currentPrefix + file.name,
          documentName: file.name,
          metadata: { size: file.size, type: file.type },
        });
      }
      
      if (results.failed === 0) {
        toast.success(`Successfully uploaded ${results.success} file${results.success > 1 ? "s" : ""}`, {
          id: toastId,
        });
        
        // Show post-upload prompt for single PDF uploads
        if (results.success === 1 && validFiles[0].type === "application/pdf") {
          const uploadedFileName = validFiles[0].name;
          // Find the uploaded document in the refreshed list
          const uploadedDoc = allDocs.find(d => d.path.endsWith(uploadedFileName));
          if (uploadedDoc) {
            setLastUploadedDoc(uploadedDoc);
            setShowUploadPrompt(true);
          }
        }
      } else {
        const errorMessages = results.errors.slice(0, 3).map(e => `${e.file}: ${e.error}`).join("; ");
        toast.warning(`Uploaded ${results.success} file${results.success > 1 ? "s" : ""}, ${results.failed} failed`, {
          id: toastId,
          description: errorMessages + (results.errors.length > 3 ? ` and ${results.errors.length - 3} more errors` : ""),
          duration: 8000,
        });
      }
    } catch (err) {
      console.error("Upload failed", err);
      const errorMessage = err instanceof Error ? err.message : "Upload failed. Please try again.";
      toast.error("Upload failed", {
        id: toastId,
        description: errorMessage,
      });
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
    // For "today" view - show documents uploaded today
    if (currentView === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return allDocs
        .filter((doc) => {
          if (isFolder(doc)) return false;
          const docDate = new Date(doc.createdAt);
          docDate.setHours(0, 0, 0, 0);
          return docDate.getTime() === today.getTime();
        })
        .map((doc) => {
          // Show full path as relative name for context
          return { ...doc, relative: doc.path };
        });
    }

    // For "recent" view - show documents from last 7 days
    if (currentView === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return allDocs
        .filter((doc) => {
          if (isFolder(doc)) return false;
          return new Date(doc.createdAt) >= sevenDaysAgo;
        })
        .map((doc) => {
          // Show full path as relative name for context
          return { ...doc, relative: doc.path };
        });
    }

    // For "all" view - show all documents
    if (currentView === 'all') {
      return allDocs
        .filter((doc) => !isFolder(doc))
        .map((doc) => {
          // Show full path as relative name for context
          return { ...doc, relative: doc.path };
        });
    }

    // For "folder" view - existing behavior
    const prefixLen = currentPrefix.length;
    return allDocs
      .filter((doc) => {
        // Only include files, not folders
        if (isFolder(doc)) return false;
        
        // For root (uncategorized) - show files with no folder prefix
        if (currentPrefix === "") {
          // File is in root if it has no "/" in the path (just a filename)
          return !doc.path.includes("/");
        }
        
        // Only include files in the current folder (not subfolders)
        if (!doc.path.startsWith(currentPrefix)) return false;
        const relative = doc.path.slice(prefixLen);
        return !relative.includes("/"); // Exclude files in subfolders
      })
      .map((doc) => {
        const relative = currentPrefix === "" ? doc.path : doc.path.slice(prefixLen);
        return { ...doc, relative };
      });
  }, [allDocs, currentPrefix, currentView]);

  // Count files in root (uncategorized) - no folder prefix
  const uncategorizedCount = useMemo(() => {
    return allDocs.filter((doc) => {
      if (isFolder(doc)) return false;
      // File is in root if it has no "/" in the path (just a filename)
      return !doc.path.includes("/");
    }).length;
  }, [allDocs]);

  // Count recent uploads (last 7 days)
  const recentCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return allDocs.filter((doc) => {
      if (isFolder(doc)) return false;
      return new Date(doc.createdAt) >= sevenDaysAgo;
    }).length;
  }, [allDocs]);

  // Total document count (all files)
  const totalDocCount = useMemo(() => {
    return allDocs.filter((doc) => !isFolder(doc)).length;
  }, [allDocs]);

  // Count documents uploaded today
  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allDocs.filter((doc) => {
      if (isFolder(doc)) return false;
      const docDate = new Date(doc.createdAt);
      docDate.setHours(0, 0, 0, 0);
      return docDate.getTime() === today.getTime();
    }).length;
  }, [allDocs]);

  // Build folder tree structure
  const folderTree = useMemo((): FolderNode[] => {
    if (dbFolders.length === 0) return [];
    
    // Normalize paths to ensure consistent matching (ensure trailing slash)
    const normalizePath = (path: string | null): string | null => {
      if (!path) return null;
      return path.endsWith("/") ? path : `${path}/`;
    };
    
    // Build a map of folders by path with proper typing
    const folderMap = new Map<string, FolderNode>();
    
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
    const rootFolders: FolderNode[] = [];
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
    const sortFolders = (folders: FolderNode[]) => {
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

  // Simplified root folders - only use database folders (removed fallback logic)
  const rootFolders = useMemo(() => {
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
    return [];
  }, [dbFolders]);

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
        // Create all default folders (pass recordId if provided for record-scoped folders)
        for (const folderName of defaultFolders) {
          try {
            await DocumentsService.createFolder(baseId, selectedTable?.id ?? null, "", folderName, recordId);
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
  }, [baseId, selectedTable?.id, recordId, rootFolders.length, defaultFolderEnsured, refresh, defaultFolders]);

  // Auto-select behavior: if there are uncategorized files, stay on root
  // Otherwise, select the first folder
  useEffect(() => {
    // Only auto-select if folderPath hasn't been explicitly set yet (initial load)
    // and we're not already showing uncategorized files
    if (folderPath === "" && uncategorizedCount === 0 && rootFolders.length > 0) {
      setFolderPath(`${rootFolders[0]}/`);
      setSelectedDocPath(null);
    }
  }, [folderPath, rootFolders, uncategorizedCount]);

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
          selectedDoc.path,
          600,
          recordId
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
  }, [selectedDoc, baseId, selectedTable?.id, recordId]);

  const handleDeleteSelected = async () => {
    if (!selectedDoc || isFolder(selectedDoc)) return;
    
    const fileName = selectedDoc.path.split("/").pop() || selectedDoc.path;
    // Use browser confirm for now, but could be replaced with a confirmation modal
    const confirmDelete = window.confirm(
      `Delete "${fileName}"? This cannot be undone.`
    );
    if (!confirmDelete) return;
    
    const toastId = toast.loading(`Deleting "${fileName}"...`);
    
    try {
      await DocumentsService.deleteDocument(baseId, selectedTable?.id ?? null, selectedDoc.path, recordId);
      
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'delete',
        documentPath: selectedDoc.path,
        documentName: fileName,
      });
      
      setSelectedDocPath(null);
      await refresh();
      toast.success("Document deleted", {
        id: toastId,
        description: `"${fileName}" has been deleted.`,
      });
    } catch (err) {
      console.error("Failed to delete document", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to delete document";
      toast.error("Failed to delete document", {
        id: toastId,
        description: errorMessage,
      });
    }
  }

  const handleRenameSelected = () => {
    if (!selectedDoc || isFolder(selectedDoc)) return;
    setShowRenameModal(true);
  };

  // Handler for requesting signature from document preview
  const handleRequestSignatureForDocument = (doc: StoredDocument) => {
    setSignatureRequestDoc(doc);
    setShowSignatureRequestModal(true);
  };

  const handleDeleteChecked = async () => {
    if (checkedDocuments.length === 0) return;
    const confirmDelete = window.confirm(
      `Delete ${checkedDocuments.length} selected documents? This cannot be undone.`
    );
    if (!confirmDelete) return;
    try {
      for (const docPath of checkedDocuments)
        await DocumentsService.deleteDocument(baseId, selectedTable?.id ?? null, docPath);
      if (selectedDoc && checkedDocuments.includes(selectedDoc.path)) setSelectedDocPath(null);
      setCheckedDocuments([]);
      await refresh();
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Unable to delete document");
    }
  }

  const handleRenameDocument = async (newName: string) => {
    if (!selectedDoc || isFolder(selectedDoc)) return;
    
    const currentName = selectedDoc.path.split("/").pop() || selectedDoc.path;
    if (newName === currentName) return;
    
    const basePath = selectedDoc.path.slice(0, selectedDoc.path.lastIndexOf("/") + 1);
    const newRelative = `${basePath}${newName}`;
    
    try {
      await DocumentsService.renameDocument(
        baseId,
        selectedTable?.id ?? null,
        selectedDoc.path,
        newRelative,
        recordId
      );
      setSelectedDocPath(newRelative);
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'rename',
        documentPath: newRelative,
        documentName: newName,
        metadata: { oldName: currentName },
      });
      
      await refresh();
      toast.success("Document renamed", {
        description: `"${currentName}" has been renamed to "${newName}".`,
      });
    } catch (err) {
      console.error("Failed to rename document", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to rename document";
      toast.error("Failed to rename document", {
        description: errorMessage,
      });
      throw err; // Re-throw to let modal handle it
    }
  };

  const handleFolderSelect = (folder: string) => {
    setFolderPath(folder);
    setSelectedDocPath(null);
    setCurrentView('folder');
  };

  // Handle view changes (recent, all, folder)
  const handleViewChange = (view: DocumentView) => {
    setCurrentView(view);
    setSelectedDocPath(null);
    // For folder view, keep the current folder path; for others, it doesn't matter
  };

  const handleFolderRename = (folderPath: string, folderName: string) => {
    setSelectedFolder({ path: folderPath, name: folderName });
    setShowRenameFolderModal(true);
  };

  const handleRenameFolder = async (newName: string) => {
    if (!selectedFolder) return;
    
    const toastId = toast.loading(`Renaming folder "${selectedFolder.name}"...`);
    
    try {
      await DocumentsService.renameFolder(
        baseId,
        selectedTable?.id ?? null,
        selectedFolder.path,
        newName
      );
      
      // Update current folder path if it's the renamed folder
      if (folderPath === selectedFolder.path) {
        const parentPath = selectedFolder.path.split("/").slice(0, -1).join("/");
        const newPath = parentPath ? `${parentPath}/${newName}/` : `${newName}/`;
        setFolderPath(newPath);
      }
      
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'folder_rename',
        folderPath: selectedFolder.path,
        documentName: newName,
        metadata: { oldName: selectedFolder.name },
      });
      
      await refresh();
      toast.success("Folder renamed", {
        id: toastId,
        description: `"${selectedFolder.name}" has been renamed to "${newName}".`,
      });
    } catch (err) {
      console.error("Failed to rename folder", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to rename folder";
      toast.error("Failed to rename folder", {
        id: toastId,
        description: errorMessage,
      });
      throw err;
    }
  };

  const handleFolderDelete = (folderPath: string, folderName: string) => {
    setSelectedFolder({ path: folderPath, name: folderName });
    setShowDeleteFolderModal(true);
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    
    const toastId = toast.loading(`Deleting folder "${selectedFolder.name}"...`);
    
    try {
      await DocumentsService.deleteFolder(
        baseId,
        selectedTable?.id ?? null,
        selectedFolder.path
      );
      
      // Clear folder path if it's the deleted folder or a subfolder
      if (folderPath === selectedFolder.path || folderPath.startsWith(selectedFolder.path)) {
        setFolderPath("");
        setSelectedDocPath(null);
      }
      
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'folder_delete',
        folderPath: selectedFolder.path,
        documentName: selectedFolder.name,
      });
      
      await refresh();
      toast.success("Folder deleted", {
        id: toastId,
        description: `"${selectedFolder.name}" and all its contents have been deleted.`,
      });
    } catch (err) {
      console.error("Failed to delete folder", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to delete folder";
      toast.error("Failed to delete folder", {
        id: toastId,
        description: errorMessage,
      });
      throw err;
    }
  };

  const handleFolderMove = async (sourcePath: string, targetParentPath: string) => {
    const folderName = sourcePath.split("/").filter(Boolean).pop() || "folder";
    const targetDescription = targetParentPath 
      ? `into "${targetParentPath.split("/").filter(Boolean).pop()}"` 
      : "to root level";
    
    const toastId = toast.loading(`Moving folder "${folderName}" ${targetDescription}...`);
    
    try {
      const newPath = await DocumentsService.moveFolder({
        baseId,
        tableId: selectedTable?.id ?? null,
        recordId,
        sourceFolderPath: sourcePath,
        targetParentPath,
      });
      
      // Update folder path if we were viewing the moved folder
      if (folderPath === sourcePath || folderPath.startsWith(sourcePath)) {
        const relativePath = folderPath.slice(sourcePath.length);
        setFolderPath(newPath + relativePath);
      }
      
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'folder_rename', // Reusing folder_rename action type for moves
        folderPath: newPath,
        documentName: folderName,
        metadata: { movedFrom: sourcePath, movedTo: newPath },
      });
      
      await refresh();
      toast.success("Folder moved", {
        id: toastId,
        description: `"${folderName}" has been moved ${targetDescription}.`,
      });
    } catch (err) {
      console.error("Failed to move folder", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to move folder";
      toast.error("Failed to move folder", {
        id: toastId,
        description: errorMessage,
      });
      throw err;
    }
  };

  const handleDocumentMove = async (documentPath: string, targetFolderPath: string) => {
    const docName = documentPath.split("/").pop() || "document";
    const targetDescription = targetFolderPath 
      ? `to "${targetFolderPath.split("/").filter(Boolean).pop()}"` 
      : "to Uncategorized";
    
    const toastId = toast.loading(`Moving "${docName}" ${targetDescription}...`);
    
    try {
      await DocumentsService.moveDocument({
        baseId,
        tableId: selectedTable?.id ?? null,
        recordId,
        sourceRelativePath: documentPath,
        targetFolderPath,
      });
      
      // Clear selection if we moved the selected document
      if (selectedDocPath === documentPath) {
        setSelectedDocPath(null);
        setSignedUrl(null);
      }
      
      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'rename', // Reusing rename action type for moves
        documentPath: targetFolderPath + docName,
        documentName: docName,
        metadata: { movedFrom: documentPath, movedTo: targetFolderPath },
      });
      
      await refresh();
      toast.success("Document moved", {
        id: toastId,
        description: `"${docName}" has been moved ${targetDescription}.`,
      });
    } catch (err) {
      console.error("Failed to move document", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to move document";
      toast.error("Failed to move document", {
        id: toastId,
        description: errorMessage,
      });
      throw err;
    }
  };
  
  // Document drag handlers
  const handleDocumentDragStart = (dragData: DocumentDragData) => {
    setDraggingDocument(dragData);
  };
  
  const handleDocumentDragEnd = () => {
    setDraggingDocument(null);
  };

  const handleDocumentEdit = async (doc: StoredDocument & { relative: string }) => {
    // Only allow editing PDFs
    if (!isPdf(doc.mimeType)) {
      toast.error("Editing not available", {
        description: "Only PDF documents can be edited.",
      });
      return;
    }
    
    try {
      // Get signed URL for the document to edit
      const url = await DocumentsService.getSignedUrl(
        baseId,
        selectedTable?.id ?? null,
        doc.path,
        600,
        recordId
      );
      setEditorDoc(doc);
      setEditorSignedUrl(url);
    } catch (err) {
      console.error("Failed to open document for editing", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to open document for editing. Please try again.";
      toast.error("Failed to open editor", {
        description: errorMessage,
      });
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
      
      // Build the full document path for version tracking
      const prefix = recordId 
        ? `bases/${baseId}/records/${recordId}/`
        : selectedTable?.id 
          ? `bases/${baseId}/tables/${selectedTable.id}/`
          : `bases/${baseId}/`;
      const fullDocPath = `${prefix}${originalPath}`;
      
      // Download and save original file as a version BEFORE editing
      try {
        const originalUrl = await DocumentsService.getSignedUrl(
          baseId, 
          selectedTable?.id ?? null, 
          originalPath, 
          600, 
          recordId
        );
        const response = await fetch(originalUrl);
        const originalBlob = await response.blob();
        const originalFile = new File([originalBlob], originalFileName, { 
          type: editorDoc.mimeType || "application/pdf" 
        });
        
        // Create version of the original file before replacing
        await DocumentVersionService.createVersion({
          documentPath: fullDocPath,
          baseId,
          tableId: selectedTable?.id,
          file: originalFile,
          notes: "Original version before edit",
        });
      } catch (versionErr) {
        console.warn("Failed to create version of original file:", versionErr);
        // Continue with save even if version creation fails
      }
      
      // Delete the old file
      await DocumentsService.deleteDocument(baseId, selectedTable?.id ?? null, originalPath, recordId);
      
      // Upload the edited file with the SAME name (preserving original filename)
      const editedFile = new File([file], originalFileName, { type: file.type });
      
      await DocumentsService.uploadDocument({
        baseId,
        tableId: selectedTable?.id,
        recordId, // Pass recordId for record-scoped uploads
        folderPath: currentPrefix,
        file: editedFile,
        preserveName: true, // Keep the original filename
      });
      
      // Create version of the edited file as the new current version
      try {
        await DocumentVersionService.createVersion({
          documentPath: fullDocPath,
          baseId,
          tableId: selectedTable?.id,
          file: editedFile,
          notes: "Edited version",
        });
      } catch (versionErr) {
        console.warn("Failed to create version of edited file:", versionErr);
        // Continue even if version creation fails
      }
      
      // Log activity for the edit
      await DocumentActivityService.logActivity({
        baseId,
        tableId: selectedTable?.id,
        recordId,
        action: 'edit',
        documentPath: fullDocPath,
        documentName: originalFileName,
        metadata: { editType: 'pdf_annotation' },
      });
      
      // Refresh to show updated document
      await refresh();
      
      // Update selected document path to the new path
      const fullNewPath = currentPrefix + originalFileName;
      if (selectedDocPath === originalPath) {
        setSelectedDocPath(fullNewPath);
      }
      
      toast.success("Document saved", {
        description: "Your changes have been saved with version history.",
      });
    } catch (err) {
      console.error("Failed to save edited document", err);
      throw err; // Re-throw to let PdfEditor handle the error
    }
  };

  // Handle PDF Split
  const handleDocumentSplit = async (doc: StoredDocument) => {
    if (!isPdf(doc.mimeType)) {
      toast.error("Split not available", {
        description: "Only PDF documents can be split.",
      });
      return;
    }

    try {
      const url = await DocumentsService.getSignedUrl(
        baseId,
        selectedTable?.id ?? null,
        doc.path,
        600,
        recordId
      );
      setSplitDoc(doc);
      setSplitSignedUrl(url);
      setShowPdfSplitModal(true);
    } catch (err) {
      console.error("Failed to open document for splitting", err);
      toast.error("Failed to open split tool", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
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
        onRequestSignature={() => setShowSignatureRequestModal(true)}
        onViewSignatures={() => setShowSignatureStatus(true)}
        onMergeDocuments={() => setShowMergeWithReorderModal(true)}
      />

      <div className="flex flex-1 min-h-0">
        <DocumentsSidebar
          folderTree={folderTree}
          currentPrefix={currentPrefix}
          onFolderSelect={handleFolderSelect}
          onFolderRename={handleFolderRename}
          onFolderDelete={handleFolderDelete}
          onFolderMove={handleFolderMove}
          onDocumentMove={handleDocumentMove}
          loading={loading && isInitialLoad}
          uncategorizedCount={uncategorizedCount}
          recentCount={recentCount}
          totalDocCount={totalDocCount}
          todayCount={todayCount}
          currentView={currentView}
          onViewChange={handleViewChange}
        />

        {/* Tab Navigation */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center border-b border-gray-200 px-4">
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "documents"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab("photos")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "photos"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Photos
            </button>
            
            {/* Activity Feed Toggle */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowFolderSetup(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Setup Folders
              </button>
              <button
                onClick={() => setShowAuditLog(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                View Audit Log
              </button>
              <button
                onClick={() => setShowActivityFeed(!showActivityFeed)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showActivityFeed
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {showActivityFeed ? "Hide Activity" : "Show Activity"}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className={`flex-1 min-h-0 grid grid-cols-1 ${activeTab === "documents" && showActivityFeed ? 'lg:grid-cols-[1fr_1fr_280px]' : activeTab === "documents" ? 'lg:grid-cols-2' : ''}`}>
            {activeTab === "documents" ? (
              <>
                <DocumentsList
                  documents={visibleDocs}
                  allDocs={allDocs}
                  selectedDocPath={selectedDocPath}
                  loading={loading && isInitialLoad}
                  error={error}
                  folderPath={folderPath}
                  checkedDocuments={checkedDocuments}
                  onDocumentSelect={setSelectedDocPath}
                  onDocumentEdit={handleDocumentEdit}
                  onDocumentDragStart={handleDocumentDragStart}
                  onDocumentDragEnd={handleDocumentDragEnd}
                  baseId={baseId}
                  tableId={selectedTable?.id}
                  recordId={recordId}
                  currentView={currentView}
                />

                <DocumentPreview
                  selectedDoc={selectedDoc}
                  signedUrl={signedUrl}
                  viewerError={viewerError}
                  baseId={baseId}
                  tableId={selectedTable?.id}
                  recordId={recordId}
                  onRename={handleRenameSelected}
                  onDelete={handleDeleteSelected}
                  onSplit={selectedDoc && isPdf(selectedDoc.mimeType) ? () => handleDocumentSplit(selectedDoc) : undefined}
                  loading={loading && isInitialLoad && !selectedDoc}
                  onRequestSignature={handleRequestSignatureForDocument}
                  onEdit={selectedDoc && isPdf(selectedDoc.mimeType) 
                    ? (doc) => handleDocumentEdit({ ...doc, relative: doc.path }) 
                    : undefined
                  }
                  onDownload={selectedDoc && signedUrl ? (doc) => {
                    // Create a download link
                    const link = document.createElement('a');
                    link.href = signedUrl;
                    link.download = doc.path.split('/').pop() || 'document';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } : undefined}
                />
              
                {/* Activity Feed Sidebar */}
                {showActivityFeed && (
                  <div className="hidden lg:flex flex-col border-l border-gray-200 bg-white">
                    <ActivityFeed
                      baseId={baseId}
                      tableId={selectedTable?.id}
                      recordId={recordId}
                    />
                  </div>
                )}
              </>
            ) : (
              <PhotoGallery
                baseId={baseId}
                tableId={selectedTable?.id}
                recordId={recordId}
                documents={allDocs}
                onUpload={handleUpload}
                onRefresh={refresh}
                loading={loading && isInitialLoad}
              />
            )}
          </div>
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
          onRequestSignature={(signatureFields) => {
            // Close the editor and open signature request modal
            const docToSign = editorDoc;
            handleEditorClose();
            // Set the document for signature request
            setSignatureRequestDoc(docToSign);
            setShowSignatureRequestModal(true);
          }}
        />
      )}

      {/* Template Field Editor */}
      {selectedTemplate && (
        <TemplateFieldEditor
          isOpen={showTemplateFieldEditor}
          onClose={() => {
            setShowTemplateFieldEditor(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
          baseId={baseId}
          tableId={selectedTable?.id ?? null}
        />
      )}

      {/* Document Generator Form */}
      {selectedTemplate && (
        <DocumentGeneratorForm
          isOpen={showDocumentGenerator}
          onClose={() => {
            setShowDocumentGenerator(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
          baseId={baseId}
          tableId={selectedTable?.id ?? null}
          onDocumentGenerated={refresh}
        />
      )}

      {/* Folder Name Modal */}
      <FolderNameModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onCreate={handleCreateFolder}
        currentPath={currentPrefix}
      />

      {/* Rename Document Modal */}
      {selectedDoc && !isFolder(selectedDoc) && (
        <RenameDocumentModal
          isOpen={showRenameModal}
          onClose={() => setShowRenameModal(false)}
          onRename={handleRenameDocument}
          currentName={selectedDoc.path.split("/").pop() || selectedDoc.path}
        />
      )}

      {/* Rename Folder Modal */}
      {selectedFolder && (
        <RenameFolderModal
          isOpen={showRenameFolderModal}
          onClose={() => {
            setShowRenameFolderModal(false);
            setSelectedFolder(null);
          }}
          onRename={handleRenameFolder}
          currentName={selectedFolder.name}
          currentPath={selectedFolder.path.split("/").slice(0, -1).join("/") || "Root"}
        />
      )}

      {/* Delete Folder Modal */}
      {selectedFolder && (
        <DeleteFolderModal
          isOpen={showDeleteFolderModal}
          onClose={() => {
            setShowDeleteFolderModal(false);
            setSelectedFolder(null);
          }}
          onDelete={handleDeleteFolder}
          folderName={selectedFolder.name}
          folderPath={selectedFolder.path}
        />
      )}

      {/* Signature Request Modal */}
      <SignatureRequestModal
        isOpen={showSignatureRequestModal}
        onClose={() => {
          setShowSignatureRequestModal(false);
          setSignatureRequestDoc(null);
        }}
        baseId={baseId}
        tableId={selectedTable?.id ?? null}
        selectedDocument={signatureRequestDoc ? {
          path: signatureRequestDoc.path,
          size: signatureRequestDoc.size,
          mimeType: signatureRequestDoc.mimeType,
          createdAt: signatureRequestDoc.createdAt
        } : null}
        onRequestCreated={() => {
          setShowSignatureRequestModal(false);
          setSignatureRequestDoc(null);
          setShowSignatureStatus(true);
        }}
        recordId={recordId}
        recordValues={recordsData.find(r => r.id === recordId)?.values || undefined}
        availableFields={tableFields.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          options: f.options as Record<string, { name?: string; label?: string }> | undefined
        }))}
      />

      {/* Signature Request Status */}
      {showSignatureStatus && (
        <div className="absolute inset-0 bg-white z-50 overflow-auto">
          <div className="p-6">
            <button
              onClick={() => setShowSignatureStatus(false)}
              className="mb-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back to Documents
            </button>
            <SignatureRequestStatus
              baseId={baseId}
              tableId={selectedTable?.id ?? null}
              recordId={recordId}
            />
          </div>
        </div>
      )}

      {/* PDF Split Modal */}
      {splitDoc && splitSignedUrl && (
        <PdfSplitModal
          isOpen={showPdfSplitModal}
          onClose={() => {
            setShowPdfSplitModal(false);
            setSplitDoc(null);
            setSplitSignedUrl(null);
          }}
          baseId={baseId}
          tableId={selectedTable?.id}
          recordId={recordId} // Pass recordId for record-scoped documents
          document={{
            path: splitDoc.path,
            name: splitDoc.path.split("/").pop() || "document.pdf",
          }}
          signedUrl={splitSignedUrl}
          onSplitComplete={() => {
            refresh();
          }}
        />
      )}

      {/* PDF Merge with Page Reordering Modal */}
      <PdfMergeWithReorderModal
        isOpen={showMergeWithReorderModal}
        onClose={() => setShowMergeWithReorderModal(false)}
        baseId={baseId}
        tableId={selectedTable?.id}
        onMergeComplete={() => {
          refresh();
        }}
      />

      {/* Audit Log Viewer Modal */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <AuditLogViewer
              baseId={baseId}
              tableId={selectedTable?.id}
              recordId={recordId}
              onClose={() => setShowAuditLog(false)}
            />
          </div>
        </div>
      )}

      {/* Transaction Folder Setup Modal */}
      <TransactionFolderSetupModal
        isOpen={showFolderSetup}
        onClose={() => setShowFolderSetup(false)}
        baseId={baseId}
        tableId={selectedTable?.id}
        recordId={recordId}
        existingFolders={rootFolders}
        onComplete={() => {
          refresh();
        }}
      />

      {/* Post-Upload Prompt */}
      <PostActionPrompt
        type="document-uploaded"
        documentName={lastUploadedDoc?.path.split("/").pop()}
        isOpen={showUploadPrompt}
        onClose={() => {
          setShowUploadPrompt(false);
          setLastUploadedDoc(null);
        }}
        suggestions={createUploadSuggestions({
          onEditDocument: lastUploadedDoc ? () => {
            setShowUploadPrompt(false);
            handleDocumentEdit({ ...lastUploadedDoc, relative: lastUploadedDoc.path });
          } : undefined,
          onRequestSignature: lastUploadedDoc ? () => {
            setShowUploadPrompt(false);
            setSignatureRequestDoc(lastUploadedDoc);
            setShowSignatureRequestModal(true);
          } : undefined,
          onOrganize: () => {
            setShowUploadPrompt(false);
            // Focus on the folder selector - user can then move the document
            if (lastUploadedDoc) {
              setSelectedDocPath(lastUploadedDoc.path);
            }
          },
          onUploadMore: () => {
            setShowUploadPrompt(false);
            setLastUploadedDoc(null);
            // Trigger file input click - would need a ref, so just close for now
          },
        })}
      />

      {/* Keyboard Shortcuts Panel */}
      <KeyboardShortcutsPanel
        isOpen={keyboardShortcuts.isOpen}
        onClose={keyboardShortcuts.close}
      />
    </div>
  );
};
