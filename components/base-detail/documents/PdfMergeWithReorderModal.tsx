"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  FileText,
  Loader2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ArrowsUpFromLine,
  Check,
  File,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StoredDocument } from "@/lib/services/documents-service";
import { DocumentActivityService } from "@/lib/services/document-activity-service";
import { toast } from "sonner";

type PageItem = {
  id: string;
  documentPath: string;
  documentName: string;
  pageNumber: number;
  totalPages: number;
};

type LoadedDocument = {
  path: string;
  name: string;
  signedUrl: string;
  totalPages: number;
};

type PdfMergeWithReorderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  onMergeComplete?: () => void;
};

export const PdfMergeWithReorderModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  onMergeComplete,
}: PdfMergeWithReorderModalProps) => {
  const [availableDocuments, setAvailableDocuments] = useState<StoredDocument[]>([]);
  const [loadedDocuments, setLoadedDocuments] = useState<LoadedDocument[]>([]);
  const [selectedPages, setSelectedPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [outputFileName, setOutputFileName] = useState("merged_document");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // PDF preview state
  const [previewPage, setPreviewPage] = useState<PageItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load available PDF documents
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const { DocumentsService } = await import("@/lib/services/documents-service");
      const docs = await DocumentsService.listDocuments(baseId, tableId);
      const pdfDocs = docs.filter((doc) => doc.path.toLowerCase().endsWith(".pdf"));
      setAvailableDocuments(pdfDocs);
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      setSelectedPages([]);
      setLoadedDocuments([]);
      setOutputFileName("merged_document");
    }
  }, [isOpen, loadDocuments]);

  // Add document to merge queue
  const handleAddDocument = async (doc: StoredDocument) => {
    // Check if already loaded
    if (loadedDocuments.some((d) => d.path === doc.path)) {
      toast.info("Document already added");
      return;
    }

    try {
      setLoadingDocument(doc.path);
      
      // Get signed URL
      const prefix = tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
      const fullPath = doc.path.startsWith(prefix) ? doc.path : `${prefix}${doc.path}`;
      
      const { data: urlData, error: urlError } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents")
        .createSignedUrl(fullPath, 3600);

      if (urlError || !urlData) {
        throw new Error("Failed to get document URL");
      }

      // Load PDF to get page count
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument({ url: urlData.signedUrl });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const loadedDoc: LoadedDocument = {
        path: doc.path,
        name: doc.path.split("/").pop() || doc.path,
        signedUrl: urlData.signedUrl,
        totalPages,
      };

      setLoadedDocuments((prev) => [...prev, loadedDoc]);

      // Add all pages from this document
      const newPages: PageItem[] = [];
      for (let i = 1; i <= totalPages; i++) {
        newPages.push({
          id: `${doc.path}-${i}-${Date.now()}`,
          documentPath: doc.path,
          documentName: loadedDoc.name,
          pageNumber: i,
          totalPages,
        });
      }
      setSelectedPages((prev) => [...prev, ...newPages]);

      toast.success(`Added ${totalPages} pages from ${loadedDoc.name}`);
    } catch (error) {
      console.error("Failed to load document:", error);
      toast.error("Failed to load document");
    } finally {
      setLoadingDocument(null);
    }
  };

  // Remove document and its pages
  const handleRemoveDocument = (docPath: string) => {
    setLoadedDocuments((prev) => prev.filter((d) => d.path !== docPath));
    setSelectedPages((prev) => prev.filter((p) => p.documentPath !== docPath));
  };

  // Remove single page
  const handleRemovePage = (pageId: string) => {
    setSelectedPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newPages = [...selectedPages];
      const [draggedItem] = newPages.splice(draggedIndex, 1);
      newPages.splice(dragOverIndex, 0, draggedItem);
      setSelectedPages(newPages);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Move page up/down
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newPages = [...selectedPages];
    [newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]];
    setSelectedPages(newPages);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedPages.length - 1) return;
    const newPages = [...selectedPages];
    [newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]];
    setSelectedPages(newPages);
  };

  // Preview page
  const handlePreviewPage = useCallback(async (page: PageItem) => {
    const loadedDoc = loadedDocuments.find((d) => d.path === page.documentPath);
    if (!loadedDoc) return;

    try {
      setPreviewPage(page);

      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument({ url: loadedDoc.signedUrl });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
    } catch (err) {
      console.error("Failed to load PDF for preview:", err);
    }
  }, [loadedDocuments]);

  // Render preview page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !previewPage) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(previewPage.pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });

      const containerWidth = 300;
      const containerHeight = 400;
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY, 1.5);

      const scaledViewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render page:", err);
      }
      renderTaskRef.current = null;
    }
  }, [pdfDoc, previewPage]);

  useEffect(() => {
    if (pdfDoc && previewPage && canvasRef.current) {
      renderPage();
    }

    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, previewPage, renderPage]);

  // Handle merge
  const handleMerge = async () => {
    if (selectedPages.length < 2) {
      toast.error("Please add at least 2 pages to merge");
      return;
    }

    if (!outputFileName.trim()) {
      toast.error("Please enter an output file name");
      return;
    }

    try {
      setMerging(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const pages = selectedPages.map((p) => ({
        documentPath: p.documentPath,
        pageNumber: p.pageNumber,
      }));

      const response = await fetch("/api/documents/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          baseId,
          tableId,
          pages,
          outputFileName: outputFileName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to merge documents");
      }

      const result = await response.json();

      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId,
        action: "upload",
        documentPath: result.documentPath,
        documentName: result.fileName,
        metadata: {
          operation: "merge",
          sourceDocuments: loadedDocuments.map((d) => d.name),
          pageCount: result.pageCount,
        },
      });

      toast.success("Documents merged successfully!", {
        description: `Created ${result.fileName} with ${result.pageCount} pages`,
      });

      if (onMergeComplete) {
        onMergeComplete();
      }
      onClose();
    } catch (err) {
      console.error("Failed to merge documents:", err);
      toast.error("Failed to merge documents", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const availableToAdd = availableDocuments.filter(
    (d) => !loadedDocuments.some((ld) => ld.path === d.path)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ArrowsUpFromLine className="w-5 h-5 text-blue-600" />
              Merge PDFs with Page Reordering
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select documents, then drag and drop pages to reorder before merging
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/70 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Panel - Document Selection */}
          <div className="w-64 border-r border-gray-200 flex flex-col p-4">
            <h3 className="font-medium text-gray-900 mb-3">Select PDFs</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2">
                {availableToAdd.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {availableDocuments.length === 0
                      ? "No PDF documents found"
                      : "All documents added"}
                  </p>
                ) : (
                  availableToAdd.map((doc) => (
                    <button
                      key={doc.path}
                      onClick={() => handleAddDocument(doc)}
                      disabled={loadingDocument === doc.path}
                      className="w-full p-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {loadingDocument === doc.path ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <Plus className="w-4 h-4 text-blue-600" />
                      )}
                      <span className="truncate flex-1">
                        {doc.path.split("/").pop()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Added Documents */}
            {loadedDocuments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Added ({loadedDocuments.length})
                </h4>
                <div className="space-y-1">
                  {loadedDocuments.map((doc) => (
                    <div
                      key={doc.path}
                      className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-xs"
                    >
                      <FileText className="w-3 h-3 text-blue-600 flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <span className="text-blue-600 font-medium">
                        {doc.totalPages}p
                      </span>
                      <button
                        onClick={() => handleRemoveDocument(doc.path)}
                        className="p-1 hover:bg-blue-100 rounded text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Middle Panel - Page Order */}
          <div className="flex-1 flex flex-col p-4 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">
                Page Order ({selectedPages.length} pages)
              </h3>
              {selectedPages.length > 0 && (
                <button
                  onClick={() => setSelectedPages([])}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedPages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Add documents from the left panel</p>
                  <p className="text-sm">Pages will appear here for reordering</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  {selectedPages.map((page, index) => (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handlePreviewPage(page)}
                      className={`relative group p-2 border rounded-lg cursor-move transition-all ${
                        draggedIndex === index
                          ? "opacity-50 border-blue-400 bg-blue-50"
                          : dragOverIndex === index
                          ? "border-blue-400 border-2"
                          : previewPage?.id === page.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {/* Page Number Badge */}
                      <div className="absolute top-1 left-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                        {index + 1}
                      </div>

                      {/* Drag Handle */}
                      <div className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                        <GripVertical className="w-3 h-3 text-gray-400" />
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePage(page.id);
                        }}
                        className="absolute bottom-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 rounded text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {/* Page Thumbnail Placeholder */}
                      <div className="aspect-[3/4] bg-gray-100 rounded flex items-center justify-center mb-1">
                        <FileText className="w-6 h-6 text-gray-400" />
                      </div>

                      {/* Page Info */}
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          Page {page.pageNumber}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {page.documentName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output Filename */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output File Name
              </label>
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={outputFileName}
                  onChange={(e) => setOutputFileName(e.target.value)}
                  placeholder="merged_document"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-500">.pdf</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="w-80 border-l border-gray-200 flex flex-col p-4">
            <h3 className="font-medium text-gray-900 mb-3">Page Preview</h3>
            
            {previewPage ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
                  <canvas ref={canvasRef} className="max-w-full max-h-full" />
                </div>
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">
                    {previewPage.documentName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Page {previewPage.pageNumber} of {previewPage.totalPages}
                  </p>
                </div>

                {/* Move Controls */}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      const idx = selectedPages.findIndex((p) => p.id === previewPage.id);
                      if (idx > 0) handleMoveUp(idx);
                    }}
                    disabled={selectedPages.findIndex((p) => p.id === previewPage.id) === 0}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move up in order"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-500">
                    Position: {selectedPages.findIndex((p) => p.id === previewPage.id) + 1}
                  </span>
                  <button
                    onClick={() => {
                      const idx = selectedPages.findIndex((p) => p.id === previewPage.id);
                      if (idx < selectedPages.length - 1) handleMoveDown(idx);
                    }}
                    disabled={
                      selectedPages.findIndex((p) => p.id === previewPage.id) ===
                      selectedPages.length - 1
                    }
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move down in order"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm text-center">
                <div>
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Click a page to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedPages.length} pages from {loadedDocuments.length} document(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={merging}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={merging || selectedPages.length < 2 || !outputFileName.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Merge {selectedPages.length} Pages
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
