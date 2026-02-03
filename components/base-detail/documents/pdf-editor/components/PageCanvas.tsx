/**
 * PDF Page Canvas
 * Renders a single PDF page with annotation overlay
 */

"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2 } from "lucide-react";
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
  
  // Subscribe to annotations directly for reactivity
  const annotations = useAnnotationStore((state) => state.annotations);
  const { getAnnotationsForPage, addHighlight, moveAnnotation, addTextEdit, findTextEdit } = useAnnotationStore();
  
  // Drawing state for highlight tool
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  
  // Drag state for moving annotations
  const [isDragging, setIsDragging] = useState(false);
  const [draggedAnnotation, setDraggedAnnotation] = useState<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  // Get page height for coordinate conversion
  const pageHeight = viewport ? viewport.height / zoom : 0;

  // Get annotations for current page (reactive)
  const pageAnnotations = annotations.filter(a => a.pageIndex === pageNumber - 1);

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

        case "textBox":
          ctx.font = `${ann.fontSize * zoom}px Arial`;
          ctx.fillStyle = ann.color;
          ctx.fillText(ann.content, screenPos.x, screenPos.y + ann.fontSize * zoom);
          break;

        case "textEdit":
          // TextEdit uses screen-like coordinates directly (from textItem extraction)
          // Don't use pdfToScreen conversion for these
          const textEditX = ann.x * zoom;
          const textEditY = ann.y * zoom;
          const textEditWidth = ann.width * zoom;
          const textEditHeight = ann.height * zoom;
          
          // Draw white background to cover original text
          ctx.fillStyle = "white";
          ctx.fillRect(textEditX - 2, textEditY - 2, textEditWidth + 4, textEditHeight + 4);
          // Draw new text
          ctx.font = `${ann.fontSize * zoom}px Arial`;
          ctx.fillStyle = ann.color;
          ctx.fillText(ann.content, textEditX, textEditY + ann.fontSize * zoom);
          break;

        case "signature":
          // Draw signature image
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, screenPos.x, screenPos.y, screenWidth, screenHeight);
          };
          img.src = ann.imageData;
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
      } else if (activeTool === "select") {
        // First check if clicking on an existing annotation to drag it
        const annotation = findAnnotationAtPosition(screenX, screenY);
        if (annotation) {
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
              // Use the existing edit
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
              
              // Start dragging the newly created annotation
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
      } else if (activeTool === "pan") {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        onPanStart?.();
        e.preventDefault();
      } else if (activeTool === "edit") {
        // Find clicked text item
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
    [activeTool, viewport, pageHeight, zoom, textItems, onTextClick, findAnnotationAtPosition, onPanStart, pageNumber, findTextEdit, addTextEdit]
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

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);
    setIsDragging(false);
    setDraggedAnnotation(null);
    setIsPanning(false);
    setPanStart(null);
  }, [isDrawing, currentRect, activeTool, pageNumber, pageHeight, addHighlight, isPanning, onPanEnd]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Don't trigger click if we were dragging or panning
      if (isDragging || isPanning) return;
      
      if (!overlayCanvasRef.current || !viewport) return;

      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const pdfPoint = screenToPdf(screenX, screenY, pageHeight, zoom);

      if (activeTool === "text" || activeTool === "signature") {
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

      {/* Text Layer for Edit Mode */}
      {activeTool === "edit" && textItems.length > 0 && (
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        >
          {textItems.map((item, idx) => (
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
          ))}
        </div>
      )}

      {/* Text Layer for Select/Move Mode - shows moveable text elements */}
      {activeTool === "select" && textItems.length > 0 && (
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        >
          {textItems.map((item, idx) => (
            <div
              key={idx}
              className="absolute pointer-events-auto cursor-move hover:bg-yellow-100/30 hover:outline hover:outline-1 hover:outline-yellow-500 hover:outline-dashed transition-all"
              style={{
                left: item.x * zoom,
                top: item.y * zoom,
                width: item.width * zoom,
                height: item.height * zoom,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                // Trigger the same logic as canvas mousedown for select tool
                const existingEdit = findTextEdit(pageNumber - 1, item.str, item.x, item.y);
                
                if (existingEdit) {
                  setIsDragging(true);
                  setDraggedAnnotation({
                    id: existingEdit.id,
                    startX: existingEdit.x,
                    startY: existingEdit.y,
                    offsetX: e.nativeEvent.offsetX,
                    offsetY: e.nativeEvent.offsetY,
                  });
                } else {
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
                  setIsDragging(true);
                  setDraggedAnnotation({
                    id: newId,
                    startX: item.x,
                    startY: item.y,
                    offsetX: e.nativeEvent.offsetX,
                    offsetY: e.nativeEvent.offsetY,
                  });
                }
              }}
              title="Drag to move"
            />
          ))}
        </div>
      )}
    </div>
  );
}
