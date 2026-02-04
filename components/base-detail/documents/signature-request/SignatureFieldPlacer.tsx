"use client";

/**
 * SignatureFieldPlacer Component
 * 
 * PDF preview with interactive signature field placement.
 * Supports both template mode (viewing existing fields) and document mode (placing new fields).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  PenTool,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type DocumentSignatureField = {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

export type TemplateField = {
  id?: string;
  field_key?: string;
  field_name?: string;
  field_type?: string;
  page_number?: number;
  x_position?: number;
  y_position?: number;
  width?: number;
  height?: number;
  is_required?: boolean;
};

export type SignatureFieldPlacerProps = {
  mode: "template" | "document";
  pdfDoc: PDFDocumentProxy | null;
  pdfUrl: string | null;
  loading: boolean;
  // Template mode props
  templateFields?: TemplateField[];
  fieldSignerAssignments?: Record<string, string>;
  signers?: Array<{ email: string; name: string }>;
  // Document mode props
  documentFields?: DocumentSignatureField[];
  onDocumentFieldsChange?: (fields: DocumentSignatureField[]) => void;
  isPlacingField?: boolean;
  onPlacingFieldChange?: (placing: boolean) => void;
  selectedFieldId?: string | null;
  onSelectedFieldChange?: (fieldId: string | null) => void;
};

export function SignatureFieldPlacer({
  mode,
  pdfDoc,
  pdfUrl,
  loading,
  templateFields = [],
  fieldSignerAssignments = {},
  signers = [],
  documentFields = [],
  onDocumentFieldsChange,
  isPlacingField = false,
  onPlacingFieldChange,
  selectedFieldId,
  onSelectedFieldChange,
}: SignatureFieldPlacerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [fieldBounds, setFieldBounds] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const isRenderingRef = useRef(false);

  // Update num pages when PDF loads
  useEffect(() => {
    if (pdfDoc) {
      setNumPages(pdfDoc.numPages);
      setCurrentPage(1);
    }
  }, [pdfDoc]);

  // Render PDF page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    if (isRenderingRef.current) return;
    if (currentPage < 1 || currentPage > pdfDoc.numPages) return;

    isRenderingRef.current = true;

    // Cancel any existing render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore cancellation errors
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      
      if (!canvas) {
        isRenderingRef.current = false;
        return;
      }
      
      const context = canvas.getContext("2d");
      if (!context) {
        isRenderingRef.current = false;
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvas: canvas,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Get canvas display size
      const displayWidth = canvas.offsetWidth;
      const displayHeight = canvas.offsetHeight;
      setCanvasDisplaySize({ width: displayWidth, height: displayHeight });
      
      // Calculate scale ratio
      const scaleX = displayWidth / viewport.width;
      const scaleY = displayHeight / viewport.height;

      // Update field bounds for overlay positioning
      const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();

      if (mode === "template") {
        const pageFields = templateFields.filter((f) => f.page_number === currentPage);
        pageFields.forEach((field) => {
          const scale = viewport.scale;
          const x = (field.x_position || 0) * scale * scaleX;
          const y = (viewport.height - (field.y_position || 0) * scale) * scaleY;
          const width = (field.width || 150) * scale * scaleX;
          const height = (field.height || 50) * scale * scaleY;

          bounds.set(field.id || field.field_key || "", {
            x,
            y: y - height,
            width,
            height,
          });
        });
      } else {
        // Document mode
        const pageFields = documentFields.filter((f) => f.pageIndex === currentPage - 1);
        pageFields.forEach((field) => {
          const scale = viewport.scale;
          const x = field.x * scale * scaleX;
          const y = (viewport.height - field.y * scale) * scaleY;
          const width = field.width * scale * scaleX;
          const height = field.height * scale * scaleY;

          bounds.set(field.id, {
            x,
            y: y - height,
            width,
            height,
          });
        });
      }

      setFieldBounds(bounds);
      renderTaskRef.current = null;
      isRenderingRef.current = false;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render PDF page:", err);
      }
      renderTaskRef.current = null;
      isRenderingRef.current = false;
    }
  }, [pdfDoc, currentPage, zoom, mode, templateFields, documentFields]);

  // Render page when dependencies change
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
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
      isRenderingRef.current = false;
    };
  }, [pdfDoc, currentPage, zoom, renderPage]);

  // Handle canvas click for field placement (document mode)
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "document" || !isPlacingField || !canvasRef.current || !pdfDoc) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to PDF coordinates
    const scale = zoom;
    const scaleX = rect.width / (canvasRef.current.width || 1);
    const scaleY = rect.height / (canvasRef.current.height || 1);
    
    const pdfX = x / scaleX / scale;
    const pdfY = (canvasRef.current.height - y / scaleY) / scale;

    // Create new field
    const newField: DocumentSignatureField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pageIndex: currentPage - 1,
      x: pdfX,
      y: pdfY,
      width: 150,
      height: 50,
      label: `Signature ${(documentFields?.length || 0) + 1}`,
    };

    onDocumentFieldsChange?.([...documentFields, newField]);
    onPlacingFieldChange?.(false);
    onSelectedFieldChange?.(newField.id);
  }, [mode, isPlacingField, pdfDoc, currentPage, zoom, documentFields, onDocumentFieldsChange, onPlacingFieldChange, onSelectedFieldChange]);

  // Delete selected field (document mode)
  const handleDeleteField = useCallback((fieldId: string) => {
    if (mode !== "document") return;
    onDocumentFieldsChange?.(documentFields.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      onSelectedFieldChange?.(null);
    }
  }, [mode, documentFields, selectedFieldId, onDocumentFieldsChange, onSelectedFieldChange]);

  // Get signer info for field display
  const getSignerForField = (fieldKey: string) => {
    const signerEmail = fieldSignerAssignments[fieldKey];
    if (!signerEmail) return null;
    return signers.find(s => s.email === signerEmail);
  };

  // Current page fields
  const currentPageFields = mode === "template"
    ? templateFields.filter(f => f.page_number === currentPage)
    : documentFields.filter(f => f.pageIndex === currentPage - 1);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Loading document preview...</p>
        </div>
      </div>
    );
  }

  if (!pdfDoc || !pdfUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">
          {mode === "template" 
            ? "Select a template to preview" 
            : "No document selected"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[80px] text-center">
            Page {currentPage} of {numPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          {/* Document mode: Add field button */}
          {mode === "document" && (
            <button
              type="button"
              onClick={() => onPlacingFieldChange?.(!isPlacingField)}
              className={`ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isPlacingField 
                  ? "bg-green-600 text-white" 
                  : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
              }`}
            >
              <Plus className="w-4 h-4" />
              {isPlacingField ? "Click on document to place" : "Add Signature Field"}
            </button>
          )}
        </div>
      </div>
      
      {/* PDF Canvas */}
      <div 
        className="flex-1 overflow-auto p-4"
        onClick={handleCanvasClick}
        style={{ cursor: isPlacingField ? "crosshair" : "default" }}
      >
        <div className="relative inline-block mx-auto">
          <canvas
            ref={canvasRef}
            className="shadow-lg bg-white"
            style={{ maxWidth: "100%", height: "auto" }}
          />
          
          {/* Field Overlays */}
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none"
          >
            {Array.from(fieldBounds.entries()).map(([fieldKey, bounds]) => {
              const isSelected = selectedFieldId === fieldKey;
              const signer = mode === "template" ? getSignerForField(fieldKey) : null;
              const field = mode === "template"
                ? templateFields.find(f => (f.id || f.field_key) === fieldKey)
                : documentFields.find(f => f.id === fieldKey);
              
              return (
                <div
                  key={fieldKey}
                  className={`absolute border-2 rounded pointer-events-auto transition-all ${
                    mode === "template"
                      ? signer 
                        ? "border-green-500 bg-green-50/50" 
                        : "border-blue-500 bg-blue-50/50"
                      : isSelected
                        ? "border-green-600 bg-green-100/70"
                        : "border-green-500 bg-green-50/50"
                  }`}
                  style={{
                    left: bounds.x,
                    top: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === "document") {
                      onSelectedFieldChange?.(fieldKey);
                    }
                  }}
                >
                  {/* Field Label */}
                  <div className={`absolute -top-5 left-0 text-xs px-1.5 py-0.5 rounded-t whitespace-nowrap ${
                    mode === "template"
                      ? signer ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                      : "bg-green-600 text-white"
                  }`}>
                    {mode === "template" 
                      ? (field as TemplateField)?.field_name || "Field"
                      : (field as DocumentSignatureField)?.label || "Signature"
                    }
                    {signer && (
                      <span className="ml-1 opacity-75">({signer.name || signer.email})</span>
                    )}
                  </div>
                  
                  {/* Delete button for document mode */}
                  {mode === "document" && isSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteField(fieldKey);
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Field type icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PenTool className={`w-5 h-5 ${
                      mode === "template" 
                        ? signer ? "text-green-400" : "text-blue-400"
                        : "text-green-400"
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Field count indicator */}
      <div className="px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        {mode === "template" ? (
          <>
            {currentPageFields.length} field{currentPageFields.length !== 1 ? "s" : ""} on this page
            {" • "}
            {templateFields.length} total field{templateFields.length !== 1 ? "s" : ""}
          </>
        ) : (
          <>
            {currentPageFields.length} signature field{currentPageFields.length !== 1 ? "s" : ""} on this page
            {" • "}
            {documentFields.length} total
            {documentFields.length === 0 && (
              <span className="text-amber-600 ml-2">
                Click &quot;Add Signature Field&quot; to place fields
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SignatureFieldPlacer;

