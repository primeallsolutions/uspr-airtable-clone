"use client";

import { Eye, Hash, CalendarClock, Pencil, Trash2, Scissors, History } from "lucide-react";
import { useState } from "react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { PdfViewer } from "../PdfViewer";
import { isPdf, isImage, isFolder } from "./utils";
import { PreviewSkeleton } from "./DocumentsSkeleton";
import { DocumentVersionHistory } from "./DocumentVersionHistory";
import { TransactionMetadata } from "./TransactionMetadata";

type DocumentPreviewProps = {
  selectedDoc: StoredDocument | null;
  signedUrl: string | null;
  viewerError: string | null;
  baseId?: string;
  tableId?: string | null;
  onRename: () => void;
  onDelete: () => void;
  onSplit?: () => void;
  loading?: boolean;
  // Transaction metadata support
  recordId?: string | null;
};

export const DocumentPreview = ({
  selectedDoc,
  signedUrl,
  viewerError,
  baseId,
  tableId,
  onRename,
  onDelete,
  onSplit,
  loading = false,
  recordId,
}: DocumentPreviewProps) => {
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  return (
    <div className="min-h-0 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Preview
        </div>
        {selectedDoc && !isFolder(selectedDoc) && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span>{selectedDoc.path.slice(-8)}</span>
            </div>
            {baseId && (
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showVersionHistory
                    ? "bg-purple-100 text-purple-600"
                    : "hover:bg-purple-100 text-gray-600 hover:text-purple-600"
                }`}
                title="Version History"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            {isPdf(selectedDoc.mimeType) && onSplit && (
              <button
                onClick={onSplit}
                className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                title="Split PDF - Extract pages to a new document"
              >
                <Scissors className="w-4 h-4 text-blue-600" />
              </button>
            )}
            <button
              onClick={onRename}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="Rename document"
            >
              <Pencil className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
              title="Delete document"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-gray-50 p-4">
        {loading && !selectedDoc ? (
          <PreviewSkeleton />
        ) : selectedDoc && !isFolder(selectedDoc) ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {selectedDoc.path.split("/").pop()}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <CalendarClock className="w-4 h-4" />
                  <span>{new Date(selectedDoc.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            {/* Transaction Metadata - Show linked record data */}
            {baseId && (
              <TransactionMetadata
                baseId={baseId}
                tableId={tableId}
                documentPath={selectedDoc.path}
                recordId={recordId}
              />
            )}
            <div className="flex-1 min-h-0">
              {viewerError ? (
                <div className="h-full flex items-center justify-center text-sm text-red-600">
                  {viewerError}
                </div>
              ) : isPdf(selectedDoc.mimeType) ? (
                signedUrl ? (
                  <PdfViewer fileUrl={signedUrl} />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-500">
                    Loading preview...
                  </div>
                )
              ) : isImage(selectedDoc.mimeType) ? (
                signedUrl ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signedUrl}
                      alt={selectedDoc.path}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-500">
                    Loading preview...
                  </div>
                )
              ) : signedUrl ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-600">
                  Preview not available.{" "}
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    Open file
                  </a>
                  .
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  Loading preview...
                </div>
              )}
            </div>

            {/* Version History Panel */}
            {showVersionHistory && baseId && selectedDoc && (
              <div className="border-t border-gray-200 p-4">
                <DocumentVersionHistory
                  documentPath={selectedDoc.path}
                  baseId={baseId}
                  tableId={tableId}
                  onVersionRestored={() => {
                    // Could trigger a refresh here
                  }}
                />
              </div>
            )}
          </div>
        ) : selectedDoc && isFolder(selectedDoc) ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            This is a folder. Please select a file to preview.
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            Select a document to preview.
          </div>
        )}
      </div>
    </div>
  );
};
