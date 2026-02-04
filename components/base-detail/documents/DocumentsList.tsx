import { useState, useMemo, useCallback, useEffect } from "react";
import { FileText, Image as ImageIcon, File, Loader2, Trash2, Search, X, LayoutGrid, List, ArrowUpDown, Clock, Files, FilePen, Copy, FolderOutput } from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { DocumentsService } from "@/lib/services/documents-service";
import { formatSize, isImage, isPdf, isFolder } from "./utils";
import { DocumentSkeleton } from "./DocumentsSkeleton";
import { DocumentThumbnail } from "./DocumentThumbnail";
import type { DocumentView } from "./DocumentsSidebar";
import { CopyMoveModal } from "./CopyMoveModal";

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'size-desc', label: 'Largest First' },
  { value: 'size-asc', label: 'Smallest First' },
];

type DocumentsListProps = {
  documents: Array<StoredDocument & { relative: string }>;
  allDocs: StoredDocument[];
  selectedDocPath: string | null;
  loading: boolean;
  error: string | null;
  folderPath: string;
  checkedDocuments: string[];
  onDocumentSelect: (path: string) => void;
  onDocumentEdit?: (doc: StoredDocument & { relative: string }) => void;
  baseId: string;
  tableId?: string | null;
  recordId?: string | null;
  currentView?: DocumentView;  // Current view type
  viewTitle?: string;          // Custom title for the view
};

const renderDocIcon = (mimeType: string) => {
  if (isImage(mimeType)) return <ImageIcon className="w-4 h-4 text-blue-600" />;
  if (isPdf(mimeType)) return <FileText className="w-4 h-4 text-red-600" />;
  return <File className="w-4 h-4 text-gray-600" />;
};

