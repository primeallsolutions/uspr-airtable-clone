import { useState, useMemo, useCallback, useEffect } from "react";
import { FileText, Image as ImageIcon, File, Loader2, Search, X, LayoutGrid, List } from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { DocumentsService } from "@/lib/services/documents-service";
import { formatSize, isImage, isPdf, isFolder } from "./utils";
import { DocumentSkeleton } from "./DocumentsSkeleton";
import { DocumentThumbnail } from "./DocumentThumbnail";

type DocumentsListProps = {
  documents: Array<StoredDocument & { relative: string }>;
  selectedDocPath: string | null;
  loading: boolean;
  error: string | null;
  folderPath: string;
  onDocumentSelect: (path: string) => void;
  onDocumentEdit?: (doc: StoredDocument & { relative: string }) => void;
  baseId: string;
  tableId?: string | null;
};

const renderDocIcon = (mimeType: string) => {
  if (isImage(mimeType)) return <ImageIcon className="w-4 h-4 text-blue-600" />;
  if (isPdf(mimeType)) return <FileText className="w-4 h-4 text-red-600" />;
  return <File className="w-4 h-4 text-gray-600" />;
};

export const DocumentsList = ({
  documents,
  selectedDocPath,
  loading,
  error,
  folderPath,
  onDocumentSelect,
  onDocumentEdit,
  baseId,
  tableId,
}: DocumentsListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    
    const query = searchQuery.toLowerCase();
    return documents.filter((doc) => {
      const fileName = doc.relative.toLowerCase();
      return fileName.includes(query);
    });
  }, [documents, searchQuery]);

  // Load signed URLs for thumbnails in grid view
  const loadSignedUrl = useCallback(async (doc: StoredDocument & { relative: string }) => {
    if (signedUrls[doc.path]) return;
    try {
      const url = await DocumentsService.getSignedUrl(baseId, tableId ?? null, doc.path);
      setSignedUrls(prev => ({ ...prev, [doc.path]: url }));
    } catch (err) {
      console.error("Failed to get signed URL for thumbnail:", err);
    }
  }, [baseId, tableId, signedUrls]);

  // Load signed URLs when grid view is active
  useEffect(() => {
    if (viewMode === "grid" && filteredDocuments.length > 0) {
      // Load URLs for visible documents (first 20)
      filteredDocuments.slice(0, 20).forEach(doc => {
        if (!signedUrls[doc.path]) {
          loadSignedUrl(doc);
        }
      });
    }
  }, [viewMode, filteredDocuments, loadSignedUrl, signedUrls]);

  return (
    <div className="border-r border-gray-200 min-h-0 overflow-y-auto flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Documents ({filteredDocuments.length}{searchQuery && ` of ${documents.length}`})
        </div>
        <div className="flex items-center gap-2">
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
      {folderPath ? (
        <div className="divide-y divide-gray-100">
          {loading ? (
            <DocumentSkeleton count={6} />
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              {searchQuery ? (
                <>No documents found matching &quot;{searchQuery}&quot;.</>
              ) : (
                <>No documents yet. Upload files to get started.</>
              )}
            </div>
          ) : (
            viewMode === "list" ? (
              // List View
              filteredDocuments.map((doc) => {
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
                    <div className="flex-shrink-0">{renderDocIcon(doc.mimeType)}</div>
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
                  </button>
                );
              })
            ) : (
              // Grid View with Thumbnails
              <div className="grid grid-cols-2 gap-2 p-2">
                {filteredDocuments.map((doc) => {
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
                      className={`relative p-2 rounded-lg border transition-all hover:shadow-md ${
                        selectedDocPath === doc.path
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      title={isPdf(doc.mimeType) ? "Double-click to edit" : ""}
                    >
                      {/* Thumbnail */}
                      <DocumentThumbnail
                        documentPath={doc.path}
                        baseId={baseId}
                        tableId={tableId}
                        signedUrl={signedUrls[doc.path]}
                        mimeType={doc.mimeType}
                        fileName={doc.relative}
                        className="w-full aspect-[3/4] mb-2"
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
    </div>
  );
};

