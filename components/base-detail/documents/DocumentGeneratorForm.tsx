"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, FileDown, Loader2, Type, Hash, Calendar, CheckSquare, PenTool, Save, Eye, ZoomIn, ZoomOut, FileImage, MousePointer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DocumentTemplate, TemplateField } from "@/lib/services/template-service";
import { DocumentsService } from "@/lib/services/documents-service";
import { SignatureCapture } from "./SignatureCapture";
import { validateField } from "@/lib/utils/field-validators";
import { applyInputMask } from "@/lib/utils/field-formatters";
import { FolderSelector } from "./FolderSelector";
import { toast } from "sonner";

import type { FieldRow } from "@/lib/types/base-detail";

type DocumentGeneratorFormProps = {
  isOpen: boolean;
  onClose: () => void;
  template: DocumentTemplate | null;
  baseId: string;
  tableId?: string | null;
  onDocumentGenerated?: () => void;
  recordId?: string;
  recordValues?: Record<string, unknown>;
  recordFields?: FieldRow[];
};

export const DocumentGeneratorForm = ({
  isOpen,
  onClose,
  template,
  baseId,
  tableId,
  onDocumentGenerated,
  recordId,
  recordValues,
  recordFields,
}: DocumentGeneratorFormProps) => {
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [signatureModal, setSignatureModal] = useState<{ fieldKey: string } | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("");
  const [showPreview, setShowPreview] = useState(true);
  
  // Canvas-based preview state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [templatePdfUrl, setTemplatePdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(2); // User-controlled zoom (multiplier) - default 200%
  const [editingMode, setEditingMode] = useState(false); // Toggle for edit mode
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<{ id: string; handle: string } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialDragBounds, setInitialDragBounds] = useState<{ x: number; y: number } | null>(null);
  const [initialDragPosition, setInitialDragPosition] = useState<{ x: number; y: number } | null>(null); // PDF coordinates
  // Temporary field position overrides (only for this generation, doesn't affect saved template)
  const [fieldOverrides, setFieldOverrides] = useState<Map<string, { x_position: number; y_position: number; width: number; height: number }>>(new Map());
  const [fieldBounds, setFieldBounds] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const [isDragging, setIsDragging] = useState(false); // Track if currently dragging to prevent re-renders
  const [editTool, setEditTool] = useState<"select" | "text" | "image">("select"); // Current edit tool
  const [addedElements, setAddedElements] = useState<Array<{
    id: string;
    type: "text" | "image";
    x: number; // PDF coordinates
    y: number; // PDF coordinates (from bottom)
    page: number;
    content?: string;
    imageData?: string;
    width?: number;
    height?: number;
    fontSize?: number;
  }>>([]);
  const [textInputModal, setTextInputModal] = useState<{ x: number; y: number; page: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewCanvasWrapperRef = useRef<HTMLDivElement>(null);
  const previewRenderTaskRef = useRef<any>(null);
  const previewRafRef = useRef<number | null>(null);
  const previewViewportCacheRef = useRef<{ scale: number; height: number } | null>(null);

  // Load template PDF for canvas preview
  useEffect(() => {
    if (isOpen && template && showPreview) {
      const loadTemplatePdf = async () => {
        try {
          // Get signed URL for template
          const { data: { session } } = await supabase.auth.getSession();
          const headers: HeadersInit = {};
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }

          const response = await fetch(`/api/templates/${template.id}/signed-url?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`, { headers });
          if (response.ok) {
            const data = await response.json();
            // API returns { url: signedUrl }
            const signedUrl = data.url || data.signedUrl;
            
            if (!signedUrl || typeof signedUrl !== "string") {
              console.error("No valid signed URL returned from API:", data);
              return;
            }
            
            setTemplatePdfUrl(signedUrl);
            
            // Load PDF with PDF.js
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
            
            const loadingTask = pdfjs.getDocument({ url: signedUrl });
            const pdf = await loadingTask.promise;
            setPdfDoc(pdf);
            setNumPages(pdf.numPages);
            setCurrentPreviewPage(1);
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error("Failed to get template signed URL:", errorData.error || response.statusText);
          }
        } catch (err) {
          console.error("Failed to load template PDF:", err);
        }
      };
      
      loadTemplatePdf();
    }
    
    return () => {
      if (templatePdfUrl) {
        URL.revokeObjectURL(templatePdfUrl);
      }
    };
  }, [isOpen, template, showPreview, baseId, tableId, templatePdfUrl]);

  useEffect(() => {
    if (isOpen && template) {
      // Initialize field values with defaults or auto-fill from record
      const initialValues: Record<string, any> = {};
      if (template.fields) {
        template.fields.forEach((field) => {
          // Try to auto-fill from record values first
          let autoFilledValue: any = null;
          
          if (recordValues && recordFields) {
            // Try exact field_key match first
            if (recordValues[field.field_key]) {
              autoFilledValue = recordValues[field.field_key];
            } else {
              // Try to match by field name (case-insensitive)
              const matchingRecordField = recordFields.find(
                (rf) => rf.name.toLowerCase() === field.field_name.toLowerCase() ||
                        rf.name.toLowerCase() === field.field_key.toLowerCase()
              );
              
              if (matchingRecordField && recordValues[matchingRecordField.id]) {
                autoFilledValue = recordValues[matchingRecordField.id];
                
                // Format dates for display
                if (matchingRecordField.type === 'date' || matchingRecordField.type === 'datetime') {
                  const date = new Date(autoFilledValue as string);
                  if (!isNaN(date.getTime())) {
                    autoFilledValue = matchingRecordField.type === 'date' 
                      ? date.toISOString().split('T')[0]
                      : date.toISOString().slice(0, 16);
                  }
                }
              }
            }
          }
          
          // Priority: auto-filled value > default value > empty string
          if (autoFilledValue !== null && autoFilledValue !== undefined) {
            initialValues[field.field_key] = autoFilledValue;
          } else if (field.default_value) {
            initialValues[field.field_key] = field.default_value;
          } else {
            initialValues[field.field_key] = "";
          }
        });
      }
      setFieldValues(initialValues);
      
      // Set output filename with record name if available
      let fileName = template.name.replace(/\s+/g, "_");
      if (recordValues && recordFields) {
        // Try to find "Name" field
        const nameField = recordFields.find((f) => f.name.toLowerCase() === "name");
        if (nameField && recordValues[nameField.id]) {
          const recordName = String(recordValues[nameField.id]).replace(/[^a-zA-Z0-9_-]/g, "_");
          fileName = `${fileName}_${recordName}`;
        }
      }
      setOutputFileName(`${fileName}_filled.pdf`);
      setError(null);
    }
  }, [isOpen, template, recordValues, recordFields]);

  // Get effective field position (from override or original)
  const getEffectiveFieldPosition = useCallback((field: any) => {
    const fieldKey = field.id || field.field_key;
    const override = fieldOverrides.get(fieldKey);
    
    if (override) {
      return {
        x_position: override.x_position,
        y_position: override.y_position,
        width: override.width,
        height: override.height,
      };
    }
    
    return {
      x_position: field.x_position || 0,
      y_position: field.y_position || 0,
      width: field.width || 200,
      height: field.height || 20,
    };
  }, [fieldOverrides]);

  // Calculate base scale to fit container
  const calculatePreviewScale = useCallback((pageWidth: number, pageHeight: number) => {
    if (!previewContainerRef.current) return 1;
    
    const container = previewContainerRef.current;
    const containerWidth = container.clientWidth - 32; // Account for padding
    const containerHeight = container.clientHeight - 32;
    
    // Calculate scale to fit width, with some margin
    const scaleX = (containerWidth * 0.9) / pageWidth;
    const scaleY = (containerHeight * 0.9) / pageHeight;
    
    // Use the smaller scale to ensure it fits both dimensions
    const baseScale = Math.min(scaleX, scaleY, 2); // Max base scale of 2 for quality
    
    return Math.max(0.5, baseScale); // Min scale of 0.5
  }, []);

  // Render PDF page to canvas with field values overlaid
  const renderPreviewPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !previewCanvasRef.current || !template) return;

    // Cancel any existing render task
    if (previewRenderTaskRef.current) {
      try {
        previewRenderTaskRef.current.cancel();
      } catch {
        // Ignore cancellation errors
      }
      previewRenderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      
      // Get page dimensions at scale 1 to calculate fit
      const baseViewport = page.getViewport({ scale: 1 });
      const baseScale = calculatePreviewScale(baseViewport.width, baseViewport.height);
      setPreviewScale(baseScale);
      
      // Apply user zoom multiplier
      const finalScale = baseScale * previewZoom;
      const viewport = page.getViewport({ scale: finalScale });
      const canvas = previewCanvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Cache viewport for drag operations
      previewViewportCacheRef.current = {
        scale: viewport.scale,
        height: viewport.height,
      };
      
      // Update field bounds for overlay positioning (when in edit mode)
      if (editingMode && template.fields) {
        const pageFields = template.fields.filter(f => (f.page_number || 1) === pageNum);
        const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();
        
        pageFields.forEach((field) => {
          const effectivePos = getEffectiveFieldPosition(field);
          const scale = viewport.scale;
          const x = effectivePos.x_position * scale;
          const y = viewport.height - effectivePos.y_position * scale;
          const width = effectivePos.width * scale;
          const height = effectivePos.height * scale;
          
          bounds.set(field.id || field.field_key, {
            x,
            y: y - height,
            width,
            height,
          });
        });
        
        setFieldBounds(bounds);
      }

      // Render PDF page
      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport,
      });
      previewRenderTaskRef.current = renderTask;
      
      await renderTask.promise;

      // Draw field values on top
      if (template.fields) {
        const pageFields = template.fields.filter(f => (f.page_number || 1) === pageNum);
        const { formatFieldValue } = await import("@/lib/utils/field-formatters");
        
        pageFields.forEach((field) => {
          const value = fieldValues[field.field_key];
          if (value === undefined || value === null || value === "") return;

          let displayValue = String(value);
          
          // Apply formatting
          if (field.formatting_options) {
            displayValue = formatFieldValue(value, field.formatting_options);
          }

          // Get effective position (from override or original)
          const effectivePos = getEffectiveFieldPosition(field);
          
          const scale = viewport.scale;
          const x = effectivePos.x_position * scale;
          const y = viewport.height - effectivePos.y_position * scale; // PDF Y is from bottom
          const width = effectivePos.width * scale;
          const height = effectivePos.height * scale;
          const fontSize = (field.font_size || 12) * scale;

          context.fillStyle = "#000000";
          context.font = `${fontSize}px Helvetica`;
          context.textBaseline = "bottom";

          switch (field.field_type) {
            case "text":
            case "number":
            case "date":
              // Draw text
              const textX = x + 2 * scale;
              const textY = y - height + fontSize; // Position text at bottom of field
              context.fillText(displayValue, textX, textY);
              break;
              
            case "checkbox":
              if (displayValue.toLowerCase() === "true" || displayValue === "1" || displayValue.toLowerCase() === "yes") {
                // Draw checkmark
                const checkX = x + width / 2;
                const checkY = y - height / 2;
                context.font = `${fontSize * 1.5}px Helvetica`;
                context.fillText("✓", checkX - fontSize * 0.3, checkY + fontSize * 0.5);
              }
              break;
              
            case "signature":
              if (typeof value === "string" && value.startsWith("data:image")) {
                // Draw signature image - use native Image constructor
                const img = new window.Image();
                img.onload = () => {
                  context.drawImage(img, x, y - height, width, height);
                };
                img.src = value;
              }
              break;
          }
        });
      }
      
      // Draw added elements (text/images)
      if (addedElements.length > 0) {
        const pageElements = addedElements.filter(el => el.page === pageNum);
        pageElements.forEach((element) => {
          const scale = viewport.scale;
          
          if (element.type === "text" && element.content) {
            const x = element.x * scale;
            const y = viewport.height - element.y * scale; // PDF Y is from bottom
            const fontSize = (element.fontSize || 12) * scale;
            
            context.fillStyle = "#000000";
            context.font = `${fontSize}px Helvetica`;
            context.textBaseline = "bottom";
            context.fillText(element.content, x, y);
          } else if (element.type === "image" && element.imageData) {
            const x = element.x * scale;
            const y = viewport.height - element.y * scale;
            const width = (element.width || 200) * scale;
            const height = (element.height || 200) * scale;
            
            const img = new window.Image();
            img.onload = () => {
              context.drawImage(img, x, y - height, width, height);
            };
            img.src = element.imageData;
          }
        });
      }
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render preview page", err);
      }
    }
  }, [pdfDoc, template, fieldValues, previewZoom, calculatePreviewScale, getEffectiveFieldPosition, addedElements, editingMode]);

  // Debounced render when field values change (don't re-render during drag)
  useEffect(() => {
    if (isDragging) return; // Skip re-render during drag
    
    if (pdfDoc && previewCanvasRef.current && showPreview) {
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Debounce preview updates when typing (300ms delay)
      debounceTimeoutRef.current = setTimeout(() => {
        if (previewRafRef.current) {
          cancelAnimationFrame(previewRafRef.current);
        }
        
        previewRafRef.current = requestAnimationFrame(() => {
          renderPreviewPage(currentPreviewPage);
        });
      }, 300);
    }
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
    };
  }, [pdfDoc, currentPreviewPage, fieldValues, previewZoom, editingMode, fieldOverrides, showPreview, renderPreviewPage, isDragging]);

  // Immediate render when page or zoom changes (not debounced)
  useEffect(() => {
    if (pdfDoc && previewCanvasRef.current && showPreview && !isDragging) {
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
      
      previewRafRef.current = requestAnimationFrame(() => {
        renderPreviewPage(currentPreviewPage);
      });
    }
  }, [pdfDoc, currentPreviewPage, previewZoom, showPreview, renderPreviewPage, isDragging]);

  // Recalculate scale and re-render when container size changes
  useEffect(() => {
    if (!pdfDoc || !showPreview) return;

    const handleResize = () => {
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
      previewRafRef.current = requestAnimationFrame(() => {
        renderPreviewPage(currentPreviewPage);
      });
    };

    window.addEventListener("resize", handleResize);
    // Also trigger on initial mount after a short delay to ensure container is sized
    const timeout = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeout);
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
    };
  }, [pdfDoc, showPreview, currentPreviewPage, previewZoom, renderPreviewPage]);

  // Update field bounds when edit mode is enabled or page changes
  useEffect(() => {
    if (editingMode && pdfDoc && template?.fields && previewCanvasRef.current) {
      const updateBounds = async () => {
        try {
          const page = await pdfDoc.getPage(currentPreviewPage);
          const baseViewport = page.getViewport({ scale: 1 });
          const baseScale = calculatePreviewScale(baseViewport.width, baseViewport.height);
          const finalScale = baseScale * previewZoom;
          const viewport = page.getViewport({ scale: finalScale });
          
          // Update viewport cache
          previewViewportCacheRef.current = {
            scale: viewport.scale,
            height: viewport.height,
          };
          
          const pageFields = template.fields?.filter(f => (f.page_number || 1) === currentPreviewPage) || [];
          const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();
          
          pageFields.forEach((field) => {
            const effectivePos = getEffectiveFieldPosition(field);
            const scale = viewport.scale;
            const x = effectivePos.x_position * scale;
            const y = viewport.height - effectivePos.y_position * scale;
            const width = effectivePos.width * scale;
            const height = effectivePos.height * scale;
            
            bounds.set(field.id || field.field_key, {
              x,
              y: y - height,
              width,
              height,
            });
          });
          
          setFieldBounds(bounds);
        } catch (err) {
          console.error("Failed to update field bounds", err);
        }
      };
      
      updateBounds();
    } else if (!editingMode) {
      // Clear bounds when exiting edit mode
      setFieldBounds(new Map());
    }
  }, [editingMode, pdfDoc, currentPreviewPage, previewZoom, template, fieldOverrides, calculatePreviewScale, getEffectiveFieldPosition]);

  // Cleanup PDF document when component unmounts
  useEffect(() => {
    return () => {
      if (previewRenderTaskRef.current) {
        try {
          previewRenderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
    };
  }, []);

  // Drag handlers for field editing in preview
  useEffect(() => {
    if (!editingMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingField || !dragStart || !initialDragPosition || !initialDragBounds || !previewCanvasRef.current || !previewViewportCacheRef.current) return;

      const canvas = previewCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const deltaX = currentX - dragStart.x;
      const deltaY = currentY - dragStart.y;

      const viewport = previewViewportCacheRef.current;
      const pdfDeltaX = deltaX / viewport.scale;
      const pdfDeltaY = -deltaY / viewport.scale; // Y is inverted in PDF coordinates

      // Use initial position + delta to avoid accumulating errors
      const newX = initialDragPosition.x + pdfDeltaX;
      const newY = initialDragPosition.y + pdfDeltaY;

      // Find the field to get width/height
      const field = template?.fields?.find(f => (f.id || f.field_key) === draggingField);
      if (!field) return;

      const effectivePos = getEffectiveFieldPosition(field);

      // Update override and bounds using requestAnimationFrame for smooth updates
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
      }
      
      previewRafRef.current = requestAnimationFrame(() => {
        setFieldOverrides(prev => {
          const next = new Map(prev);
          next.set(draggingField, {
            x_position: Math.max(0, newX),
            y_position: Math.max(0, newY),
            width: effectivePos.width,
            height: effectivePos.height,
          });
          return next;
        });
        
        // Update bounds for visual feedback without re-rendering PDF
        setFieldBounds(prev => {
          const next = new Map(prev);
          if (initialDragBounds) {
            next.set(draggingField, {
              x: initialDragBounds.x + deltaX,
              y: initialDragBounds.y + deltaY,
              width: effectivePos.width * viewport.scale,
              height: effectivePos.height * viewport.scale,
            });
          }
          return next;
        });
      });
    };

    const handleMouseUp = () => {
      setDraggingField(null);
      setDragStart(null);
      setInitialDragBounds(null);
    };

    if (draggingField) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [editingMode, draggingField, dragStart, initialDragPosition, template, getEffectiveFieldPosition, currentPreviewPage, renderPreviewPage, initialDragBounds]);

  const handleFieldChange = (fieldKey: string, value: any, field?: TemplateField) => {
    setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));
    
    // Apply input mask if configured
    if (field?.formatting_options?.inputMask && typeof value === "string") {
      const masked = applyInputMask(value, field.formatting_options.inputMask);
      if (masked !== value) {
        setFieldValues((prev) => ({ ...prev, [fieldKey]: masked }));
        return;
      }
    }
    
    // Validate field
    if (field) {
      const rules = field.validation_rules || [];
      if (field.is_required) {
        rules.push({ type: "required" });
      }
      const validation = validateField(value, rules);
      if (!validation.isValid) {
        setFieldErrors((prev) => ({ ...prev, [fieldKey]: validation.error || "Invalid value" }));
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
      }
    }
  };

  const handleGenerate = async () => {
    if (!template) return;

    // Validate all fields
    const errors: Record<string, string> = {};
    const missingFields: string[] = [];
    
    if (template.fields) {
      template.fields.forEach((field) => {
        const value = fieldValues[field.field_key];
        const rules = field.validation_rules || [];
        if (field.is_required) {
          rules.push({ type: "required" });
        }
        
        const validation = validateField(value, rules);
        if (!validation.isValid) {
          errors[field.field_key] = validation.error || "Invalid value";
          if (field.is_required && !value) {
          missingFields.push(field.field_name);
          }
        }
      });
    }

    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(", ")}`);
      } else {
        setError("Please fix validation errors before generating");
      }
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Convert fieldOverrides Map to plain object for JSON serialization
      const fieldOverridesObj: Record<string, { x_position: number; y_position: number; width: number; height: number }> = {};
      fieldOverrides.forEach((value, key) => {
        fieldOverridesObj[key] = value;
      });

      const response = await fetch("/api/templates/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          templateId: template.id,
          baseId,
          fieldValues,
          fieldOverrides: Object.keys(fieldOverridesObj).length > 0 ? fieldOverridesObj : undefined,
          outputFileName: outputFileName || undefined,
          folderPath: selectedFolderPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate document");
      }

      const data = await response.json();

      // Document is already uploaded by the API
      // Check if signature request was created
      if (data.requiresSignatures && data.signatureRequestId) {
        toast.success(
          `Document "${data.fileName}" has been generated and signature requests have been sent to signers!`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Document "${data.fileName}" has been saved successfully!`);
      }

      if (onDocumentGenerated) {
        onDocumentGenerated();
      }

      // Show success message
      setError(null);

      onClose();
    } catch (err: any) {
      console.error("Failed to generate document", err);
      setError(err.message || "Failed to generate document");
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !template) return null;

  // Group fields by page
  const fieldsByPage = new Map<number, TemplateField[]>();
  if (template.fields) {
    template.fields.forEach((field) => {
      const page = field.page_number || 1;
      if (!fieldsByPage.has(page)) {
        fieldsByPage.set(page, []);
      }
      fieldsByPage.get(page)!.push(field);
    });
  }

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
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Generate Document</h2>
            <p className="text-sm text-gray-600 mt-1">{template.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                showPreview ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              <Eye className="w-4 h-4 inline mr-1" />
              Preview
            </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/70 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Preview Panel */}
          {showPreview && (
            <div className="flex-1 border-r border-gray-200 bg-gray-100 overflow-auto flex flex-col">
              <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>
                  <p className="text-xs text-gray-500 mt-1">Updates in real-time as you type</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.25))}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-xs text-gray-600 min-w-[3rem] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPreviewZoom(Math.min(3, previewZoom + 0.25))}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setPreviewZoom(1)}
                    className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Reset Zoom"
                  >
                    Reset
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-2" />
                  <button
                    onClick={() => {
                      setEditingMode(!editingMode);
                      if (editingMode) {
                        // Clear overrides when exiting edit mode
                        setFieldOverrides(new Map());
                      }
                    }}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${
                      editingMode
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title={editingMode ? "Exit Edit Mode" : "Edit Field Positions"}
                  >
                    {editingMode ? "✓ Edit Mode" : "Edit"}
                  </button>
                </div>
              </div>
              {/* Edit Mode Tools Toolbar */}
              {editingMode && (
                <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium mr-1">Tools:</span>
                  <button
                    onClick={() => setEditTool("select")}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      editTool === "select"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title="Select/Move"
                  >
                    <MousePointer className="w-3 h-3 inline mr-1" />
                    Select
                  </button>
                  <button
                    onClick={() => setEditTool("text")}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      editTool === "text"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title="Add Text"
                  >
                    <Type className="w-3 h-3 inline mr-1" />
                    Text
                  </button>
                  <button
                    onClick={() => setEditTool("image")}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      editTool === "image"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title="Add Image"
                  >
                    <FileImage className="w-3 h-3 inline mr-1" />
                    Image
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-hidden flex flex-col">
                {pdfDoc ? (
                  <>
                    {/* Page Navigation */}
                    {numPages > 1 && (
                      <div className="p-4 pb-2 flex items-center justify-center gap-2">
                        <button
                          onClick={() => setCurrentPreviewPage(Math.max(1, currentPreviewPage - 1))}
                          disabled={currentPreviewPage === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          ← Prev
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {currentPreviewPage} of {numPages}
                        </span>
                        <button
                          onClick={() => setCurrentPreviewPage(Math.min(numPages, currentPreviewPage + 1))}
                          disabled={currentPreviewPage === numPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                    
                    {/* Canvas Preview */}
                    <div 
                      ref={previewContainerRef}
                      className="flex-1 overflow-auto bg-gray-100"
                    >
                      <div 
                        ref={previewCanvasWrapperRef}
                        className="min-h-full flex items-start justify-center p-4 relative"
                      >
                        <canvas
                          ref={previewCanvasRef}
                          className={`border border-gray-300 rounded-lg shadow-sm bg-white ${
                            editingMode && (editTool === "text" || editTool === "image") ? "cursor-crosshair" : ""
                          }`}
                          style={{ 
                            display: "block"
                          }}
                          onClick={async (e) => {
                            if (!editingMode || !pdfDoc || !previewCanvasRef.current || !previewViewportCacheRef.current) return;
                            if (editTool !== "text" && editTool !== "image") return;
                            if (isDragging) return; // Don't place if dragging a field
                            
                            const canvas = previewCanvasRef.current;
                            const rect = canvas.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            
                            const viewport = previewViewportCacheRef.current;
                            const pdfX = clickX / viewport.scale;
                            const pdfY = (viewport.height - clickY) / viewport.scale; // PDF Y is from bottom
                            
                            if (editTool === "text") {
                              // Show text input modal
                              setTextInputModal({ x: pdfX, y: pdfY, page: currentPreviewPage });
                              setTextInputValue("");
                            } else if (editTool === "image") {
                              // Trigger file input
                              hiddenFileInputRef.current?.click();
                              // Store position for after file selection
                              setTextInputModal({ x: pdfX, y: pdfY, page: currentPreviewPage });
                            }
                          }}
                        />
                        {/* Hidden file input for images */}
                        <input
                          ref={hiddenFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || !textInputModal) return;
                            
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const imageData = event.target?.result as string;
                              if (imageData) {
                                const img = new window.Image();
                                img.onload = () => {
                                  // Calculate dimensions maintaining aspect ratio
                                  const maxWidth = 200;
                                  const maxHeight = 200;
                                  let width = img.width;
                                  let height = img.height;
                                  
                                  if (width > maxWidth || height > maxHeight) {
                                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                                    width = width * ratio;
                                    height = height * ratio;
                                  }
                                  
                                  const newElement = {
                                    id: `element-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                    type: "image" as const,
                                    x: textInputModal.x,
                                    y: textInputModal.y,
                                    page: textInputModal.page,
                                    imageData,
                                    width,
                                    height,
                                  };
                                  
                                  setAddedElements(prev => [...prev, newElement]);
                                  setTextInputModal(null);
                                  setEditTool("select");
                                };
                                img.src = imageData;
                              }
                            };
                            reader.readAsDataURL(file);
                            
                            // Reset input
                            e.target.value = "";
                          }}
                        />
                        {/* Added Elements Overlays for Editing */}
                        {editingMode && addedElements.length > 0 && previewCanvasRef.current && previewViewportCacheRef.current && (() => {
                          const canvas = previewCanvasRef.current;
                          if (!canvas) return null;
                          const canvasRect = canvas.getBoundingClientRect();
                          const wrapperRect = previewCanvasWrapperRef.current?.getBoundingClientRect();
                          if (!wrapperRect) return null;
                          
                          const offsetX = canvasRect.left - wrapperRect.left;
                          const offsetY = canvasRect.top - wrapperRect.top;
                          const viewport = previewViewportCacheRef.current;
                          
                          const pageElements = addedElements.filter(el => el.page === currentPreviewPage);
                          
                          return (
                            <div 
                              className="absolute pointer-events-none"
                              style={{ 
                                left: offsetX,
                                top: offsetY,
                                width: canvas.width,
                                height: canvas.height,
                              }}
                            >
                              {pageElements.map((element) => {
                                const x = element.x * viewport.scale;
                                const y = viewport.height - element.y * viewport.scale; // PDF Y is from bottom
                                const width = (element.width || 200) * viewport.scale;
                                const height = (element.height || (element.fontSize || 12) * 1.2) * viewport.scale;
                                
                                return (
                                  <div
                                    key={element.id}
                                    className="absolute border-2 border-green-500 bg-green-500/10 pointer-events-auto cursor-move"
                                    style={{
                                      left: x,
                                      top: y - height,
                                      width: element.type === "image" ? width : "auto",
                                      height: height,
                                      minWidth: element.type === "text" ? 100 : width,
                                    }}
                                    title={element.type === "text" ? element.content : "Image"}
                                    onDoubleClick={() => {
                                      // Delete on double click
                                      setAddedElements(prev => prev.filter(el => el.id !== element.id));
                                    }}
                                  >
                                    {element.type === "text" && (
                                      <div className="text-xs text-green-700 font-medium px-1 py-0.5 bg-green-200/80">
                                        {element.content?.substring(0, 30)}
                                      </div>
                                    )}
                                    {element.type === "image" && (
                                      <div className="text-xs text-green-700 font-medium px-1 py-0.5 bg-green-200/80">
                                        Image
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        
                        {/* Field Overlays for Editing */}
                        {editingMode && template.fields && previewCanvasRef.current && (() => {
                          const canvas = previewCanvasRef.current;
                          if (!canvas) return null;
                          const canvasRect = canvas.getBoundingClientRect();
                          const wrapperRect = previewCanvasWrapperRef.current?.getBoundingClientRect();
                          if (!wrapperRect) return null;
                          
                          const offsetX = canvasRect.left - wrapperRect.left;
                          const offsetY = canvasRect.top - wrapperRect.top;
                          
                          return (
                            <div 
                              className="absolute pointer-events-none"
                              style={{ 
                                left: offsetX,
                                top: offsetY,
                                width: canvas.width,
                                height: canvas.height,
                              }}
                            >
                              {template.fields
                                .filter(f => (f.page_number || 1) === currentPreviewPage)
                                .map((field) => {
                                  const fieldKey = field.id || field.field_key;
                                  const bounds = fieldBounds.get(fieldKey);
                                  if (!bounds) return null;
                                  
                                  return (
                                    <div
                                      key={fieldKey}
                                      className="absolute cursor-move pointer-events-auto group"
                                      style={{
                                        left: bounds.x,
                                        top: bounds.y - 18, // Position container above field to place label higher
                                        width: bounds.width,
                                      }}
                                    >
                                      {/* Compact label positioned above field - aligned with border */}
                                      <div 
                                        className="text-[10px] text-blue-600 font-medium px-1.5 py-0.5 bg-blue-50/90 border border-blue-300/50 rounded-sm truncate pointer-events-none shadow-xs"
                                        style={{
                                          width: bounds.width,
                                        }}
                                      >
                                        {field.field_name || field.field_key}
                                      </div>
                                      {/* Subtle border indicator - very transparent, only visible on edges */}
                                      <div
                                        className="absolute pointer-events-none"
                                        style={{
                                          left: 0,
                                          top: 18, // Below the label - aligned with label width
                                          width: bounds.width,
                                          height: bounds.height * 1.2, // Increase height by 20% for better visibility
                                          border: "1px solid rgba(59, 130, 246, 0.2)",
                                          borderRadius: "2px",
                                          backgroundColor: "rgba(0, 0, 0, 0)", // Fully transparent
                                          mixBlendMode: "normal",
                                          transition: "border-color 0.2s",
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
                                          e.currentTarget.style.borderWidth = "1.5px";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.2)";
                                          e.currentTarget.style.borderWidth = "1px";
                                        }}
                                      />
                                      {/* Invisible drag handle covering the field area */}
                                      <div
                                        className="absolute"
                                        style={{
                                          left: 0,
                                          top: 18,
                                          width: bounds.width,
                                          height: bounds.height,
                                          cursor: "move",
                                        }}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          if (!previewCanvasRef.current || !previewViewportCacheRef.current) return;
                                          const canvasEl = previewCanvasRef.current;
                                          const rect = canvasEl.getBoundingClientRect();
                                          const startX = e.clientX - rect.left;
                                          const startY = e.clientY - rect.top;
                                          
                                          // Get initial PDF position
                                          const field = template?.fields?.find(f => (f.id || f.field_key) === fieldKey);
                                          if (!field) return;
                                          
                                          const effectivePos = getEffectiveFieldPosition(field);
                                          
                                          setIsDragging(true);
                                          setDraggingField(fieldKey);
                                          setDragStart({ x: startX, y: startY });
                                          setInitialDragBounds({ x: bounds.x, y: bounds.y });
                                          setInitialDragPosition({ 
                                            x: effectivePos.x_position, 
                                            y: effectivePos.y_position 
                                          });
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Loading preview...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Panel */}
          <div className={`${showPreview ? "w-96" : "w-full"} border-l border-gray-200 bg-white overflow-y-auto flex flex-col`}>
            <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Output File Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output File Name
            </label>
            <input
              type="text"
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
              placeholder="document_filled.pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

              {/* Folder Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Save to Folder
                </label>
                <FolderSelector
                  baseId={baseId}
                  tableId={tableId}
                  selectedPath={selectedFolderPath}
                  onSelect={setSelectedFolderPath}
            />
          </div>

          {/* Fields by Page */}
          {Array.from(fieldsByPage.entries())
            .sort(([a], [b]) => a - b)
            .map(([pageNumber, pageFields]) => (
              <div key={pageNumber} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Page {pageNumber}
                </h3>
                <div className="space-y-4">
                  {pageFields.map((field) => (
                    <div key={field.id || field.field_key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.field_name}
                        {field.is_required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        {field.field_type === "text" && (
                          <Type className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "number" && (
                          <Hash className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "date" && (
                          <Calendar className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "checkbox" && (
                          <CheckSquare className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "signature" && (
                          <PenTool className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "text" && (
                          <>
                          <input
                            type="text"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                                handleFieldChange(field.field_key, e.target.value, field)
                            }
                              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                fieldErrors[field.field_key] ? "border-red-500" : "border-gray-300"
                              }`}
                            placeholder={field.default_value || ""}
                          />
                            {fieldErrors[field.field_key] && (
                              <p className="text-xs text-red-600 mt-1">{fieldErrors[field.field_key]}</p>
                            )}
                          </>
                        )}
                        {field.field_type === "number" && (
                          <>
                          <input
                            type="number"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                field.field_key,
                                  e.target.value ? parseFloat(e.target.value) : "",
                                  field
                              )
                            }
                              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                fieldErrors[field.field_key] ? "border-red-500" : "border-gray-300"
                              }`}
                            placeholder={field.default_value || ""}
                          />
                            {fieldErrors[field.field_key] && (
                              <p className="text-xs text-red-600 mt-1">{fieldErrors[field.field_key]}</p>
                            )}
                          </>
                        )}
                        {field.field_type === "date" && (
                          <input
                            type="date"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                              handleFieldChange(field.field_key, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        )}
                        {field.field_type === "checkbox" && (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={fieldValues[field.field_key] === true || fieldValues[field.field_key] === "true" || fieldValues[field.field_key] === "1"}
                              onChange={(e) =>
                                handleFieldChange(field.field_key, e.target.checked)
                              }
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">
                              {fieldValues[field.field_key] ? "Yes" : "No"}
                            </span>
                          </div>
                        )}
                        {field.field_type === "signature" && (
                          <div className="flex-1 flex items-center gap-2">
                            {fieldValues[field.field_key] ? (
                              <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                                <FileImage className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-600">Signature captured</span>
                                <button
                                  onClick={() => handleFieldChange(field.field_key, "")}
                                  className="ml-auto text-xs text-red-600 hover:text-red-700"
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSignatureModal({ fieldKey: field.field_key })}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                              >
                                <PenTool className="w-4 h-4" />
                                Capture Signature
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {field.default_value && (
                        <p className="text-xs text-gray-500 mt-1">
                          Default: {field.default_value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {template.fields?.filter((f) => f.is_required).length || 0} required field(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Generate & Store
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Signature Capture Modal */}
      <SignatureCapture
        isOpen={signatureModal !== null}
        onClose={() => setSignatureModal(null)}
        onSave={(imageData) => {
          if (signatureModal) {
            handleFieldChange(signatureModal.fieldKey, imageData);
            setSignatureModal(null);
          }
        }}
      />
      
      {/* Text Input Modal */}
      {textInputModal && editTool === "text" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Text</h3>
            <textarea
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              placeholder="Enter text..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              rows={4}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Font Size:</label>
              <input
                type="number"
                min="8"
                max="72"
                defaultValue={12}
                id="text-font-size"
                className="w-20 px-2 py-1 border border-gray-300 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setTextInputModal(null);
                  setTextInputValue("");
                  setEditTool("select");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (textInputValue.trim()) {
                    const fontSize = parseInt((document.getElementById("text-font-size") as HTMLInputElement)?.value || "12", 10);
                    const newElement = {
                      id: `element-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      type: "text" as const,
                      x: textInputModal.x,
                      y: textInputModal.y,
                      page: textInputModal.page,
                      content: textInputValue,
                      fontSize,
                    };
                    setAddedElements(prev => [...prev, newElement]);
                  }
                  setTextInputModal(null);
                  setTextInputValue("");
                  setEditTool("select");
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

