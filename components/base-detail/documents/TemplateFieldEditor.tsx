"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, Plus, Trash2, Type, Hash, Calendar, CheckSquare, PenTool, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DocumentTemplate, TemplateField } from "@/lib/services/template-service";

type TemplateFieldEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  template: DocumentTemplate | null;
  baseId: string;
  tableId?: string | null;
};

export const TemplateFieldEditor = ({
  isOpen,
  onClose,
  template,
  baseId,
  tableId,
}: TemplateFieldEditorProps) => {
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [editingField, setEditingField] = useState<TemplateField | null>(null);
  const [isPlacingField, setIsPlacingField] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && template) {
      loadTemplateData();
    }
  }, [isOpen, template]);

  const loadTemplateData = async () => {
    if (!template) return;

    try {
      setLoading(true);
      setError(null);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Load template PDF
      const response = await fetch(
        `/api/templates/${template.id}`,
        { headers }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load template");
      }
      const data = await response.json();
      const fullTemplate = data.template;

      // Get signed URL for template file
      const urlResponse = await fetch(
        `/api/templates/${template.id}/signed-url?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`,
        { headers }
      );
      if (!urlResponse.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get template URL");
      }
      const urlData = await urlResponse.json();
      setPdfUrl(urlData.url);

      // Load fields
      setFields(fullTemplate.fields || []);

      // Load PDF with pdfjs-dist
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument({ url: urlData.url });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
    } catch (err: any) {
      console.error("Failed to load template data", err);
      setError(err.message || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }
  }, [pdfDoc, currentPage, zoom, fields]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Draw field markers
      drawFieldMarkers(context, viewport);
    } catch (err) {
      console.error("Failed to render PDF page", err);
    }
  };

  const drawFieldMarkers = (context: CanvasRenderingContext2D, viewport: any) => {
    const pageFields = fields.filter((f) => f.page_number === currentPage);
    
    pageFields.forEach((field) => {
      const scale = viewport.scale;
      const x = field.x_position * scale;
      const y = viewport.height - field.y_position * scale; // PDF Y is from bottom
      const width = (field.width || 200) * scale;
      const height = (field.height || 20) * scale;

      // Draw field rectangle
      context.strokeStyle = selectedField?.id === field.id ? "#3b82f6" : "#10b981";
      context.lineWidth = 2;
      context.setLineDash([]);
      context.strokeRect(x, y - height, width, height);

      // Draw field label
      context.fillStyle = selectedField?.id === field.id ? "#3b82f6" : "#10b981";
      context.font = "12px Arial";
      context.fillText(field.field_name, x + 2, y - height - 5);
    });
  };

  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPlacingField || !canvasRef.current || !pdfDoc) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      // Convert canvas coordinates to PDF coordinates
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1 });
      const pdfX = x;
      const pdfY = viewport.height - y; // PDF Y is from bottom

      // Create new field
      const newField: TemplateField = {
        field_name: `Field ${fields.length + 1}`,
        field_key: `field_${fields.length + 1}`,
        field_type: "text",
        page_number: currentPage,
        x_position: pdfX,
        y_position: pdfY,
        width: 200,
        height: 20,
        font_size: 12,
        font_name: "Helvetica",
        is_required: false,
        order_index: fields.length,
      };

      setEditingField(newField);
      setIsPlacingField(false);
      renderPage();
    },
    [isPlacingField, zoom, currentPage, pdfDoc, fields.length]
  );

  const handleSaveField = async () => {
    if (!editingField || !template) return;

    try {
      setSaving(true);
      
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/templates/${template.id}/fields`, {
        method: "POST",
        headers,
        body: JSON.stringify({ field: editingField }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save field");
      }
      const data = await response.json();

      // Update fields list
      if (editingField.id) {
        setFields(fields.map((f) => (f.id === editingField.id ? data.field : f)));
      } else {
        setFields([...fields, data.field]);
      }

      setEditingField(null);
      await renderPage();
    } catch (err: any) {
      console.error("Failed to save field", err);
      setError(err.message || "Failed to save field");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!template || !window.confirm("Delete this field?")) return;

    try {
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(
        `/api/templates/${template.id}/fields?fieldId=${fieldId}`,
        { method: "DELETE", headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete field");
      }
      setFields(fields.filter((f) => f.id !== fieldId));
      if (selectedField?.id === fieldId) setSelectedField(null);
      await renderPage();
    } catch (err: any) {
      console.error("Failed to delete field", err);
      alert(err.message || "Failed to delete field");
    }
  };

  if (!isOpen || !template) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Template Fields: {template.name}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlacingField(!isPlacingField)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isPlacingField
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Plus className="w-4 h-4" />
              {isPlacingField ? "Click on PDF to place field" : "Add Field"}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/70 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* PDF Viewer */}
          <div className="flex-1 min-h-0 overflow-auto bg-gray-100 p-4" ref={containerRef}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-600">
                {error}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {/* Page Controls */}
                <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 disabled:opacity-50"
                  >
                    ←
                  </button>
                  <span className="text-sm">
                    Page {currentPage} of {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                    disabled={currentPage === numPages}
                    className="p-2 disabled:opacity-50"
                  >
                    →
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-2" />
                  <button
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                    className="p-2"
                  >
                    −
                  </button>
                  <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                    className="p-2"
                  >
                    +
                  </button>
                </div>

                {/* Canvas */}
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className={`border border-gray-300 shadow-lg ${isPlacingField ? "cursor-crosshair" : ""}`}
                  style={{ maxWidth: "100%" }}
                />
              </div>
            )}
          </div>

          {/* Fields Panel */}
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Fields ({fields.length})</h3>
              {isPlacingField && (
                <p className="text-xs text-green-600 mb-2">
                  Click on the PDF to place a new field
                </p>
              )}
            </div>

            <div className="flex-1 p-4 space-y-2">
              {fields
                .filter((f) => f.page_number === currentPage)
                .map((field) => (
                  <div
                    key={field.id}
                    onClick={() => {
                      setSelectedField(field);
                      setEditingField(field);
                    }}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedField?.id === field.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {field.field_name}
                        </div>
                        <div className="text-xs text-gray-500">{field.field_key}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (field.id) handleDeleteField(field.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {field.field_type === "text" && <Type className="w-3 h-3 text-gray-400" />}
                      {field.field_type === "number" && <Hash className="w-3 h-3 text-gray-400" />}
                      {field.field_type === "date" && <Calendar className="w-3 h-3 text-gray-400" />}
                      {field.field_type === "checkbox" && (
                        <CheckSquare className="w-3 h-3 text-gray-400" />
                      )}
                      {field.field_type === "signature" && (
                        <PenTool className="w-3 h-3 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-500 capitalize">{field.field_type}</span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Field Editor */}
            {editingField && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-900 mb-3">Edit Field</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Field Name
                    </label>
                    <input
                      type="text"
                      value={editingField.field_name}
                      onChange={(e) =>
                        setEditingField({ ...editingField, field_name: e.target.value })
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Field Key
                    </label>
                    <input
                      type="text"
                      value={editingField.field_key}
                      onChange={(e) =>
                        setEditingField({ ...editingField, field_key: e.target.value })
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Field Type
                    </label>
                    <select
                      value={editingField.field_type}
                      onChange={(e) =>
                        setEditingField({
                          ...editingField,
                          field_type: e.target.value as TemplateField["field_type"],
                        })
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="signature">Signature</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">X</label>
                      <input
                        type="number"
                        value={Math.round(editingField.x_position)}
                        onChange={(e) =>
                          setEditingField({
                            ...editingField,
                            x_position: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Y</label>
                      <input
                        type="number"
                        value={Math.round(editingField.y_position)}
                        onChange={(e) =>
                          setEditingField({
                            ...editingField,
                            y_position: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                      <input
                        type="number"
                        value={editingField.width || 200}
                        onChange={(e) =>
                          setEditingField({
                            ...editingField,
                            width: parseFloat(e.target.value) || 200,
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                      <input
                        type="number"
                        value={editingField.height || 20}
                        onChange={(e) =>
                          setEditingField({
                            ...editingField,
                            height: parseFloat(e.target.value) || 20,
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={editingField.font_size || 12}
                      onChange={(e) =>
                        setEditingField({
                          ...editingField,
                          font_size: parseFloat(e.target.value) || 12,
                        })
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingField.is_required || false}
                      onChange={(e) =>
                        setEditingField({ ...editingField, is_required: e.target.checked })
                      }
                      className="rounded"
                    />
                    <label className="text-xs text-gray-700">Required</label>
                  </div>
                  <button
                    onClick={handleSaveField}
                    disabled={saving || !editingField.field_name || !editingField.field_key}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Field
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