export const DocumentsList = ({
  documents,
  allDocs,
  selectedDocPath,
  loading,
  error,
  folderPath,
  checkedDocuments,
  onDocumentSelect,
  onDocumentEdit,
  baseId,
  tableId,
  recordId,
  currentView = 'folder',
  viewTitle,
}: DocumentsListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  
  // Sorting state (from HEAD)
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Copy/Move state (from remote)
  const [copyMoveModalOpen, setCopyMoveModalOpen] = useState(false);
  const [selectedDocForCopyMove, setSelectedDocForCopyMove] = useState<(StoredDocument & { relative: string }) | null>(null);
  const [folders, setFolders] = useState<Array<{ name: string; path: string, parent_path: string | null }>>([]);

  // Filter documents by search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    
    const query = searchQuery.toLowerCase();
    return documents.filter((doc) => {
      const fileName = doc.relative.toLowerCase();
      return fileName.includes(query);
    });
  }, [documents, searchQuery]);

  // Sort documents based on selected sort option
  const sortedDocuments = useMemo(() => {
    const sorted = [...filteredDocuments];
    switch (sortBy) {
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'name-asc':
        return sorted.sort((a, b) => a.relative.localeCompare(b.relative));
      case 'name-desc':
        return sorted.sort((a, b) => b.relative.localeCompare(a.relative));
      case 'size-desc':
        return sorted.sort((a, b) => b.size - a.size);
      case 'size-asc':
        return sorted.sort((a, b) => a.size - b.size);
      default:
        return sorted;
    }
  }, [filteredDocuments, sortBy]);

  // Determine display title based on view
  const displayTitle = useMemo(() => {
    if (viewTitle) return viewTitle;
    switch (currentView) {
      case 'recent':
        return 'Recent Uploads';
      case 'all':
        return 'All Documents';
      default:
        return 'Documents';
    }
  }, [currentView, viewTitle]);

  // Get icon for the view
  const ViewIcon = useMemo(() => {
    switch (currentView) {
      case 'recent':
        return Clock;
      case 'all':
        return Files;
      default:
        return FileText;
    }
  }, [currentView]);

  // Check if we should show documents (folder view needs a folder selected, others always show)
  const shouldShowDocuments = currentView !== 'folder' || folderPath !== undefined;

  // Load signed URLs for thumbnails in grid view
  const loadSignedUrl = useCallback(async (doc: StoredDocument & { relative: string }) => {
    if (signedUrls[doc.path]) return;
    try {
      const url = await DocumentsService.getSignedUrl(baseId, tableId ?? null, doc.path, 600, recordId);
      setSignedUrls(prev => ({ ...prev, [doc.path]: url }));
    } catch (err) {
      console.error("Failed to get signed URL for thumbnail:", err);
    }
  }, [baseId, tableId, recordId, signedUrls]);

  // Load signed URLs when grid view is active
  useEffect(() => {
    if (viewMode === "grid" && sortedDocuments.length > 0) {
      // Load URLs for visible documents (first 20)
      sortedDocuments.slice(0, 20).forEach(doc => {
        if (!signedUrls[doc.path]) {
          loadSignedUrl(doc);
        }
      });
    }
  }, [viewMode, sortedDocuments, loadSignedUrl, signedUrls]);

  // Load folders for copy/move modal
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const folderList = await DocumentsService.listFolders(baseId, tableId ?? null, null, true, recordId);
        setFolders(folderList);
      } catch (err) {
        console.error("Failed to load folders:", err);
      }
    };
    loadFolders();
  }, [baseId, tableId, recordId]);

  const openCopyMoveModal = useCallback((doc: StoredDocument & { relative: string }) => {
    setSelectedDocForCopyMove(doc);
    setCopyMoveModalOpen(true);
  }, []);

  const closeCopyMoveModal = useCallback(() => {
    setCopyMoveModalOpen(false);
    setSelectedDocForCopyMove(null);
  }, []);

  return (
    <div className="border-r border-gray-200 min-h-0 overflow-y-auto flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <ViewIcon className="w-4 h-4" />
          {displayTitle} ({sortedDocuments.length}{searchQuery && ` of ${documents.length}`})
        </div>
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="Sort documents"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
            </button>
            {showSortMenu && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowSortMenu(false)}
                />
                {/* Menu */}
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                        sortBy === option.value
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
              title="Grid view with thumbnails"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="px-4 py-2 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              aria-label="Clear search"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 rounded-b">
        Drag and drop files anywhere in this panel to upload. You can also forward email
        attachments to your ingest address (e.g., tc@allprime.com) to auto-save here.
      </div>
      
      {shouldShowDocuments ? (
        <div className="divide-y divide-gray-100">
          {loading ? (
            <DocumentSkeleton count={6} />
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : sortedDocuments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              {searchQuery ? (
                <>No documents found matching &quot;{searchQuery}&quot;.</>
              ) : currentView === 'recent' ? (
                <>No documents uploaded in the last 7 days.</>
              ) : (
                <>No documents yet. Upload files to get started.</>
              )}
            </div>
          ) : (
            viewMode === "list" ? (
              // List View
              sortedDocuments.map((doc) => {
                // Double-check: don't allow selecting folders
                if (isFolder(doc)) return null;
                return (
                  <button
                    key={doc.path}
                    onClick={() => {
                      // Validate before selecting
                      if (!isFolder(doc)) {
                        onDocumentSelect(doc.path);
                      }
                    }}
                    onDoubleClick={() => {
                      // Open editor on double-click for PDF files only
                      if (!isFolder(doc) && onDocumentEdit && isPdf(doc.mimeType)) {
                        onDocumentEdit(doc);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      selectedDocPath === doc.path ? "bg-blue-50 border-l-4 border-blue-500" : ""
                    }`}
                    title={isPdf(doc.mimeType) ? "Double-click to edit" : ""}
                  >
                    <div className="shrink-0">{renderDocIcon(doc.mimeType)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {doc.relative}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{formatSize(doc.size)}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {onDocumentEdit && isPdf(doc.mimeType) && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onDocumentEdit(doc);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit document"
                        >
                          <FilePen className="w-4 h-4" />
                        </span>
                      )}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openCopyMoveModal(doc);
                        }}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Copy or move document"
                      >
                        <FolderOutput className="w-4 h-4" />
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              // Grid View with Thumbnails
              <div className="grid grid-cols-2 gap-2 p-2">
                {sortedDocuments.map((doc) => {
                  if (isFolder(doc)) return null;
                  return (
                    <button
                      key={doc.path}
                      onClick={() => {
                        if (!isFolder(doc)) {
                          onDocumentSelect(doc.path);
                        }
                      }}
                      onDoubleClick={() => {
                        if (!isFolder(doc) && onDocumentEdit && isPdf(doc.mimeType)) {
                          onDocumentEdit(doc);
                        }
                      }}
                      className={`group relative p-2 rounded-lg border transition-all hover:shadow-md ${
                        selectedDocPath === doc.path
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      title={isPdf(doc.mimeType) ? "Double-click to edit" : ""}
                    >
                      {/* Action Buttons - appear on hover */}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {onDocumentEdit && isPdf(doc.mimeType) && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onDocumentEdit(doc);
                            }}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm"
                            title="Edit document"
                          >
                            <FilePen className="w-3 h-3" />
                          </span>
                        )}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openCopyMoveModal(doc);
                          }}
                          className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors shadow-sm"
                          title="Copy or move document"
                        >
                          <FolderOutput className="w-3 h-3" />
                        </span>
                      </div>
                      {/* Thumbnail */}
                      <DocumentThumbnail
                        documentPath={doc.path}
                        baseId={baseId}
                        tableId={tableId}
                        signedUrl={signedUrls[doc.path]}
                        mimeType={doc.mimeType}
                        fileName={doc.relative}
                        className="w-full aspect-3/4 mb-2"
                      />
                      {/* File Info */}
                      <div className="text-left">
                        <p className="text-xs font-medium text-gray-900 truncate" title={doc.relative}>
                          {doc.relative}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {formatSize(doc.size)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="p-6 text-sm text-gray-500">Select a folder to view documents.</div>
      )}
      
      <CopyMoveModal
        isOpen={copyMoveModalOpen}
        onClose={closeCopyMoveModal}
        document={selectedDocForCopyMove}
        documents={allDocs}
        folders={folders}
        baseId={baseId}
        tableId={tableId}
        recordId={recordId}
        currentFolderPath={folderPath}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
};
