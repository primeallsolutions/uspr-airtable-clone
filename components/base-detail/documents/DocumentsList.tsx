import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, File, Loader2, Trash2, Search, X, LayoutGrid, List, ArrowUpDown, Clock, Files, FilePen, Copy, FolderOutput, CalendarPlus, Calendar, PenTool, Eye, MoreVertical, Download, FileUp, GripVertical } from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { DocumentsService } from "@/lib/services/documents-service";
import { formatSize, isImage, isPdf, isFolder } from "./utils";
import { DocumentSkeleton } from "./DocumentsSkeleton";
import { DocumentThumbnail } from "./DocumentThumbnail";
import type { DocumentView, DocumentDragData } from "./DocumentsSidebar";
import { CopyMoveModal } from "./CopyMoveModal";
import { DocumentStatusBadge, DocumentStatusDot, type DocumentStatus } from "./DocumentStatusBadge";

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'size-desc', label: 'Largest First' },
  { value: 'size-asc', label: 'Smallest First' },
];

// Date group types
type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older';

// Helper to get date group for a document
const getDateGroup = (dateStr: string): DateGroup => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of this week (Sunday)
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Reset time for comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (dateOnly.getTime() === todayOnly.getTime()) return 'today';
  if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'yesterday';
  if (dateOnly >= startOfWeek) return 'thisWeek';
  if (dateOnly >= startOfMonth) return 'thisMonth';
  return 'older';
};

