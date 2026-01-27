"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, Plus, Trash2, Type, Hash, Calendar, CheckSquare, PenTool, Loader2, Grid, FileText } from "lucide-react";
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
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [editingGridSize, setEditingGridSize] = useState(false);
  const [gridSizeInput, setGridSizeInput] = useState(gridSize.toString());
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<{ id: string; handle: string } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [initialDragBounds, setInitialDragBounds] = useState<{ x: number; y: number } | null>(null);
  const [fieldBounds, setFieldBounds] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const viewportCacheRef = useRef<{ scale: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const loadTemplateData = useCallback(async () => {
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
  }, [template, baseId, tableId]);

  useEffect(() => {
    if (isOpen && template) {
      loadTemplateData();
    }
  }, [isOpen, template, loadTemplateData]);

  // Render PDF when page/zoom changes (not when fields change)
  // Update field bounds for overlay positioning
  const updateFieldBounds = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      // Validate page number
      if (currentPage < 1 || currentPage > pdfDoc.numPages) {
        console.error(`Invalid page number: ${currentPage}. PDF has ${pdfDoc.numPages} pages.`);
        return;
      }

      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();

      const pageFields = fields.filter((f) => f.page_number === currentPage);
      pageFields.forEach((field) => {
        const scale = viewport.scale;
        const x = field.x_position * scale;
        const y = viewport.height - field.y_position * scale; // PDF Y is from bottom
        const width = (field.width || 200) * scale;
        const height = (field.height || 20) * scale;

        bounds.set(field.id || field.field_key, {
          x,
          y: y - height,
          width,
          height,
        });
      });

      setFieldBounds(bounds);
    } catch (err) {
      console.error("Failed to update field bounds:", err);
    }
  }, [pdfDoc, currentPage, zoom, fields]);

  // Cache viewport data for drag operations
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      pdfDoc.getPage(currentPage).then((page: any) => {
        const viewport = page.getViewport({ scale: zoom });
        viewportCacheRef.current = {
          scale: viewport.scale,
          height: viewport.height,
        };
      });
    }
  }, [pdfDoc, currentPage, zoom]);

  // Define drawFieldMarkers BEFORE renderPage and useEffects that use it
  const drawFieldMarkers = useCallback((context: CanvasRenderingContext2D, viewport: any) => {
    const pageFields = fields.filter((f) => f.page_number === currentPage);
    
    // Draw grid if enabled
    if (snapToGrid) {
      context.strokeStyle = "#e5e7eb";
      context.lineWidth = 0.5;
      context.setLineDash([2, 2]);
      // Draw vertical grid lines
      for (let x = 0; x <= viewport.width; x += gridSize * viewport.scale) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, viewport.height);
        context.stroke();
      }
      // Draw horizontal grid lines
      for (let y = 0; y <= viewport.height; y += gridSize * viewport.scale) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(viewport.width, y);
        context.stroke();
      }
    }
    
    pageFields.forEach((field) => {
      const fieldKey = field.id || field.field_key;
      
      // Skip drawing the dragging/resizing field on canvas - it's shown via overlay
      if (draggingField === fieldKey || resizingField?.id === fieldKey) {
        return;
      }
      
      const scale = viewport.scale;
      const x = field.x_position * scale;
      const y = viewport.height - field.y_position * scale; // PDF Y is from bottom
      const width = (field.width || 200) * scale;
      const height = (field.height || 20) * scale;

      // Draw field rectangle
      const isSelected = selectedField?.id === field.id;
      context.strokeStyle = isSelected ? "#3b82f6" : "#10b981";
      context.lineWidth = isSelected ? 3 : 2;
      context.setLineDash([]);
      context.strokeRect(x, y - height, width, height);

      // Draw field label
      context.fillStyle = isSelected ? "#3b82f6" : "#10b981";
      context.font = "12px Arial";
      context.fillText(field.field_name, x + 2, y - height - 5);
    });
  }, [fields, currentPage, snapToGrid, gridSize, draggingField, resizingField, selectedField]);

  // Re-draw field markers when drag state changes (to hide/show dragging field on canvas)
  useEffect(() => {
    if (pdfDoc && canvasRef.current && !loading) {
      // Validate page number before fetching
      if (currentPage < 1 || currentPage > pdfDoc.numPages) {
        console.error(`Invalid page number for marker redraw: ${currentPage}`);
        return;
      }

      pdfDoc.getPage(currentPage).then((page: any) => {
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (context && canvas) {
          // Clear and re-draw canvas to prevent ghost frames
          context.clearRect(0, 0, canvas.width, canvas.height);
          // Re-draw markers (excluding dragging/resizing field to prevent ghost frame)
          drawFieldMarkers(context, viewport);
        }
      }).catch((err: any) => {
        console.error("Failed to redraw field markers:", err);
      });
    }
  }, [draggingField, resizingField, pdfDoc, currentPage, zoom, loading, drawFieldMarkers]);

  // Render PDF when page/zoom changes (not when fields change)
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

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
      // Validate page number is within bounds
      if (currentPage < 1 || currentPage > pdfDoc.numPages) {
        console.error(`Invalid page number: ${currentPage}. PDF has ${pdfDoc.numPages} pages.`);
        return;
      }

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

      // Create render task and store reference
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      // Draw field markers after render completes
      drawFieldMarkers(context, viewport);
      
      // Clear render task reference after completion
      renderTaskRef.current = null;
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render PDF page", err);
      }
      renderTaskRef.current = null;
    }
  }, [pdfDoc, currentPage, zoom, drawFieldMarkers]);

  // Render PDF when page/zoom changes (not when fields change)
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }
    
    // Cleanup: cancel any pending render task when component unmounts or dependencies change
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, zoom, renderPage]); // Use renderPage instead of drawFieldMarkers

  // Update field bounds separately when fields change (for overlay positioning)
  // Don't update during drag to prevent snap-back
  useEffect(() => {
    if (pdfDoc && canvasRef.current && !draggingField && !resizingField) {
      updateFieldBounds();
    }
  }, [fields, pdfDoc, currentPage, zoom, updateFieldBounds, draggingField, resizingField]);

  const snapToGridValue = useCallback((value: number) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  const canvasToPdfCoords = useCallback(async (canvasX: number, canvasY: number) => {
    if (!pdfDoc) return { x: 0, y: 0 };
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const pdfX = canvasX;
    const pdfY = viewport.height - canvasY; // PDF Y is from bottom
    return { x: pdfX, y: pdfY };
  }, [pdfDoc, currentPage]);

  const pdfToCanvasCoords = useCallback(async (pdfX: number, pdfY: number) => {
    if (!pdfDoc) return { x: 0, y: 0 };
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: zoom });
    const canvasX = pdfX * viewport.scale;
    const canvasY = viewport.height - pdfY * viewport.scale;
    return { x: canvasX, y: canvasY };
  }, [pdfDoc, currentPage, zoom]);

  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPlacingField || !canvasRef.current || !pdfDoc) return;
      if (draggingField || resizingField) return; // Don't place if dragging/resizing

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      let x = (e.clientX - rect.left);
      let y = (e.clientY - rect.top);

      // Snap to grid
      if (snapToGrid) {
        x = snapToGridValue(x);
        y = snapToGridValue(y);
      }

      // Convert canvas coordinates to PDF coordinates
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const pdfX = x / viewport.scale;
      const pdfY = (viewport.height - y) / viewport.scale; // PDF Y is from bottom

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
        validation_rules: [],
        formatting_options: {},
      };

      setEditingField(newField);
      setIsPlacingField(false);
      renderPage();
    },
    [isPlacingField, zoom, currentPage, pdfDoc, fields.length, snapToGrid, snapToGridValue, draggingField, resizingField, renderPage]
  );

  const handleSaveField = async () => {
    if (!editingField || !template) return;

    try {
      setSaving(true);
      setError(null);
      
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

      // Check if response is ok and has content
      if (!response.ok) {
        let errorMessage = "Failed to save field";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // Try to get text response
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch (parseError) {
          // If we can't parse the error, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Parse successful response
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }

      const data = await response.json();

      if (!data || !data.field) {
        console.error("Invalid response data:", data);
        throw new Error("Invalid response data from server");
      }

      console.log("Field saved successfully:", data.field);

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

  // Drag handlers - optimized for smooth performance
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, field: TemplateField) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection during drag
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    const fieldKey = field.id || field.field_key;
    const bounds = fieldBounds.get(fieldKey);
    
    if (!bounds) {
      console.warn(`No bounds found for field: ${fieldKey}`);
      return;
    }
    
    setDraggingField(fieldKey);
    setDragStart({ x: startX, y: startY });
    setDragOffset({ x: 0, y: 0 }); // Reset offset
    setInitialDragBounds({ x: bounds.x, y: bounds.y }); // Store initial position
    setSelectedField(field);
    setEditingField(field);
  }, [fieldBounds]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!canvasRef.current || !pdfDoc) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (draggingField && dragStart && initialDragBounds) {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use requestAnimationFrame for smooth 60fps updates
      rafRef.current = requestAnimationFrame(() => {
        let deltaX = currentX - dragStart.x;
        let deltaY = currentY - dragStart.y;

        // Snap to grid using initial bounds position
        if (snapToGrid) {
          const newX = snapToGridValue(initialDragBounds.x + deltaX);
          const newY = snapToGridValue(initialDragBounds.y + deltaY);
          deltaX = newX - initialDragBounds.x;
          deltaY = newY - initialDragBounds.y;
        }

        // Store offset for visual update (overlay position) - update immediately
        setDragOffset({ x: deltaX, y: deltaY });
      });
    } else if (resizingField && dragStart) {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use cached viewport to avoid async calls during resize
      const viewport = viewportCacheRef.current;
      if (!viewport) return;

      const field = fields.find(f => (f.id || f.field_key) === resizingField.id);
      if (!field) return;

      const bounds = fieldBounds.get(resizingField.id);
      if (!bounds) return;

      const deltaX = currentX - dragStart.x;
      const deltaY = currentY - dragStart.y;
      const pdfDeltaX = deltaX / viewport.scale;
      const pdfDeltaY = -deltaY / viewport.scale;

      let newWidth = field.width || 200;
      let newHeight = field.height || 20;
      let newX = field.x_position;
      let newY = field.y_position;

      // Handle resize based on handle position
      const handle = resizingField.handle;
      if (handle.includes("e")) { // East (right)
        newWidth = Math.max(20, (field.width || 200) + pdfDeltaX);
      }
      if (handle.includes("w")) { // West (left)
        const widthDelta = pdfDeltaX;
        newWidth = Math.max(20, (field.width || 200) - widthDelta);
        if (newWidth >= 20) { // Only move if width is valid
          newX = field.x_position + widthDelta;
        }
      }
      if (handle.includes("s")) { // South (bottom)
        newHeight = Math.max(10, (field.height || 20) - pdfDeltaY);
        if (newHeight >= 10) { // Only move if height is valid
          newY = field.y_position - (newHeight - (field.height || 20));
        }
      }
      if (handle.includes("n")) { // North (top)
        const heightDelta = pdfDeltaY;
        newHeight = Math.max(10, (field.height || 20) + heightDelta);
      }

      // Note: Snap to grid was removed from resizing to avoid stuttering UX

      const updatedField: TemplateField = {
        ...field,
        x_position: newX,
        y_position: newY,
        width: newWidth,
        height: newHeight,
      };

      // Update fields and bounds in requestAnimationFrame for smooth updates
      rafRef.current = requestAnimationFrame(() => {
        setFields(fields.map(f => (f.id || f.field_key) === resizingField.id ? updatedField : f));
        setEditingField(updatedField);
        setDragStart({ x: currentX, y: currentY });
        
        // Update bounds immediately for visual feedback
        const newBounds = new Map(fieldBounds);
        const scale = viewport.scale;
        const x = updatedField.x_position * scale;
        const y = viewport.height - updatedField.y_position * scale;
        const width = (updatedField.width || 200) * scale;
        const height = (updatedField.height || 20) * scale;
        newBounds.set(resizingField.id, {
          x,
          y: y - height,
          width,
          height,
        });
        setFieldBounds(newBounds);
      });
    }
  }, [draggingField, resizingField, dragStart, fields, pdfDoc, snapToGrid, snapToGridValue, fieldBounds, initialDragBounds]);

  const handleMouseUp = useCallback(async () => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (draggingField && dragStart && dragOffset && pdfDoc) {
      // Apply the final position update
      const field = fields.find(f => (f.id || f.field_key) === draggingField);
      if (field) {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoom });
        
        // Convert canvas delta to PDF coordinates
        const pdfDeltaX = dragOffset.x / viewport.scale;
        const pdfDeltaY = -dragOffset.y / viewport.scale; // Invert Y for PDF coordinates

        const updatedField: TemplateField = {
          ...field,
          x_position: field.x_position + pdfDeltaX,
          y_position: field.y_position + pdfDeltaY,
        };

        // Update fields immediately
        setFields(fields.map(f => (f.id || f.field_key) === draggingField ? updatedField : f));
        setEditingField(updatedField);

        // Reset drag state BEFORE updating bounds to prevent twitch
        setDraggingField(null);
        setDragStart(null);
        setDragOffset(null);
        setInitialDragBounds(null);

        // Update bounds with new position (this will remove the transform)
        await updateFieldBounds();

        // Auto-save field changes (non-blocking)
        if (template) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (session?.access_token) {
              headers.Authorization = `Bearer ${session.access_token}`;
            }
            
            await fetch(`/api/templates/${template.id}/fields`, {
              method: "POST",
              headers,
              body: JSON.stringify({ field: updatedField }),
            });
          } catch (err) {
            console.error("Failed to auto-save field", err);
          }
        }

        // Re-render PDF to show updated markers
        await renderPage();
      } else {
        // Field not found, just reset drag state
        setDraggingField(null);
        setDragStart(null);
        setDragOffset(null);
        setInitialDragBounds(null);
      }
    } else if (resizingField && dragStart) {
      // Handle resize completion
      const fieldToSave = fields.find(f => (f.id || f.field_key) === resizingField.id);
      
      // Reset resize state immediately
      setResizingField(null);
      setDragStart(null);

      // Update bounds
      await updateFieldBounds();
      
      if (fieldToSave && template) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
          
          await fetch(`/api/templates/${template.id}/fields`, {
            method: "POST",
            headers,
            body: JSON.stringify({ field: fieldToSave }),
          });
        } catch (err) {
          console.error("Failed to auto-save field", err);
        }
      }
      await renderPage();
    } else {
      // No active drag/resize, just reset state
      setDraggingField(null);
      setResizingField(null);
      setDragStart(null);
      setDragOffset(null);
      setInitialDragBounds(null);
    }
  }, [draggingField, resizingField, dragStart, dragOffset, fields, template, pdfDoc, currentPage, zoom, updateFieldBounds, renderPage]);

  useEffect(() => {
    if (draggingField || resizingField) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        // Cleanup animation frame
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }
  }, [draggingField, resizingField, handleMouseMove, handleMouseUp]);

  const handleResizeStart = useCallback((e: React.MouseEvent, field: TemplateField, handle: string) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection during resize
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    const fieldKey = field.id || field.field_key;
    
    setResizingField({ id: fieldKey, handle });
    setDragStart({ x: startX, y: startY });
    setSelectedField(field);
    setEditingField(field);
  }, []);

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
                  <div className="w-px h-6 bg-gray-300 mx-2" />
                  <button
                    onClick={() => setSnapToGrid(!snapToGrid)}
                    className={`p-2 rounded transition-colors ${
                      snapToGrid ? "bg-blue-100 text-blue-600" : "text-gray-600"
                    }`}
                    title="Toggle snap to grid"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                </div>

                {/* Canvas Container with proper positioning */}
                <div className="relative inline-block" style={{ lineHeight: 0 }}>
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className={`border border-gray-300 shadow-lg ${isPlacingField ? "cursor-crosshair" : "cursor-default"}`}
                    style={{ maxWidth: "100%", display: "block" }}
                  />
                  {/* Field Overlays - Positioned absolutely over canvas */}
                  {canvasRef.current && fieldBounds.size > 0 && (
                    <div
                      ref={overlayRef}
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{
                        width: `${canvasRef.current.width}px`,
                        height: `${canvasRef.current.height}px`,
                      }}
                    >
                      {fields
                        .filter((f) => f.page_number === currentPage)
                        .map((field) => {
                          const bounds = fieldBounds.get(field.id || field.field_key);
                          if (!bounds) return null;

                          const isSelected = selectedField?.id === field.id;
                          const isDragging = draggingField === (field.id || field.field_key);
                          const isResizing = resizingField?.id === (field.id || field.field_key);
                          
                          // Apply drag offset for smooth visual updates
                          const dragX = isDragging && dragOffset ? dragOffset.x : 0;
                          const dragY = isDragging && dragOffset ? dragOffset.y : 0;

                          return (
                            <div
                              key={field.id || field.field_key}
                              className={`absolute pointer-events-auto transition-colors ${
                                isSelected
                                  ? "border-2 border-blue-500 bg-blue-500/10 shadow-lg"
                                  : isDragging || isResizing
                                  ? "border-2 border-green-500 bg-green-500/10 shadow-lg"
                                  : "border-2 border-green-500/50 bg-green-500/5 hover:border-green-500 hover:bg-green-500/10 hover:shadow-md"
                              } ${isDragging ? "cursor-grabbing" : "cursor-move"} rounded-sm`}
                              style={{
                                left: `${bounds.x}px`,
                                top: `${bounds.y}px`,
                                width: `${bounds.width}px`,
                                height: `${bounds.height}px`,
                                transform: `translate(${dragX}px, ${dragY}px)`,
                                willChange: isDragging || isResizing ? "transform" : "auto",
                                transition: isDragging || isResizing ? "none" : "border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
                                zIndex: isSelected || isDragging || isResizing ? 10 : 1,
                              }}
                              onMouseDown={(e) => handleFieldMouseDown(e, field)}
                              title={`${field.field_name} (${field.field_type})`}
                            >
                              {/* Field Label with better visibility */}
                              <div className={`absolute -top-6 left-0 text-xs font-semibold px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${
                                isSelected
                                  ? "bg-blue-500 text-white"
                                  : "bg-white text-gray-700 border border-gray-300"
                              }`}>
                                {field.field_name}
                              </div>

                              {/* Resize Handles - Only show when selected, improved styling */}
                              {isSelected && !isDragging && (
                                <>
                                  {/* Corner handles - larger and more visible */}
                                  <div
                                    className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "nw")}
                                  />
                                  <div
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "ne")}
                                  />
                                  <div
                                    className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "sw")}
                                  />
                                  <div
                                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "se")}
                                  />
                                  {/* Edge handles */}
                                  <div
                                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "n")}
                                  />
                                  <div
                                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "s")}
                                  />
                                  <div
                                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "w")}
                                  />
                                  <div
                                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize z-20 shadow-md hover:scale-110 transition-transform"
                                    onMouseDown={(e) => handleResizeStart(e, field, "e")}
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fields Panel - Improved UI */}
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/30">
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center justify-between">
                <span>Fields on Page {currentPage}</span>
                <span className="text-sm font-normal text-gray-500">({fields.filter(f => f.page_number === currentPage).length})</span>
              </h3>
              {isPlacingField && (
                <p className="text-xs text-green-600 mb-0 flex items-center gap-1 mt-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Click on the PDF to place a new field
                </p>
              )}
              {snapToGrid && (
                <div className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <Grid className="w-3 h-3" />
                  <span>Snap to grid:</span>
                  {editingGridSize ? (
                    <input
                      type="number"
                      value={gridSizeInput}
                      onChange={(e) => setGridSizeInput(e.target.value)}
                      onBlur={() => {
                        const value = parseInt(gridSizeInput) || 10;
                        setGridSize(Math.max(1, value));
                        setEditingGridSize(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = parseInt(gridSizeInput) || 10;
                          setGridSize(Math.max(1, value));
                          setEditingGridSize(false);
                        }
                      }}
                      className="w-12 px-1 py-0 text-xs border border-blue-300 rounded bg-blue-50"
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingGridSize(true);
                        setGridSizeInput(gridSize.toString());
                      }}
                      className="cursor-pointer hover:bg-blue-100 px-1 rounded"
                    >
                      {gridSize}px
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {fields.filter((f) => f.page_number === currentPage).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No fields on this page</p>
                  <p className="text-xs text-gray-400 mt-1">Click &quot;Add Field&quot; to start</p>
                </div>
              ) : (
                fields
                  .filter((f) => f.page_number === currentPage)
                  .map((field) => (
                    <div
                      key={field.id}
                      onClick={() => {
                        setSelectedField(field);
                        setEditingField(field);
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedField?.id === field.id
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm"
                      }`}
                    >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate flex items-center gap-1">
                          {field.field_type === "text" && <Type className="w-3.5 h-3.5 text-blue-500" />}
                          {field.field_type === "number" && <Hash className="w-3.5 h-3.5 text-green-500" />}
                          {field.field_type === "date" && <Calendar className="w-3.5 h-3.5 text-purple-500" />}
                          {field.field_type === "checkbox" && <CheckSquare className="w-3.5 h-3.5 text-orange-500" />}
                          {field.field_type === "signature" && <PenTool className="w-3.5 h-3.5 text-red-500" />}
                          {field.field_name}
                        </div>
                        <div className="text-xs text-gray-500 font-mono truncate">{field.field_key}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (field.id) handleDeleteField(field.id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Pos:</span> ({Math.round(field.x_position)}, {Math.round(field.y_position)})
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Size:</span> {Math.round(field.width || 200)}×{Math.round(field.height || 20)}
                      </span>
                    </div>
                    {field.is_required && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                          <span>Required</span>
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Field Editor */}
            {editingField && (
              <div className="border-t border-gray-200 bg-gray-50 h-1/2 flex flex-col overflow-hidden">
                <div className="border-b border-gray-200 p-4 flex items-center justify-between flex-shrink-0 bg-white">
                  <h4 className="font-semibold text-gray-900">Edit Field</h4>
                  <button
                    onClick={() => {
                      setSelectedField(null);
                      setEditingField(null);
                    }}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title="Close edit field"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
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
                          value={Math.round(editingField.width || 200)}
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
                          value={Math.round(editingField.height || 20)}
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

                    {/* Signature Field Info */}
                    {editingField.field_type === "signature" && (
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="p-3 bg-blue-50/50 rounded border border-blue-200">
                          <p className="text-xs text-gray-600">
                            <strong>Signature Field:</strong> This field marks where a signature will be placed. When requesting an e-signature, you will add signers and they will sign at this location.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Validation Rules */}
                    {(editingField.field_type === "text" || editingField.field_type === "number") && (
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Validation Rules
                        </label>
                        <div className="space-y-2">
                          {editingField.field_type === "text" && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  placeholder="Min length"
                                  value={(editingField.validation_rules?.find(r => r.type === "minLength")?.value as number) || ""}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    const rules = editingField.validation_rules || [];
                                    const filtered = rules.filter(r => r.type !== "minLength");
                                    setEditingField({
                                      ...editingField,
                                      validation_rules: val ? [...filtered, { type: "minLength", value: val }] : filtered,
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                                <input
                                  type="number"
                                  placeholder="Max length"
                                  value={(editingField.validation_rules?.find(r => r.type === "maxLength")?.value as number) || ""}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    const rules = editingField.validation_rules || [];
                                    const filtered = rules.filter(r => r.type !== "maxLength");
                                    setEditingField({
                                      ...editingField,
                                      validation_rules: val ? [...filtered, { type: "maxLength", value: val }] : filtered,
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </div>
                              <input
                                type="text"
                                placeholder="Regex pattern (e.g., ^[A-Z]+$)"
                                value={(editingField.validation_rules?.find(r => r.type === "pattern")?.value as string) || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const rules = editingField.validation_rules || [];
                                  const filtered = rules.filter(r => r.type !== "pattern");
                                  setEditingField({
                                    ...editingField,
                                    validation_rules: val ? [...filtered, { type: "pattern", value: val }] : filtered,
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </>
                          )}
                          {editingField.field_type === "number" && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                placeholder="Min value"
                                value={(editingField.validation_rules?.find(r => r.type === "min")?.value as number) || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                  const rules = editingField.validation_rules || [];
                                  const filtered = rules.filter(r => r.type !== "min");
                                  setEditingField({
                                    ...editingField,
                                    validation_rules: val !== undefined ? [...filtered, { type: "min", value: val }] : filtered,
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                              <input
                                type="number"
                                placeholder="Max value"
                                value={(editingField.validation_rules?.find(r => r.type === "max")?.value as number) || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                  const rules = editingField.validation_rules || [];
                                  const filtered = rules.filter(r => r.type !== "max");
                                  setEditingField({
                                    ...editingField,
                                    validation_rules: val !== undefined ? [...filtered, { type: "max", value: val }] : filtered,
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Formatting Options */}
                    {(editingField.field_type === "text" || editingField.field_type === "number" || editingField.field_type === "date") && (
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Formatting Options
                        </label>
                        <div className="space-y-2">
                          {editingField.field_type === "text" && (
                            <select
                              value={editingField.formatting_options?.textCase || ""}
                              onChange={(e) =>
                                setEditingField({
                                  ...editingField,
                                  formatting_options: {
                                    ...editingField.formatting_options,
                                    textCase: (e.target.value as "title" | "uppercase" | "lowercase" | undefined) || undefined,
                                  },
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                            >
                              <option value="">No case formatting</option>
                              <option value="uppercase">Uppercase</option>
                              <option value="lowercase">Lowercase</option>
                              <option value="title">Title Case</option>
                            </select>
                          )}
                          {editingField.field_type === "number" && (
                            <>
                              <select
                                value={editingField.formatting_options?.numberFormat || ""}
                                onChange={(e) =>
                                  setEditingField({
                                    ...editingField,
                                    formatting_options: {
                                      ...editingField.formatting_options,
                                      numberFormat: (e.target.value as "integer" | "currency" | "percentage" | "decimal" | undefined) || undefined,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              >
                                <option value="">No formatting</option>
                                <option value="currency">Currency</option>
                                <option value="percentage">Percentage</option>
                                <option value="decimal">Decimal</option>
                                <option value="integer">Integer</option>
                              </select>
                              {editingField.formatting_options?.numberFormat === "currency" && (
                                <input
                                  type="text"
                                  placeholder="Currency symbol ($)"
                                  value={editingField.formatting_options?.currencySymbol || "$"}
                                  onChange={(e) =>
                                    setEditingField({
                                      ...editingField,
                                      formatting_options: {
                                        ...editingField.formatting_options,
                                        currencySymbol: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              )}
                              {(editingField.formatting_options?.numberFormat === "currency" ||
                                editingField.formatting_options?.numberFormat === "percentage" ||
                                editingField.formatting_options?.numberFormat === "decimal") && (
                                <input
                                  type="number"
                                  placeholder="Decimal places"
                                  value={editingField.formatting_options?.decimalPlaces || 2}
                                  onChange={(e) =>
                                    setEditingField({
                                      ...editingField,
                                      formatting_options: {
                                        ...editingField.formatting_options,
                                        decimalPlaces: parseInt(e.target.value) || 2,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              )}
                            </>
                          )}
                          {editingField.field_type === "text" && (
                            <input
                              type="text"
                              placeholder="Input mask (e.g., (###) ###-####)"
                              value={editingField.formatting_options?.inputMask || ""}
                              onChange={(e) =>
                                setEditingField({
                                  ...editingField,
                                  formatting_options: {
                                    ...editingField.formatting_options,
                                    inputMask: e.target.value || undefined,
                                  },
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
                  <button
                    onClick={handleSaveField}
                    disabled={
                      saving || 
                      !editingField.field_name || 
                      !editingField.field_key
                    }
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

