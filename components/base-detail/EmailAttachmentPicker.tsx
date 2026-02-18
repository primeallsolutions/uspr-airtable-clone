"use client";

import { useState, useEffect } from "react";
import {
  Paperclip,
  File,
  FileText,
  FileImage,
  FileArchive,
  X,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RecordDocument {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  storage_path: string;
}

interface EmailAttachmentPickerProps {
  recordId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxTotalSize?: number; // in bytes, default 10MB
}

export const EmailAttachmentPicker = ({
  recordId,
  selectedIds,
  onSelectionChange,
  maxTotalSize = 10 * 1024 * 1024, // 10MB default
}: EmailAttachmentPickerProps) => {
  const [documents, setDocuments] = useState<RecordDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Get file icon based on content type
  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) {
      return <FileImage className="w-4 h-4 text-purple-500" />;
    }
    if (contentType.includes("pdf")) {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (contentType.includes("zip") || contentType.includes("archive")) {
      return <FileArchive className="w-4 h-4 text-yellow-500" />;
    }
    if (contentType.includes("document") || contentType.includes("word")) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
  };

  // Calculate total size of selected documents
  const selectedDocuments = documents.filter((d) => selectedIds.includes(d.id));
  const totalSelectedSize = selectedDocuments.reduce((sum, d) => sum + d.size, 0);
  const isOverLimit = totalSelectedSize > maxTotalSize;

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        // Fetch record documents
        const { data, error: fetchError } = await supabase
          .from("record_documents")
          .select("id, filename, content_type, size, storage_path")
          .eq("record_id", recordId)
          .order("created_at", { ascending: false });

        if (fetchError) {
          throw new Error("Failed to fetch documents");
        }

        setDocuments(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    if (recordId) {
      fetchDocuments();
    }
  }, [recordId]);

  // Toggle document selection
  const toggleDocument = (docId: string) => {
    if (selectedIds.includes(docId)) {
      onSelectionChange(selectedIds.filter((id) => id !== docId));
    } else {
      // Check if adding would exceed limit
      const doc = documents.find((d) => d.id === docId);
      if (doc && totalSelectedSize + doc.size > maxTotalSize) {
        // Don't add if it would exceed limit
        return;
      }
      onSelectionChange([...selectedIds, docId]);
    }
  };

  // Remove selected document
  const removeDocument = (docId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== docId));
  };

  return (
    <div className="space-y-2">
      {/* Selected attachments display */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-sm"
            >
              {getFileIcon(doc.content_type)}
              <span className="text-gray-700 truncate max-w-[150px]">
                {doc.filename}
              </span>
              <span className="text-gray-400 text-xs">
                {formatSize(doc.size)}
              </span>
              <button
                type="button"
                onClick={() => removeDocument(doc.id)}
                className="p-0.5 hover:bg-blue-100 rounded"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Size warning */}
      {isOverLimit && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          Total size exceeds {formatSize(maxTotalSize)} limit
        </div>
      )}

      {/* Total size indicator */}
      {selectedIds.length > 0 && !isOverLimit && (
        <div className="text-xs text-gray-500">
          Total: {formatSize(totalSelectedSize)} / {formatSize(maxTotalSize)}
        </div>
      )}

      {/* Attachment picker button and dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
        >
          <Paperclip className="w-4 h-4" />
          Attach Documents
          {selectedIds.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {selectedIds.length}
            </span>
          )}
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute z-20 mt-1 w-80 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              ) : documents.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No documents available for this record
                </div>
              ) : (
                <div>
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
                    Select documents to attach
                  </div>
                  {documents.map((doc) => {
                    const isSelected = selectedIds.includes(doc.id);
                    const wouldExceedLimit = !isSelected && totalSelectedSize + doc.size > maxTotalSize;

                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => toggleDocument(doc.id)}
                        disabled={wouldExceedLimit}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                          isSelected ? "bg-blue-50" : ""
                        } ${wouldExceedLimit ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className={`w-5 h-5 flex items-center justify-center border rounded ${
                          isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {getFileIcon(doc.content_type)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">
                            {doc.filename}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatSize(doc.size)}
                            {wouldExceedLimit && (
                              <span className="ml-2 text-red-500">Exceeds limit</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
