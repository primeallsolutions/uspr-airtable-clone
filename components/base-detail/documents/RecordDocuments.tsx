"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  ExternalLink,
  X,
  FolderOpen,
  FileEdit,
} from "lucide-react";
import { toast } from "sonner";
import {
  RecordDocumentsService,
  type RecordDocument,
} from "@/lib/services/record-documents-service";

import { DocumentGeneratorForm } from "./DocumentGeneratorForm";
import { TemplateManagementModal } from "./TemplateManagementModal";
import type { DocumentTemplate } from "@/lib/services/template-service";
import type { FieldRow } from "@/lib/types/base-detail";

type RecordDocumentsProps = {
  recordId: string;
  baseId: string;
  tableId?: string | null;
  recordName?: string;
  recordValues?: Record<string, unknown>;
  fields?: FieldRow[];
};

// Helper to get file icon based on mime type
const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return <File className="w-5 h-5 text-gray-400" />;
  if (mimeType.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-purple-500" />;
  if (mimeType === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return <FileText className="w-5 h-5 text-green-500" />;
  return <File className="w-5 h-5 text-gray-400" />;
};

// Format file size
const formatSize = (bytes: number | null): string => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const RecordDocuments = ({
  recordId,
  baseId,
  tableId,
  recordName,
  recordValues,
  fields,
}: RecordDocumentsProps) => {
  const router = useRouter();
  const [documents, setDocuments] = useState<RecordDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<RecordDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showGeneratorForm, setShowGeneratorForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  // Navigate to advanced documents page
  const handleAdvancedDocuments = () => {
    router.push(`/bases/${baseId}/records/${recordId}/documents${tableId ? `?tableId=${tableId}` : ""}`);
  };

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await RecordDocumentsService.getRecordDocuments(recordId);
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load record documents:", err);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handle file upload
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`);

    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(files)) {
      try {
        await RecordDocumentsService.uploadAndAttach({
          recordId,
          baseId,
          tableId,
          file,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        failCount++;
      }
    }

    await loadDocuments();
    setUploading(false);

    if (failCount === 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`, { id: toastId });
    } else {
      toast.warning(`Uploaded ${successCount}, failed ${failCount}`, { id: toastId });
    }
  };

  // Handle delete
  const handleDelete = async (doc: RecordDocument) => {
    if (!window.confirm(`Remove "${doc.document_name}" from this record?`)) return;

    setDeleting(doc.id);
    try {
      await RecordDocumentsService.detachDocument(doc.id, { deleteFile: true });
      toast.success("Document removed");
      await loadDocuments();
    } catch (err) {
      console.error("Failed to delete document:", err);
      toast.error("Failed to remove document");
    } finally {
      setDeleting(null);
    }
  };

  // Handle preview
  const handlePreview = async (doc: RecordDocument) => {
    try {
      const url = await RecordDocumentsService.getSignedUrl(doc.document_path);
      setPreviewUrl(url);
      setPreviewDoc(doc);
    } catch (err) {
      console.error("Failed to get preview URL:", err);
      toast.error("Failed to load preview");
    }
  };

  // Handle download
  const handleDownload = async (doc: RecordDocument) => {
    try {
      const url = await RecordDocumentsService.getSignedUrl(doc.document_path);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download:", err);
      toast.error("Failed to download document");
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Attached Documents</h3>
          <span className="text-sm text-gray-500">({documents.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-green-700 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
            title="Generate document from template with auto-filled record data"
          >
            <FileText className="w-4 h-4" />
            Generate
          </button>
          <button
            onClick={handleAdvancedDocuments}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            title="Advanced operations: templates, e-signatures, merge, etc."
          >
            <FileEdit className="w-4 h-4" />
            Advanced
          </button>
          <label className="cursor-pointer px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Attach Files
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Content */}
      <div
        className={`p-4 min-h-[150px] ${isDragging ? "bg-blue-50 border-2 border-dashed border-blue-400" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <FolderOpen className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm">No documents attached</p>
            <p className="text-xs text-gray-400 mt-1">
              Drag & drop files here or click Attach Files
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-gray-50 transition-colors group"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(doc.mime_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block text-left w-full"
                    title={doc.document_name}
                  >
                    {doc.document_name}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatSize(doc.size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deleting === doc.id}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    {deleting === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && previewUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setPreviewDoc(null);
            setPreviewUrl(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] w-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon(previewDoc.mime_type)}
                <span className="font-medium text-gray-900 truncate max-w-md">
                  {previewDoc.document_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewUrl(null);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {previewDoc.mime_type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewDoc.document_name}
                  className="max-w-full max-h-[70vh] mx-auto object-contain"
                />
              ) : previewDoc.mime_type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] border-0 rounded-lg"
                  title={previewDoc.document_name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <File className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium mb-2">Preview not available</p>
                  <p className="text-sm">
                    Click download to view this file
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      <TemplateManagementModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        baseId={baseId}
        tableId={tableId}
        onTemplateSelect={(template) => {
          setSelectedTemplate(template);
          setShowTemplateModal(false);
          setShowGeneratorForm(true);
        }}
        onEditFields={() => {
          // Not needed in this context
          setShowTemplateModal(false);
        }}
      />

      {/* Document Generator Form with Record Auto-Fill */}
      {selectedTemplate && (
        <DocumentGeneratorForm
          isOpen={showGeneratorForm}
          onClose={() => {
            setShowGeneratorForm(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
          baseId={baseId}
          tableId={tableId}
          recordId={recordId}
          recordValues={recordValues}
          recordFields={fields}
          onDocumentGenerated={() => {
            loadDocuments();
            setShowGeneratorForm(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};
