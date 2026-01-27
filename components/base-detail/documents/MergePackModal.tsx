"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, FileText, Loader2, Save, ArrowRight, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StoredDocument } from "@/lib/services/documents-service";
import { toast } from "sonner";

type MergePackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  requestId?: string;
  onComplete?: () => void;
};

export const MergePackModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  requestId,
  onComplete,
}: MergePackModalProps) => {
  const [mode, setMode] = useState<"merge" | "pack">("merge");
  const [selectedDocuments, setSelectedDocuments] = useState<Array<{ path: string; title: string; order: number }>>([]);
  const [availableDocuments, setAvailableDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

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
    }
  }, [isOpen, baseId, tableId, loadDocuments]);

  const handleAddDocument = () => {
    setSelectedDocuments([
      ...selectedDocuments,
      { path: "", title: "", order: selectedDocuments.length },
    ]);
  };

  const handleRemoveDocument = (index: number) => {
    setSelectedDocuments(selectedDocuments.filter((_, i) => i !== index).map((doc, i) => ({ ...doc, order: i })));
  };

  const handleDocumentChange = (index: number, path: string) => {
    const updated = [...selectedDocuments];
    const doc = availableDocuments.find((d) => d.path === path);
    updated[index] = {
      path,
      title: doc ? doc.path.split("/").pop() || path : path,
      order: updated[index].order,
    };
    setSelectedDocuments(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...selectedDocuments];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated[index - 1].order = index - 1;
    updated[index].order = index;
    setSelectedDocuments(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedDocuments.length - 1) return;
    const updated = [...selectedDocuments];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated[index].order = index;
    updated[index + 1].order = index + 1;
    setSelectedDocuments(updated);
  };

  const handleMerge = async () => {
    if (selectedDocuments.length < 2) {
      toast.error("Please select at least 2 documents to merge");
      return;
    }

    const documentPaths = selectedDocuments
      .sort((a, b) => a.order - b.order)
      .map((d) => d.path);

    if (documentPaths.some((p) => !p)) {
      toast.error("Please select all documents");
      return;
    }

    try {
      setMerging(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Get full document paths
      const prefix = tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
      const fullPaths = documentPaths.map((path) =>
        path.startsWith(prefix) ? path : `${prefix}${path}`
      );

      if (!requestId) {
        toast.error("Request ID is required");
        return;
      }

      const response = await fetch(`/api/esignature/requests/${requestId}/pack/merge`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          document_paths: fullPaths,
          output_filename: `merged_${Date.now()}.pdf`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to merge documents");
      }

      toast.success("Documents merged successfully!");
      if (onComplete) {
        onComplete();
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to merge documents:", error);
      toast.error(error.message || "Failed to merge documents");
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === "merge" ? "Merge Documents" : "Create Document Pack"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {mode === "merge"
                ? "Combine multiple PDFs into a single document"
                : "Group multiple documents for signing"}
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
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {/* Mode Selection */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setMode("merge")}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === "merge"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Merge PDFs
            </button>
            <button
              onClick={() => setMode("pack")}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === "pack"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Create Pack
            </button>
          </div>

          {/* Documents List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Documents ({mode === "merge" ? "in merge order" : "in pack"})
              </label>
              <button
                onClick={handleAddDocument}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Document
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No documents selected</p>
                  </div>
                ) : (
                  selectedDocuments
                    .sort((a, b) => a.order - b.order)
                    .map((doc, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <select
                              value={doc.path}
                              onChange={(e) => handleDocumentChange(index, e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select a document...</option>
                              {availableDocuments
                                .filter((d) => !selectedDocuments.find((sd) => sd.path === d.path && sd.order !== index))
                                .map((availableDoc) => (
                                  <option key={availableDoc.path} value={availableDoc.path}>
                                    {availableDoc.path}
                                  </option>
                                ))}
                            </select>
                            {doc.title && (
                              <p className="text-xs text-gray-500 mt-1">{doc.title}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMoveDown(index)}
                              disabled={index === selectedDocuments.length - 1}
                              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveDocument(index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {mode === "merge" && selectedDocuments.length >= 2 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Documents will be merged in the order shown above. The merged document will replace the current request document.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedDocuments.filter((d) => d.path).length} document(s) selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {mode === "merge" && (
              <button
                onClick={handleMerge}
                disabled={merging || selectedDocuments.length < 2}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Merge Documents
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};








