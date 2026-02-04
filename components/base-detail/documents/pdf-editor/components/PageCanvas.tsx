/**
 * PDF Page Canvas
 * Renders a single PDF page with annotation overlay
 */

"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2, Trash2 } from "lucide-react";
import { usePdfPage } from "../hooks/usePdfPage";
import { useAnnotationStore } from "../hooks/useAnnotationStore";
import type { Tool, Annotation, TextItem, Rect, Point } from "../types";
import { screenToPdf, pdfToScreen } from "../utils/coordinates";

interface PageCanvasProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  rotation: number;
  activeTool: Tool;
  onTextClick?: (textItem: TextItem, index: number) => void;
  onTextBoxClick?: (annotationId: string) => void;
  onCanvasClick?: (pdfPoint: Point, screenPoint: Point) => void;
  onPanStart?: () => void;
  onPanMove?: (deltaX: number, deltaY: number) => void;
  onPanEnd?: () => void;
}

export function PageCanvas({
  document,
  pageNumber,
  zoom,
  rotation,
  activeTool,
  onTextClick,
  onTextBoxClick,
  onCanvasClick,
  onPanStart,
  onPanMove,
  onPanEnd,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { status, viewport, textItems } = usePdfPage(
    document,
    pageNumber,
    zoom,
    rotation,
    canvasRef
  );
  
  // Subscribe to annotations and selection directly for reactivity
  const annotations = useAnnotationStore((state) => state.annotations);
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const { getAnnotationsForPage, addHighlight, moveAnnotation, addTextEdit, findTextEdit, selectAnnotation, removeAnnotation } = useAnnotationStore();
  
  // Drawing state for highlight tool
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  
  // Drag state for moving annotations
  const [isDragging, setIsDragging] = useState(false);
  const [draggedAnnotation, setDraggedAnnotation] = useState<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const wasDraggingRef = useRef(false); // Track if we just finished dragging to prevent click
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  // Get page height for coordinate conversion
  const pageHeight = viewport ? viewport.height / zoom : 0;

  // Get annotations for current page (reactive)
  const pageAnnotations = annotations.filter(a => a.pageIndex === pageNumber - 1);

  // Cache for preloaded signature images to avoid async loading issues
  const signatureImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Preload signature images when annotations change
  useEffect(() => {
    const signatureAnnotations = pageAnnotations.filter(a => a.type === "signature");
    for (const ann of signatureAnnotations) {
      if (ann.type === "signature" && !signatureImagesRef.current.has(ann.id)) {
        const img = new Image();
        img.src = ann.imageData;
        signatureImagesRef.current.set(ann.id, img);
      }
    }
  }, [pageAnnotations]);

  // Render annotations on overlay canvas
  const renderAnnotations = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !viewport) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match overlay canvas size to main canvas
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Clear previous
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw annotations for this page
    for (const ann of pageAnnotations) {
      const screenPos = pdfToScreen(ann.x, ann.y + ann.height, pageHeight, zoom);
      const screenWidth = ann.width * zoom;
      const screenHeight = ann.height * zoom;

      switch (ann.type) {
        case "highlight":
          ctx.fillStyle = ann.color;
          ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
          break;

        case "textBox": {
          // Build font string with formatting
          const textBoxFontStyle = ann.fontStyle === "italic" ? "italic " : "";
          const textBoxFontWeight = ann.fontWeight === "bold" ? "bold " : "";
          const textBoxFontFamily = ann.fontFamily || "Arial";
          ctx.font = `${textBoxFontStyle}${textBoxFontWeight}${ann.fontSize * zoom}px ${textBoxFontFamily}`;
          
          // Draw background if set
          if (ann.backgroundColor && ann.backgroundColor !== "transparent") {
            const textMetrics = ctx.measureText(ann.content);
            ctx.fillStyle = ann.backgroundColor;
            ctx.fillRect(
              screenPos.x - 2, 
              screenPos.y, 
              textMetrics.width + 4, 
              ann.fontSize * zoom + 4
            );
          }
          
          ctx.fillStyle = ann.color;
          ctx.fillText(ann.content, screenPos.x, screenPos.y + ann.fontSize * zoom);
          
          // Draw underline or strikethrough
          if (ann.textDecoration === "underline" || ann.textDecoration === "line-through") {
            const textMetrics = ctx.measureText(ann.content);
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = 1;
            const yOffset = ann.textDecoration === "underline" 
              ? ann.fontSize * zoom + 2 
              : ann.fontSize * zoom * 0.6;
            ctx.beginPath();
            ctx.moveTo(screenPos.x, screenPos.y + yOffset);
            ctx.lineTo(screenPos.x + textMetrics.width, screenPos.y + yOffset);
            ctx.stroke();
          }
          break;
        }

        case "textEdit": {
          // TextEdit uses screen-like coordinates directly (from textItem extraction)
          const textEditX = ann.x * zoom;
          const textEditY = ann.y * zoom;
          const textEditWidth = ann.width * zoom;
          const textEditHeight = ann.height * zoom;
          
          // Build font string with formatting
          const editFontStyle = ann.fontStyle === "italic" ? "italic " : "";
          const editFontWeight = ann.fontWeight === "bold" ? "bold " : "";
          const editFontFamily = ann.fontFamily || "Arial";
          
          // IMPORTANT: First cover the ORIGINAL position (where the text was in the PDF)
          // This prevents the "copy" effect when moving text
          const originalX = ann.originalX * zoom;
          const originalY = ann.originalY * zoom;
          ctx.fillStyle = "white";
          ctx.fillRect(originalX - 2, originalY - 2, textEditWidth + 4, textEditHeight + 4);
          
          // If the text has been moved, draw at the new position
          // Draw white background at new position too (in case it overlaps other text)
          if (textEditX !== originalX || textEditY !== originalY) {
            ctx.fillRect(textEditX - 2, textEditY - 2, textEditWidth + 4, textEditHeight + 4);
          }
          
          // Draw background color if set
          if (ann.backgroundColor && ann.backgroundColor !== "transparent") {
            ctx.fillStyle = ann.backgroundColor;
            ctx.fillRect(textEditX - 2, textEditY - 2, textEditWidth + 4, textEditHeight + 4);
          }
          
          // Draw the text at the current position
          ctx.font = `${editFontStyle}${editFontWeight}${ann.fontSize * zoom}px ${editFontFamily}`;
          ctx.fillStyle = ann.color;
          ctx.fillText(ann.content, textEditX, textEditY + ann.fontSize * zoom);
          
          // Draw underline or strikethrough
          if (ann.textDecoration === "underline" || ann.textDecoration === "line-through") {
            const textMetrics = ctx.measureText(ann.content);
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = 1;
            const yOffset = ann.textDecoration === "underline" 
              ? ann.fontSize * zoom + 2 
              : ann.fontSize * zoom * 0.6;
            ctx.beginPath();
            ctx.moveTo(textEditX, textEditY + yOffset);
            ctx.lineTo(textEditX + textMetrics.width, textEditY + yOffset);
            ctx.stroke();
          }
          break;
        }

        case "signature":
          // Use cached image for immediate drawing (no async delay)
          const cachedImg = signatureImagesRef.current.get(ann.id);
          if (cachedImg && cachedImg.complete) {
            ctx.drawImage(cachedImg, screenPos.x, screenPos.y, screenWidth, screenHeight);
          } else {
            // Fallback: load and draw (first render)
            const img = new Image();
            img.onload = () => {
              signatureImagesRef.current.set(ann.id, img);
              ctx.drawImage(img, screenPos.x, screenPos.y, screenWidth, screenHeight);
            };
            img.src = ann.imageData;
          }
          break;

        case "signatureField":
          // Draw signature field marker with color coding by field type
          let fieldColor: string;
          let fieldBgColor: string;
          let fieldTextColor: string;
          
          switch (ann.fieldType) {
            case "signature":
              fieldColor = "#9333ea"; // Purple for signature
              fieldBgColor = "rgba(147, 51, 234, 0.15)";
              fieldTextColor = "#7c3aed";
              break;
            case "initial":
              fieldColor = "#0891b2"; // Cyan for initials
              fieldBgColor = "rgba(8, 145, 178, 0.15)";
              fieldTextColor = "#0e7490";
              break;
            case "date":
              fieldColor = "#059669"; // Green for date
              fieldBgColor = "rgba(5, 150, 105, 0.15)";
              fieldTextColor = "#047857";
              break;
            default:
              fieldColor = "#6b7280"; // Gray for text/other
              fieldBgColor = "rgba(107, 114, 128, 0.15)";
              fieldTextColor = "#4b5563";
          }
          
          ctx.strokeStyle = fieldColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
          ctx.setLineDash([]);
          
          // Fill with translucent background
          ctx.fillStyle = fieldBgColor;
          ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
          
          // Draw label with field type badge
          ctx.font = `bold ${Math.max(10 * zoom, 10)}px Arial`;
          ctx.fillStyle = fieldTextColor;
          const label = ann.label || ann.fieldType;
          const fieldTypeLabel = ann.fieldType === "initial" ? "✍️" : ann.fieldType === "date" ? "📅" : "🖊️";
          ctx.fillText(
            fieldTypeLabel + " " + label + (ann.isRequired ? " *" : ""),
            screenPos.x + 4,
            screenPos.y + 14 * zoom
          );
          
          // Draw icon based on field type
          ctx.strokeStyle = fieldColor;
          ctx.fillStyle = fieldColor;
          const iconSize = 12 * zoom;
          const iconX = screenPos.x + screenWidth - iconSize - 4;
          const iconY = screenPos.y + 4;
          
          if (ann.fieldType === "signature") {
            // Draw pen icon
            ctx.beginPath();
            ctx.moveTo(iconX, iconY + iconSize);
            ctx.lineTo(iconX + iconSize * 0.7, iconY);
            ctx.stroke();
          } else if (ann.fieldType === "initial") {
            // Draw initials "IN" text
            ctx.font = `bold ${iconSize * 0.8}px Arial`;
            ctx.fillText("IN", iconX, iconY + iconSize * 0.8);
          } else if (ann.fieldType === "date") {
            // Draw calendar icon
            ctx.strokeRect(iconX, iconY, iconSize, iconSize);
            ctx.moveTo(iconX, iconY + iconSize * 0.3);
            ctx.lineTo(iconX + iconSize, iconY + iconSize * 0.3);
            ctx.stroke();
          }
          break;
      }
    }

    // Draw current highlight being created
    if (currentRect && activeTool === "highlight") {
      ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
      ctx.fillRect(
        currentRect.x * zoom,
        currentRect.y * zoom,
        currentRect.width * zoom,
        currentRect.height * zoom
      );
    }
  }, [viewport, zoom, pageHeight, currentRect, activeTool, pageAnnotations]);

  // Re-render annotations when they change
  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // Find annotation at a screen position
  const findAnnotationAtPosition = useCallback(
    (screenX: number, screenY: number): Annotation | null => {
      const pageAnnotations = getAnnotationsForPage(pageNumber - 1);
      
      for (const ann of pageAnnotations) {
        let screenPosX: number;
        let screenPosY: number;
        let screenWidth: number;
        let screenHeight: number;
        
        if (ann.type === "textEdit") {
          // TextEdit uses screen coordinates directly
          screenPosX = ann.x * zoom;
          screenPosY = ann.y * zoom;
          screenWidth = ann.width * zoom;
          screenHeight = ann.height * zoom;
        } else {
          // Other annotations use PDF coordinates
          const screenPos = pdfToScreen(ann.x, ann.y + ann.height, pageHeight, zoom);
          screenPosX = screenPos.x;
          screenPosY = screenPos.y;
          screenWidth = ann.width * zoom;
          screenHeight = ann.height * zoom;
        }
        
        if (
          screenX >= screenPosX &&
          screenX <= screenPosX + screenWidth &&
          screenY >= screenPosY &&
          screenY <= screenPosY + screenHeight
        ) {
          return ann;
        }
      }
      return null;
    },
    [getAnnotationsForPage, pageNumber, pageHeight, zoom]
  );

  // Mouse handlers for the overlay canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!overlayCanvasRef.current || !viewport) return;

      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const pdfPoint = screenToPdf(screenX, screenY, pageHeight, zoom);

      if (activeTool === "highlight") {
        setIsDrawing(true);
        setDrawStart({ x: screenX / zoom, y: screenY / zoom });
        setCurrentRect({ x: screenX / zoom, y: screenY / zoom, width: 0, height: 0 });
        selectAnnotation(null); // Deselect when starting new highlight
      } else if (activeTool === "select") {
        // First check if clicking on an existing annotation to drag it
        const annotation = findAnnotationAtPosition(screenX, screenY);
        if (annotation) {
          // Select the annotation
          selectAnnotation(annotation.id);
          
          // For textEdit annotations, use screen coordinates directly
          if (annotation.type === "textEdit") {
            setIsDragging(true);
            setDraggedAnnotation({
              id: annotation.id,
              startX: annotation.x,
              startY: annotation.y,
              offsetX: screenX - annotation.x * zoom,
              offsetY: screenY - annotation.y * zoom,
            });
          } else {
            const screenPos = pdfToScreen(annotation.x, annotation.y + annotation.height, pageHeight, zoom);
            setIsDragging(true);
            setDraggedAnnotation({
              id: annotation.id,
              startX: annotation.x,
              startY: annotation.y,
              offsetX: screenX - screenPos.x,
              offsetY: screenY - screenPos.y,
            });
          }
          e.preventDefault();
          return;
        }
        
        // If no annotation found, check if clicking on original PDF text
        // Convert it to a moveable textEdit annotation
        for (let i = 0; i < textItems.length; i++) {
          const item = textItems[i];
          const margin = 2;
          if (
            screenX / zoom >= item.x - margin &&
            screenX / zoom <= item.x + item.width + margin &&
            screenY / zoom >= item.y - margin &&
            screenY / zoom <= item.y + item.height + margin
          ) {
            // Check if there's already a textEdit for this item
            const existingEdit = findTextEdit(
              pageNumber - 1,
              item.str,
              item.x,
              item.y
            );
            
            if (existingEdit) {
              // Select and use the existing edit
              selectAnnotation(existingEdit.id);
              setIsDragging(true);
              setDraggedAnnotation({
                id: existingEdit.id,
                startX: existingEdit.x,
                startY: existingEdit.y,
                offsetX: screenX - existingEdit.x * zoom,
                offsetY: screenY - existingEdit.y * zoom,
              });
            } else {
              // Create a new textEdit annotation for this text (same content, now moveable)
              const newId = addTextEdit(
                pageNumber - 1,
                item.x,
                item.y,
                item.width,
                item.height,
                item.str,
                item.str, // Same content - just making it moveable
                item.fontSize
              );
              
              // Select and start dragging the newly created annotation
              selectAnnotation(newId);
              setIsDragging(true);
              setDraggedAnnotation({
                id: newId,
                startX: item.x,
                startY: item.y,
                offsetX: screenX - item.x * zoom,
                offsetY: screenY - item.y * zoom,
              });
            }
            e.preventDefault();
            return;
          }
        }
        
        // Clicked on empty space - deselect
        selectAnnotation(null);
      } else if (activeTool === "pan") {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        onPanStart?.();
        e.preventDefault();
      } else if (activeTool === "edit") {
        // First check if clicking on a textBox annotation
        const clickedAnnotation = findAnnotationAtPosition(screenX, screenY);
        if (clickedAnnotation && clickedAnnotation.type === "textBox") {
          onTextBoxClick?.(clickedAnnotation.id);
          e.preventDefault();
          return;
        }
        
        // Then check for original PDF text items
        for (let i = 0; i < textItems.length; i++) {
          const item = textItems[i];
          const margin = 5;
          if (
            screenX / zoom >= item.x - margin &&
            screenX / zoom <= item.x + item.width + margin &&
            screenY / zoom >= item.y - margin &&
            screenY / zoom <= item.y + item.height + margin
          ) {
            onTextClick?.(item, i);
            return;
          }
        }
      }
    },
    [activeTool, viewport, pageHeight, zoom, textItems, onTextClick, onTextBoxClick, findAnnotationAtPosition, onPanStart, pageNumber, findTextEdit, addTextEdit, selectAnnotation]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!overlayCanvasRef.current) return;

      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (isDrawing && drawStart) {
        setCurrentRect({
          x: Math.min(drawStart.x, screenX / zoom),
          y: Math.min(drawStart.y, screenY / zoom),
          width: Math.abs(screenX / zoom - drawStart.x),
          height: Math.abs(screenY / zoom - drawStart.y),
        });
      } else if (isDragging && draggedAnnotation) {
        // Move the annotation
        const newScreenX = screenX - draggedAnnotation.offsetX;
        const newScreenY = screenY - draggedAnnotation.offsetY;
        
        // Find the annotation to check its type
        const pageAnnotations = getAnnotationsForPage(pageNumber - 1);
        const ann = pageAnnotations.find(a => a.id === draggedAnnotation.id);
        if (ann) {
          if (ann.type === "textEdit") {
            // TextEdit uses screen coordinates directly
            const newX = newScreenX / zoom;
            const newY = newScreenY / zoom;
            moveAnnotation(draggedAnnotation.id, newX, newY);
          } else {
            // Other annotations use PDF coordinates (bottom-left origin)
            const newPdfX = newScreenX / zoom;
            const newPdfY = pageHeight - newScreenY / zoom - ann.height;
            moveAnnotation(draggedAnnotation.id, newPdfX, newPdfY);
          }
        }
      } else if (isPanning && panStart) {
        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;
        onPanMove?.(deltaX, deltaY);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [isDrawing, drawStart, zoom, isDragging, draggedAnnotation, isPanning, panStart, getAnnotationsForPage, pageNumber, pageHeight, moveAnnotation, onPanMove]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentRect && activeTool === "highlight") {
      // Only add if it's a meaningful size
      if (currentRect.width > 5 && currentRect.height > 5) {
        // Convert screen rect to PDF coordinates
        const pdfRect: Rect = {
          x: currentRect.x,
          y: pageHeight - currentRect.y - currentRect.height,
          width: currentRect.width,
          height: currentRect.height,
        };
        addHighlight(pageNumber - 1, pdfRect);
      }
    }

    if (isPanning) {
      onPanEnd?.();
    }

    // Track if we were dragging to prevent click event from firing
    if (isDragging) {
      wasDraggingRef.current = true;
      // Reset the flag after a short delay (allows click event to check it)
      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 100);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);
    setIsDragging(false);
    setDraggedAnnotation(null);
    setIsPanning(false);
    setPanStart(null);
  }, [isDrawing, currentRect, activeTool, pageNumber, pageHeight, addHighlight, isPanning, onPanEnd, isDragging]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Don't trigger click if we were dragging or panning (or just finished)
      if (isDragging || isPanning || wasDraggingRef.current) return;
      
      if (!overlayCanvasRef.current || !viewport) return;

      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const pdfPoint = screenToPdf(screenX, screenY, pageHeight, zoom);

      if (activeTool === "text" || activeTool === "signature" || activeTool === "signatureField" || activeTool === "initialsField" || activeTool === "dateField") {
        onCanvasClick?.(pdfPoint, { x: screenX, y: screenY });
      }
    },
    [viewport, pageHeight, zoom, activeTool, onCanvasClick, isDragging, isPanning]
  );

  // Get cursor style based on active tool and state
  const getCursor = () => {
    if (isDragging) return "grabbing";
    if (isPanning) return "grabbing";
    
    switch (activeTool) {
      case "select":
        return "default";
      case "highlight":
        return "crosshair";
      case "text":
        return "text";
      case "edit":
        return "text";
      case "signature":
        return "pointer";
      case "signatureField":
      case "initialsField":
      case "dateField":
        return "crosshair";
      case "pan":
        return "grab";
      default:
        return "default";
    }
  };

  return (
    <div ref={containerRef} className="relative shadow-2xl">
      {/* Main PDF Canvas */}
      <canvas
        ref={canvasRef}
        className="bg-white"
        style={{ display: "block" }}
      />

      {/* Annotation Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0"
        style={{
          cursor: getCursor(),
          pointerEvents: "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDrawing(false);
          setDrawStart(null);
          setCurrentRect(null);
          setIsDragging(false);
          setDraggedAnnotation(null);
          if (isPanning) {
            onPanEnd?.();
          }
          setIsPanning(false);
          setPanStart(null);
        }}
        onClick={handleClick}
      />

      {/* Loading Overlay */}
      {status === "rendering" && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
        </div>
      )}

      {/* Text Layer for Edit Mode - only show text items that haven't been converted to annotations */}
      {activeTool === "edit" && textItems.length > 0 && (
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        >
          {textItems.map((item, idx) => {
            // Skip text items that already have a textEdit annotation
            const hasEdit = findTextEdit(pageNumber - 1, item.str, item.x, item.y);
            if (hasEdit) return null;
            
            return (
              <div
                key={idx}
                className="absolute pointer-events-auto cursor-text hover:bg-blue-100/50 hover:outline hover:outline-1 hover:outline-blue-400 transition-all"
                style={{
                  left: item.x * zoom,
                  top: item.y * zoom,
                  width: item.width * zoom,
                  height: item.height * zoom,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTextClick?.(item, idx);
                }}
                title="Click to edit"
              />
            );
          })}
        </div>
      )}

      {/* TextBox Annotation Layer for Edit Mode - allow editing added text annotations */}
      {activeTool === "edit" && (
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 6 }}
        >
          {pageAnnotations
            .filter((ann) => ann.type === "textBox")
            .map((ann) => {
              const screenPos = pdfToScreen(ann.x, ann.y + ann.height, pageHeight, zoom);
              const screenWidth = ann.width * zoom;
              const screenHeight = ann.height * zoom;
              
              return (
                <div
                  key={ann.id}
                  className="absolute pointer-events-auto cursor-text hover:bg-green-100/50 hover:outline hover:outline-2 hover:outline-green-500 transition-all rounded-sm"
                  style={{
                    left: screenPos.x,
                    top: screenPos.y,
                    width: screenWidth,
                    height: screenHeight,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTextBoxClick?.(ann.id);
                  }}
                  title="Click to edit this text"
                />
              );
            })}
        </div>
      )}

      {/* Text Layer for Select/Move Mode - only show text items that haven't been moved */}
      {activeTool === "select" && textItems.length > 0 && (
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        >
          {textItems.map((item, idx) => {
            // Skip text items that already have a textEdit annotation (they're now annotations)
            const existingEdit = findTextEdit(pageNumber - 1, item.str, item.x, item.y);
            if (existingEdit) return null;
            
            return (
              <div
                key={idx}
                className="absolute pointer-events-auto cursor-grab hover:cursor-grabbing group"
                style={{
                  left: item.x * zoom,
                  top: item.y * zoom,
                  width: item.width * zoom,
                  height: item.height * zoom,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Create a new textEdit annotation for this text
                  const newId = addTextEdit(
                    pageNumber - 1,
                    item.x,
                    item.y,
                    item.width,
                    item.height,
                    item.str,
                    item.str,
                    item.fontSize
                  );
                  selectAnnotation(newId);
                  setIsDragging(true);
                  setDraggedAnnotation({
                    id: newId,
                    startX: item.x,
                    startY: item.y,
                    offsetX: e.nativeEvent.offsetX,
                    offsetY: e.nativeEvent.offsetY,
                  });
                }}
                title="Click and drag to move this text"
              >
                {/* Hover overlay with visual indicator */}
                <div className="absolute inset-0 bg-yellow-400/0 group-hover:bg-yellow-400/20 border border-transparent group-hover:border-yellow-500 group-hover:border-dashed rounded-sm transition-all duration-150" />
                {/* Move indicator badge */}
                <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none">
                  ✋ Drag to move
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selection Overlay with Delete Button */}
      {selectedAnnotationId && pageAnnotations.some(ann => ann.id === selectedAnnotationId) && !isDragging && (
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {pageAnnotations.filter(ann => ann.id === selectedAnnotationId).map((ann) => {
            let screenPosX: number;
            let screenPosY: number;
            let screenWidth: number;
            let screenHeight: number;
            
            if (ann.type === "textEdit") {
              // TextEdit uses screen coordinates directly
              screenPosX = ann.x * zoom;
              screenPosY = ann.y * zoom;
              screenWidth = ann.width * zoom;
              screenHeight = ann.height * zoom;
            } else {
              // Other annotations use PDF coordinates
              const screenPos = pdfToScreen(ann.x, ann.y + ann.height, pageHeight, zoom);
              screenPosX = screenPos.x;
              screenPosY = screenPos.y;
              screenWidth = ann.width * zoom;
              screenHeight = ann.height * zoom;
            }

            return (
              <div key={ann.id}>
                {/* Selection border */}
                <div
                  className="absolute border-2 border-blue-500 rounded-sm bg-blue-500/10 shadow-sm"
                  style={{
                    left: screenPosX - 2,
                    top: screenPosY - 2,
                    width: screenWidth + 4,
                    height: screenHeight + 4,
                    pointerEvents: "none",
                  }}
                />
                
                {/* Action toolbar */}
                <div
                  className="absolute pointer-events-auto flex items-center gap-1 bg-gray-800 rounded-lg shadow-lg px-1 py-0.5"
                  style={{
                    left: screenPosX,
                    top: screenPosY - 28,
                  }}
                >
                  {/* Drag handle indicator */}
                  <span className="text-[10px] text-gray-300 px-1.5 select-none">
                    ✋ Drag to move
                  </span>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAnnotation(ann.id);
                    }}
                    className="flex items-center justify-center w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                    title="Delete (Del/Backspace)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dragging indicator */}
      {isDragging && draggedAnnotation && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: 10,
            top: 10,
            zIndex: 100,
          }}
        >
          <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg animate-pulse">
            Moving annotation...
          </div>
        </div>
      )}
    </div>
  );
}
