import { FileText, Image as ImageIcon, File, Loader2 } from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { formatSize, isImage, isPdf, isFolder } from "./utils";
import { DocumentSkeleton } from "./DocumentsSkeleton";

type DocumentsListProps = {
  documents: Array<StoredDocument & { relative: string }>;
  selectedDocPath: string | null;
  loading: boolean;
  error: string | null;
  folderPath: string;
  onDocumentSelect: (path: string) => void;
  onDocumentEdit?: (doc: StoredDocument & { relative: string }) => void;
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
}: DocumentsListProps) => {
  return (
    <div className="border-r border-gray-200 min-h-0 overflow-y-auto">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Documents ({documents.length})
        </div>
        {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
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
          ) : documents.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No documents yet. Upload files to get started.
            </div>
          ) : (
            documents.map((doc) => {
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
                  // Open editor on double-click for PDF and Word files
                  if (!isFolder(doc) && onDocumentEdit && (isPdf(doc.mimeType) || doc.mimeType.includes("word") || doc.mimeType.includes("document"))) {
                    onDocumentEdit(doc);
                  }
                }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                  selectedDocPath === doc.path ? "bg-blue-50 border-l-4 border-blue-500" : ""
                }`}
                title={isPdf(doc.mimeType) || doc.mimeType.includes("word") || doc.mimeType.includes("document") ? "Double-click to edit" : ""}
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
          )}
        </div>
      ) : (
        <div className="p-6 text-sm text-gray-500">Select a folder to view documents.</div>
      )}
    </div>
  );
};

