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
  PenTool,
  CheckSquare,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import {
  RecordDocumentsService,
  type RecordDocument,
} from "@/lib/services/record-documents-service";

import { SignatureRequestModal } from "./SignatureRequestModal";
import { SignatureRequestStatus } from "./SignatureRequestStatus";
import { PdfEditor } from "./pdf-editor";
import type { SignatureRequestData } from "./pdf-editor/types";
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
  
  // PDF Editor state
  const [editorDoc, setEditorDoc] = useState<RecordDocument | null>(null);
  const [editorSignedUrl, setEditorSignedUrl] = useState<string | null>(null);
  
  // Signature request state - document to use when opening signature modal from editor
  const [signatureRequestDoc, setSignatureRequestDoc] = useState<RecordDocument | null>(null);
  const [signatureRequestData, setSignatureRequestData] = useState<SignatureRequestData | null>(null);
  
  // Modal stack management - only one modal visible at a time
  type ModalType = 'none' | 'signature-request' | 'signature-status';
  const [activeModal, setActiveModal] = useState<ModalType>('none');

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

  // Handle preview - opens PdfEditor for PDFs, simple preview for other files
  const handlePreview = async (doc: RecordDocument) => {
    try {
      console.log("[RecordDocuments] Previewing document:", doc.document_name, "Path:", doc.document_path);
      // Pass baseId, recordId, and tableId to help construct full path for relative paths
      const url = await RecordDocumentsService.getSignedUrl(
        doc.document_path, 
        3600, 
        { 
          baseId: doc.base_id || baseId, 
          recordId: doc.record_id || recordId,
          tableId: doc.table_id || tableId 
        }
      );
      
      if (doc.mime_type === "application/pdf") {
        // Open in PdfEditor for full editing capabilities
        setEditorDoc(doc);
        setEditorSignedUrl(url);
      } else {
        // Keep existing simple preview for images/other files
        setPreviewUrl(url);
        setPreviewDoc(doc);
      }
    } catch (err: unknown) {
      console.error("[RecordDocuments] Failed to get preview URL for:", doc.document_path, "Error:", err);
      
      // Check if file was not found in storage
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNotFound = errorMessage.toLowerCase().includes("not found") || 
                         errorMessage.includes("Object not found") ||
                         errorMessage === "";  // Empty error often means file not found
      
      if (isNotFound) {
        // Offer to clean up the orphaned record
        const shouldCleanup = window.confirm(
          `The file "${doc.document_name}" was not found in storage. It may have been deleted.\n\n` +
          `Path: ${doc.document_path}\n\n` +
          `Would you like to remove this entry from your documents list?`
        );
        
        if (shouldCleanup) {
          try {
            await RecordDocumentsService.removeOrphanedRecord(doc.id);
            toast.success("Removed missing document from list");
            await loadDocuments();
          } catch (cleanupErr) {
            console.error("Failed to clean up orphaned record:", cleanupErr);
            toast.error("Failed to remove document entry");
          }
        }
      } else {
        toast.error(`Failed to load preview: ${errorMessage || "Unknown error"}`);
      }
    }
  };

  // Handle PDF Editor close
  const handleEditorClose = () => {
    setEditorDoc(null);
    setEditorSignedUrl(null);
  };

  // Handle saving edited PDF
  const handleEditorSave = async (file: File) => {
    if (!editorDoc) return;
    
    const toastId = toast.loading("Saving document...");
    
    try {
      // Upload edited file as a new version (preserves original)
      await RecordDocumentsService.uploadAndAttach({
        recordId,
        baseId,
        tableId,
        file,
      });
      
      // Refresh document list
      await loadDocuments();
      
      // Close editor
      setEditorDoc(null);
      setEditorSignedUrl(null);
      
      toast.success("Document saved successfully", { id: toastId });
    } catch (err) {
      console.error("Failed to save document:", err);
      toast.error("Failed to save document", { id: toastId });
    }
  };

  // Handle request signature from PDF Editor
  // Note: signatureFields param is available but we use the SignatureRequestModal's
  // built-in field placement instead for better UX
  const handleRequestSignatureFromEditor = (data?: SignatureRequestData) => {
    if (!editorDoc) return;
    
    // Save reference to current doc for signature request
    setSignatureRequestDoc(editorDoc);
    
    // Save signature request data from PDF Editor (signers, fields, assignments)
    if (data) {
      setSignatureRequestData(data);
    }
    
    // Close editor
    setEditorDoc(null);
    setEditorSignedUrl(null);
    
    // Open signature modal with this document pre-selected
    setActiveModal('signature-request');
  };

  // Handle download
  const handleDownload = async (doc: RecordDocument) => {
    try {
      // Pass baseId, recordId, and tableId to help construct full path for relative paths
      const url = await RecordDocumentsService.getSignedUrl(
        doc.document_path,
        3600,
        { 
          baseId: doc.base_id || baseId, 
          recordId: doc.record_id || recordId,
          tableId: doc.table_id || tableId 
        }
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error("Failed to download:", err);
      
      // Check if file was not found in storage
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("not found") || errorMessage.includes("Object not found")) {
        const shouldCleanup = window.confirm(
          `The file "${doc.document_name}" was not found in storage. It may have been deleted.\n\n` +
          `Would you like to remove this entry from your documents list?`
        );
        
        if (shouldCleanup) {
          try {
            await RecordDocumentsService.removeOrphanedRecord(doc.id);
            toast.success("Removed missing document from list");
            await loadDocuments();
          } catch (cleanupErr) {
            console.error("Failed to clean up orphaned record:", cleanupErr);
            toast.error("Failed to remove document entry");
          }
        }
      } else {
        toast.error("Failed to download document");
      }
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
            onClick={() => setActiveModal('signature-request')}
            className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 border border-purple-700 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5"
            title="Request e-signature for documents"
          >
            <PenTool className="w-4 h-4" />
            Request Signature
          </button>
          <button
            onClick={() => setActiveModal('signature-status')}
            className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5"
            title="View signature request status"
          >
            <CheckSquare className="w-4 h-4" />
            View Requests
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
                  {/* Edit button for PDFs - opens full editor */}
                  {doc.mime_type === "application/pdf" && (
                    <button
                      onClick={() => handlePreview(doc)}
                      className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Edit document"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={doc.mime_type === "application/pdf" ? "View/Edit" : "Preview"}
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

      {/* PDF Editor Modal */}
      <PdfEditor
        document={editorDoc ? {
          path: editorDoc.document_path,
          mimeType: editorDoc.mime_type || undefined,
        } : null}
        signedUrl={editorSignedUrl}
        isOpen={Boolean(editorDoc)}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
        onRequestSignature={handleRequestSignatureFromEditor}
        // Record context for enhanced signature request features
        recordId={recordId}
        availableFields={fields?.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          options: f.options as Record<string, { name?: string; label?: string }> | undefined
        }))}
        recordValues={recordValues}
      />

      {/* Signature Request Modal */}
      <SignatureRequestModal
        isOpen={activeModal === 'signature-request'}
        onClose={() => {
          setActiveModal('none');
          setSignatureRequestDoc(null);
          setSignatureRequestData(null);
        }}
        baseId={baseId}
        tableId={tableId}
        recordId={recordId}
        selectedDocument={signatureRequestDoc ? {
          path: signatureRequestDoc.document_path,
          size: signatureRequestDoc.size_bytes || 0,
          mimeType: signatureRequestDoc.mime_type || "application/pdf",
          createdAt: signatureRequestDoc.created_at,
        } : undefined}
        availableFields={fields?.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          options: f.options as Record<string, { name?: string; label?: string }> | undefined
        }))}
        recordValues={recordValues}
        onRequestCreated={() => {
          toast.success("Signature request created successfully");
          setActiveModal('none');
          setSignatureRequestDoc(null);
          setSignatureRequestData(null);
        }}
        // Pre-populated data from PDF Editor SignerPanel
        initialSigners={signatureRequestData?.signers.map(s => ({
          email: s.email,
          name: s.name,
          role: s.role,
          signOrder: s.signOrder,
        }))}
        initialSignatureFields={signatureRequestData?.signatureFields.map(f => ({
          id: f.id,
          pageIndex: f.pageIndex,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          label: f.label,
          fieldType: f.fieldType,
          assignedTo: f.assignedTo,
        }))}
        initialFieldAssignments={signatureRequestData?.fieldAssignments}
      />

      {/* Signature Request Status Modal */}
      {activeModal === 'signature-status' && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Signature Requests</h2>
              <button
                onClick={() => setActiveModal('none')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <SignatureRequestStatus
                baseId={baseId}
                tableId={tableId}
                recordId={recordId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