// Date group labels
const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  older: 'Older',
};

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
  onDocumentSign?: (doc: StoredDocument & { relative: string }) => void;
  onDocumentDownload?: (doc: StoredDocument & { relative: string }) => void;
  onDocumentDelete?: (doc: StoredDocument & { relative: string }) => void;
  onDocumentDragStart?: (dragData: DocumentDragData) => void;
  onDocumentDragEnd?: () => void;
  baseId: string;
  tableId?: string | null;
  recordId?: string | null;
  currentView?: DocumentView;  // Current view type
  viewTitle?: string;          // Custom title for the view
  documentStatuses?: Map<string, { status: DocumentStatus; signersProgress?: { signed: number; total: number } }>; // Document path -> status
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
  onDocumentSign,
  onDocumentDownload,
  onDocumentDelete,
  onDocumentDragStart,
  onDocumentDragEnd,
  baseId,
  tableId,
  recordId,
  currentView = 'folder',
  viewTitle,
  documentStatuses,
}: DocumentsListProps) => {
  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  
  // Sorting state (from HEAD)
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showDateGroups, setShowDateGroups] = useState(true); // Toggle for date grouping
  
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

  // Group documents by date (only when date sorting is active)
  const groupedDocuments = useMemo(() => {
    if (!showDateGroups || !['date-desc', 'date-asc'].includes(sortBy)) {
      return null; // No grouping when not sorting by date or grouping disabled
    }
    
    const groups: Record<DateGroup, typeof sortedDocuments> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };
    
    sortedDocuments.forEach((doc) => {
      const group = getDateGroup(doc.createdAt);
      groups[group].push(doc);
    });
    
    // Return ordered array of groups (with documents)
    const groupOrder: DateGroup[] = sortBy === 'date-asc' 
      ? ['older', 'thisMonth', 'thisWeek', 'yesterday', 'today']
      : ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'];
    
    return groupOrder
      .filter((group) => groups[group].length > 0)
      .map((group) => ({
        group,
        label: DATE_GROUP_LABELS[group],
        documents: groups[group],
      }));
  }, [sortedDocuments, sortBy, showDateGroups]);

  // Determine display title based on view
  const displayTitle = useMemo(() => {
    if (viewTitle) return viewTitle;
    switch (currentView) {
      case 'today':
        return 'Uploaded Today';
      case 'recent':
        return 'Recent Uploads (7 days)';
      case 'all':
        return 'All Documents';
      default:
        return 'Documents';
    }
  }, [currentView, viewTitle]);

  // Get icon for the view
  const ViewIcon = useMemo(() => {
    switch (currentView) {
      case 'today':
        return CalendarPlus;
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

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in search
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // Only handle if this list has focus (or a child has focus)
      if (!listContainerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }

      const docs = sortedDocuments.filter(d => !isFolder(d));
      if (docs.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
        case "j": // Vim-style navigation
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = prev < docs.length - 1 ? prev + 1 : 0;
            itemRefs.current.get(next)?.focus();
            return next;
          });
          break;
        case "ArrowUp":
        case "k": // Vim-style navigation
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = prev > 0 ? prev - 1 : docs.length - 1;
            itemRefs.current.get(next)?.focus();
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < docs.length) {
            onDocumentSelect(docs[focusedIndex].path);
          }
          break;
        case "e":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < docs.length) {
            const doc = docs[focusedIndex];
            if (isPdf(doc.mimeType) && onDocumentEdit) {
              onDocumentEdit(doc);
            }
          }
          break;
        case "s":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < docs.length) {
            const doc = docs[focusedIndex];
            if (isPdf(doc.mimeType) && onDocumentSign) {
              onDocumentSign(doc);
            }
          }
          break;
        case "d":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < docs.length) {
            const doc = docs[focusedIndex];
            if (onDocumentDownload) {
              onDocumentDownload(doc);
            }
          }
          break;
        case "Delete":
        case "Backspace":
          if (focusedIndex >= 0 && focusedIndex < docs.length) {
            const doc = docs[focusedIndex];
            if (onDocumentDelete) {
              e.preventDefault();
              onDocumentDelete(doc);
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sortedDocuments, focusedIndex, onDocumentSelect, onDocumentEdit, onDocumentSign, onDocumentDownload, onDocumentDelete]);

  const openCopyMoveModal = useCallback((doc: StoredDocument & { relative: string }) => {
    setSelectedDocForCopyMove(doc);
    setCopyMoveModalOpen(true);
  }, []);

  const closeCopyMoveModal = useCallback(() => {
    setCopyMoveModalOpen(false);
    setSelectedDocForCopyMove(null);
  }, []);

  // Get document index for keyboard nav
  const getDocIndex = useCallback((doc: StoredDocument & { relative: string }) => {
    const docs = sortedDocuments.filter(d => !isFolder(d));
    return docs.findIndex(d => d.path === doc.path);
  }, [sortedDocuments]);

  return (
    <div ref={listContainerRef} className="border-r border-gray-200 min-h-0 overflow-y-auto flex flex-col" tabIndex={0}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <ViewIcon className="w-4 h-4" />
          {displayTitle} ({sortedDocuments.length}{searchQuery && ` of ${documents.length}`})
        </div>
        <div className="flex items-center gap-2">
          {/* Date Grouping Toggle */}
          {['date-desc', 'date-asc'].includes(sortBy) && (
            <button
              onClick={() => setShowDateGroups(!showDateGroups)}
              className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors ${
                showDateGroups 
                  ? "bg-blue-100 text-blue-700" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              title={showDateGroups ? "Hide date groups" : "Show date groups"}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Group</span>
            </button>
          )}
          
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
            <EmptyState 
              searchQuery={searchQuery}
              currentView={currentView}
            />
          ) : (
            viewMode === "list" ? (
              // List View with optional date grouping
              groupedDocuments && groupedDocuments.length > 0 ? (
                // Grouped by date
                groupedDocuments.map(({ group, label, documents: groupDocs }) => (
                  <div key={group}>
                    {/* Group Header */}
                    <div className="sticky top-0 px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2 z-10">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {label}
                      </span>
                      <span className="text-xs text-gray-400">({groupDocs.length})</span>
                    </div>
                    {/* Group Documents */}
                    {groupDocs.map((doc, idx) => {
                      if (isFolder(doc)) return null;
                      const docStatus = documentStatuses?.get(doc.path);
                      const docIndex = getDocIndex(doc);
                      const isFocused = focusedIndex === docIndex;
                      
                      // Drag handlers for documents
                      const handleDocDragStart = (e: React.DragEvent) => {
                        const dragData: DocumentDragData = {
                          type: "document",
                          path: doc.path,
                          name: doc.relative,
                        };
                        e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
                        e.dataTransfer.setData("application/json", JSON.stringify(dragData));
                        e.dataTransfer.effectAllowed = "move";
                        onDocumentDragStart?.(dragData);
                      };
                      
                      const handleDocDragEnd = () => {
                        onDocumentDragEnd?.();
                      };
                      
                      return (
                        <div
                          key={doc.path}
                          draggable={true}
                          onDragStart={handleDocDragStart}
                          onDragEnd={handleDocDragEnd}
                          className="group flex items-center hover:bg-gray-50 transition-colors"
                        >
                          {/* Drag handle */}
                          <div className="pl-2 pr-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <button
                            ref={(el) => {
                              if (el) itemRefs.current.set(docIndex, el);
                            }}
                            onClick={() => {
                              if (!isFolder(doc)) {
                                setFocusedIndex(docIndex);
                                onDocumentSelect(doc.path);
                              }
                            }}
                            onDoubleClick={() => {
                              if (!isFolder(doc) && onDocumentEdit && isPdf(doc.mimeType)) {
                                onDocumentEdit(doc);
                              }
                            }}
                            onFocus={() => setFocusedIndex(docIndex)}
                            className={`flex-1 text-left px-3 py-3 flex items-center gap-3 transition-colors ${
                              selectedDocPath === doc.path 
                                ? "bg-blue-50 border-l-4 border-blue-500" 
                                : isFocused 
                                  ? "bg-gray-100 ring-2 ring-inset ring-blue-300" 
                                  : ""
                            }`}
                            title={isPdf(doc.mimeType) ? "Double-click to edit • Press E to edit, S to sign • Drag to move" : "Drag to move to another folder"}
                          >
                            <div className="shrink-0 relative">
                              {renderDocIcon(doc.mimeType)}
                              {docStatus && docStatus.status !== "draft" && (
                                <DocumentStatusDot 
                                  status={docStatus.status} 
                                  className="absolute -top-0.5 -right-0.5"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {doc.relative}
                                </span>
                                {docStatus && docStatus.status !== "draft" && (
                                  <DocumentStatusBadge 
                                    status={docStatus.status} 
                                    size="sm"
                                    signersProgress={docStatus.signersProgress}
                                  />
                                )}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>{formatSize(doc.size)}</span>
                                <span>•</span>
                                <span>{new Date(doc.createdAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                            {/* Hover Actions - always visible on hover */}
                            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Sign Button - Primary for PDFs */}
                              {onDocumentSign && isPdf(doc.mimeType) && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDocumentSign(doc);
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                  title="Request signature (S)"
                                >
                                  <PenTool className="w-4 h-4" />
                                </span>
                              )}
                              {/* Edit Button */}
                              {onDocumentEdit && isPdf(doc.mimeType) && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDocumentEdit(doc);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="Edit document (E)"
                                >
                                  <FilePen className="w-4 h-4" />
                                </span>
                              )}
                              {/* Download Button */}
                              {onDocumentDownload && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDocumentDownload(doc);
                                  }}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                                  title="Download (D)"
                                >
                                  <Download className="w-4 h-4" />
                                </span>
                              )}
                              {/* Move/Copy Button */}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCopyMoveModal(doc);
                                }}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                                title="Move or copy"
                              >
                                <FolderOutput className="w-4 h-4" />
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                // Flat list (no grouping)
                sortedDocuments.map((doc, idx) => {
                  if (isFolder(doc)) return null;
                  const docStatus = documentStatuses?.get(doc.path);
                  const docIndex = getDocIndex(doc);
                  const isFocused = focusedIndex === docIndex;
                  
                  // Drag handlers for documents
                  const handleDocDragStart = (e: React.DragEvent) => {
                    const dragData: DocumentDragData = {
                      type: "document",
                      path: doc.path,
                      name: doc.relative,
                    };
                    e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
                    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = "move";
                    onDocumentDragStart?.(dragData);
                  };
                  
                  const handleDocDragEnd = () => {
                    onDocumentDragEnd?.();
                  };
                  
                  return (
                    <div
                      key={doc.path}
                      draggable={true}
                      onDragStart={handleDocDragStart}
                      onDragEnd={handleDocDragEnd}
                      className="group flex items-center hover:bg-gray-50 transition-colors"
                    >
                      {/* Drag handle */}
                      <div className="pl-2 pr-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <button
                        ref={(el) => {
                          if (el) itemRefs.current.set(docIndex, el);
                        }}
                        onClick={() => {
                          if (!isFolder(doc)) {
                            setFocusedIndex(docIndex);
                            onDocumentSelect(doc.path);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!isFolder(doc) && onDocumentEdit && isPdf(doc.mimeType)) {
                            onDocumentEdit(doc);
                          }
                        }}
                        onFocus={() => setFocusedIndex(docIndex)}
                        className={`flex-1 text-left px-3 py-3 flex items-center gap-3 transition-colors ${
                          selectedDocPath === doc.path 
                            ? "bg-blue-50 border-l-4 border-blue-500" 
                            : isFocused 
                              ? "bg-gray-100 ring-2 ring-inset ring-blue-300" 
                              : ""
                        }`}
                        title={isPdf(doc.mimeType) ? "Double-click to edit • Press E to edit, S to sign • Drag to move" : "Drag to move to another folder"}
                      >
                        <div className="shrink-0 relative">
                          {renderDocIcon(doc.mimeType)}
                          {docStatus && docStatus.status !== "draft" && (
                            <DocumentStatusDot 
                              status={docStatus.status} 
                              className="absolute -top-0.5 -right-0.5"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {doc.relative}
                            </span>
                            {docStatus && docStatus.status !== "draft" && (
                              <DocumentStatusBadge 
                                status={docStatus.status} 
                                size="sm"
                                signersProgress={docStatus.signersProgress}
                              />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{formatSize(doc.size)}</span>
                            <span>•</span>
                            <span>{new Date(doc.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        {/* Hover Actions - always visible on hover */}
                        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Sign Button - Primary for PDFs */}
                          {onDocumentSign && isPdf(doc.mimeType) && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onDocumentSign(doc);
                              }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Request signature (S)"
                            >
                              <PenTool className="w-4 h-4" />
                            </span>
                          )}
                          {/* Edit Button */}
                          {onDocumentEdit && isPdf(doc.mimeType) && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onDocumentEdit(doc);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit document (E)"
                            >
                              <FilePen className="w-4 h-4" />
                            </span>
                          )}
                          {/* Download Button */}
                          {onDocumentDownload && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onDocumentDownload(doc);
                              }}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                              title="Download (D)"
                            >
                              <Download className="w-4 h-4" />
                            </span>
                          )}
                          {/* Move/Copy Button */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              openCopyMoveModal(doc);
                            }}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                            title="Move or copy"
                          >
                            <FolderOutput className="w-4 h-4" />
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })
              )
            ) : (
              // Grid View with Thumbnails
              <div className="grid grid-cols-2 gap-2 p-2">
                {sortedDocuments.map((doc) => {
                  if (isFolder(doc)) return null;
                  const docStatus = documentStatuses?.get(doc.path);
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
                      {/* Status Badge - top left */}
                      {docStatus && docStatus.status !== "draft" && (
                        <div className="absolute top-1 left-1 z-10">
                          <DocumentStatusBadge 
                            status={docStatus.status} 
                            size="sm"
                            showIcon={true}
                            showLabel={false}
                          />
                        </div>
                      )}
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
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium text-gray-900 truncate flex-1" title={doc.relative}>
                            {doc.relative}
                          </p>
                          {docStatus && docStatus.status !== "draft" && (
                            <DocumentStatusDot status={docStatus.status} />
                          )}
                        </div>
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

/**
 * Enhanced Empty State Component
 * Shows engaging illustrations and CTAs when there are no documents
 */
function EmptyState({
  searchQuery,
  currentView,
}: {
  searchQuery: string;
  currentView: DocumentView;
}) {
  // Different illustrations and messages based on context
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <Search className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          No results found
        </h3>
        <p className="text-xs text-gray-500 max-w-xs mb-4">
          We couldn&apos;t find any documents matching &quot;{searchQuery}&quot;. 
          Try a different search term or clear the search.
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Tip: Search by file name or type</span>
        </div>
      </div>
    );
  }

  if (currentView === 'today') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
          <CalendarPlus className="w-7 h-7 text-green-500" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          No uploads today
        </h3>
        <p className="text-xs text-gray-500 max-w-xs mb-4">
          You haven&apos;t uploaded any documents today. 
          Start by uploading a file or creating from a template.
        </p>
        <div className="flex flex-col items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Recent uploads appear here automatically</span>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'recent') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
          <Clock className="w-7 h-7 text-blue-500" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          No recent documents
        </h3>
        <p className="text-xs text-gray-500 max-w-xs mb-4">
          Documents uploaded in the last 7 days will appear here.
        </p>
      </div>
    );
  }

  // Default empty state for folder view
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 mb-4 relative">
        {/* Stacked document illustration */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg transform rotate-3" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg transform -rotate-3" />
        <div className="absolute inset-0 bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        No documents yet
      </h3>
      <p className="text-xs text-gray-500 max-w-xs mb-6">
        Upload your first document to get started. You can drag and drop files 
        or click the Upload button above.
      </p>
      
      {/* Quick tips */}
      <div className="w-full max-w-sm space-y-2">
        <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg text-left">
          <div className="p-1.5 bg-blue-100 rounded-md">
            <FileUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-900">Drag & Drop</p>
            <p className="text-[10px] text-gray-500">Drop files anywhere to upload instantly</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-left">
          <div className="p-1.5 bg-purple-100 rounded-md">
            <PenTool className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-900">E-Signatures</p>
            <p className="text-[10px] text-gray-500">Upload PDFs and send for signature</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg text-left">
          <div className="p-1.5 bg-amber-100 rounded-md">
            <FilePen className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-900">Edit Documents</p>
            <p className="text-[10px] text-gray-500">Double-click PDFs to add annotations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
