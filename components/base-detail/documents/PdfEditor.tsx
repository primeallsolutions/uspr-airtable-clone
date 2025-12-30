/**
 * PdfEditor.tsx - Adobe Acrobat Reader-like PDF Viewer/Editor
 * 
 * Features:
 * - Native PDF rendering with pdfjs-dist (pixel-perfect)
 * - Page thumbnails and navigation
 * - Zoom controls
 * - Annotations overlay (highlights, text, stamps)
 * - Signature support
 * - Form filling
 * - Text selection
 * - 100% content preservation using pdf-lib
 */

"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X,
  Save,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
  Highlighter,
  Type,
  PenTool,
  Maximize2,
  Minimize2,
  Loader2,
  FileText,
  MousePointer,
  Hand,
  Edit3,
} from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { PDFDocument, rgb } from "pdf-lib";
import { SignatureCapture } from "./SignatureCapture";

type PdfEditorProps = {
  document: StoredDocument | null;
  signedUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
};

type Tool = "select" | "pan" | "highlight" | "text" | "signature" | "edit";

type Annotation = {
  id: string;
  type: "highlight" | "text" | "signature" | "textEdit";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  originalText?: string;
  color?: string;
  imageData?: string;
  fontSize?: number;
};

type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
};

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const DEFAULT_ZOOM_INDEX = 2;

export const PdfEditor = ({
  document,
  signedUrl,
  isOpen,
  onClose,
  onSave,
}: PdfEditorProps) => {
  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  
  // PDF.js state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  
  // View state
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  
  // Drawing state for annotations
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentHighlight, setCurrentHighlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Text editing state
  const [textItems, setTextItems] = useState<Map<number, TextItem[]>>(new Map());
  const [editingText, setEditingText] = useState<{
    pageIndex: number;
    itemIndex: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    originalText: string;
  } | null>(null);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTaskRef = useRef<any>(null);
  const thumbnailTasksRef = useRef<Map<number, any>>(new Map());
  
  const zoom = ZOOM_LEVELS[zoomIndex];

  // Load PDF document
  useEffect(() => {
    // Cancel any pending render tasks when PDF changes or component closes
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore
      }
      renderTaskRef.current = null;
    }
    thumbnailTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch {
        // Ignore
      }
    });
    thumbnailTasksRef.current.clear();
    
    if (!isOpen || !signedUrl || !document) {
      setLoading(false);
      setPdfDoc(null);
      setPdfBytes(null);
      setAnnotations([]);
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch PDF bytes
        const response = await fetch(signedUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Make a copy of the ArrayBuffer for pdf-lib (pdfjs-dist may detach the original)
        const pdfBytesCopy = arrayBuffer.slice(0);
        setPdfBytes(pdfBytesCopy);

        // Load with pdfjs-dist using a separate copy
        const pdfjs = await import("pdfjs-dist");
        if (typeof window !== "undefined") {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        // Use another copy for pdfjs to avoid detachment issues
        const pdfjsCopy = arrayBuffer.slice(0);
        const loadingTask = pdfjs.getDocument({ data: pdfjsCopy });
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setError("Failed to load PDF document");
        setLoading(false);
      }
    };

    loadPdf();
  }, [isOpen, signedUrl, document]);

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
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
    
    setPageRendering(true);
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom, rotation });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Also resize annotation canvas
      if (annotationCanvasRef.current) {
        annotationCanvasRef.current.width = viewport.width;
        annotationCanvasRef.current.height = viewport.height;
      }

      // Create render task and store reference
      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;

      // Extract text content for editing
      try {
        const textContent = await page.getTextContent();
        const rawItems: TextItem[] = [];
        
        for (const item of textContent.items) {
          if ('str' in item && item.str.trim()) {
            const tx = item.transform;
            // Transform coordinates to viewport space
            const fontSize = Math.abs(tx[0]) || 12;
            const x = tx[4];
            const y = tx[5];
            
            rawItems.push({
              str: item.str,
              x: x,
              y: viewport.height / zoom - y - fontSize, // Convert to top-down coordinates
              width: item.width || (item.str.length * fontSize * 0.6),
              height: fontSize * 1.2,
              fontSize: fontSize,
              fontName: (item as any).fontName || 'Helvetica',
            });
          }
        }
        
        // Deduplicate text items at same position (keeps the last one, which is our edit)
        // This handles the case where pdf-lib adds new text over old text
        const positionTolerance = 5;
        const deduplicatedItems: TextItem[] = [];
        const seenPositions = new Map<string, number>(); // position key -> index in deduplicatedItems
        
        for (const item of rawItems) {
          // Create a position key with tolerance
          const posKey = `${Math.round(item.x / positionTolerance) * positionTolerance},${Math.round(item.y / positionTolerance) * positionTolerance}`;
          
          const existingIndex = seenPositions.get(posKey);
          if (existingIndex !== undefined) {
            // There's already an item at this position - replace it with the newer one
            // (Later items in the PDF are typically our edits drawn on top)
            deduplicatedItems[existingIndex] = item;
          } else {
            // New position - add to array
            seenPositions.set(posKey, deduplicatedItems.length);
            deduplicatedItems.push(item);
          }
        }
        
        setTextItems(prev => new Map(prev).set(pageNum, deduplicatedItems));
      } catch (textErr) {
        console.error("Failed to extract text:", textErr);
      }

      // Render annotations for this page
      renderAnnotations(pageNum, viewport);
      
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render page:", err);
      }
    } finally {
      setPageRendering(false);
      renderTaskRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, zoom, rotation]);

  // Render annotations overlay
  const renderAnnotations = useCallback((pageNum: number, viewport: any) => {
    if (!annotationCanvasRef.current || !pdfDoc) return;
    
    const canvas = annotationCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous annotations
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw annotations for current page
    const pageAnnotations = annotations.filter(a => a.pageIndex === pageNum - 1);
    
    for (const ann of pageAnnotations) {
      const scaledX = ann.x * zoom;
      const scaledY = ann.y * zoom;
      const scaledWidth = ann.width * zoom;
      const scaledHeight = ann.height * zoom;

      if (ann.type === "highlight") {
        ctx.fillStyle = ann.color || "rgba(255, 255, 0, 0.3)";
        ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
      } else if (ann.type === "text" && ann.content) {
        ctx.font = `${14 * zoom}px Arial`;
        ctx.fillStyle = ann.color || "#000000";
        ctx.fillText(ann.content, scaledX, scaledY + 14 * zoom);
      } else if (ann.type === "signature" && ann.imageData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, scaledX, scaledY, scaledWidth, scaledHeight);
        };
        img.src = ann.imageData;
      }
    }

    // Draw current highlight being drawn
    if (currentHighlight && activeTool === "highlight") {
      ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
      ctx.fillRect(
        currentHighlight.x * zoom,
        currentHighlight.y * zoom,
        currentHighlight.width * zoom,
        currentHighlight.height * zoom
      );
    }
  }, [annotations, zoom, currentHighlight, activeTool, pdfDoc]);

  // Re-render when page/zoom/rotation changes
  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, zoom, rotation, renderPage]);

  // Re-render annotations when they change (only if PDF is already rendered)
  useEffect(() => {
    if (pdfDoc && canvasRef.current && annotationCanvasRef.current) {
      const canvas = canvasRef.current;
      const viewport = { width: canvas.width, height: canvas.height };
      renderAnnotations(currentPage, viewport);
    }
  }, [annotations, currentPage, renderAnnotations, pdfDoc, zoom, rotation]);

  // Render thumbnails
  const renderThumbnail = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!pdfDoc) return;
    
    // Cancel any existing thumbnail render for this page
    const existingTask = thumbnailTasksRef.current.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
      } catch {
        // Ignore cancellation errors
      }
      thumbnailTasksRef.current.delete(pageNum);
    }
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });
      
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      thumbnailTasksRef.current.set(pageNum, renderTask);
      
      await renderTask.promise;
      thumbnailTasksRef.current.delete(pageNum);
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render thumbnail:", err);
      }
    }
  }, [pdfDoc]);

  // Navigation handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  const prevPage = () => goToPage(currentPage - 1);
  const nextPage = () => goToPage(currentPage + 1);

  // Zoom handlers
  const zoomIn = () => setZoomIndex(i => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  const zoomOut = () => setZoomIndex(i => Math.max(i - 1, 0));
  const resetZoom = () => setZoomIndex(DEFAULT_ZOOM_INDEX);

  // Rotation handler
  const rotate = () => setRotation(r => (r + 90) % 360);

  // Mouse handlers for annotations
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== "highlight") return;
    
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentHighlight({ x, y, width: 0, height: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== "highlight" || !drawStart) return;
    
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    setCurrentHighlight({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      width: Math.abs(x - drawStart.x),
      height: Math.abs(y - drawStart.y),
    });
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing || activeTool !== "highlight" || !currentHighlight) {
      setIsDrawing(false);
      return;
    }
    
    // Only add if it's a meaningful size
    if (currentHighlight.width > 5 && currentHighlight.height > 5) {
      const newAnnotation: Annotation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "highlight",
        pageIndex: currentPage - 1,
        x: currentHighlight.x,
        y: currentHighlight.y,
        width: currentHighlight.width,
        height: currentHighlight.height,
        color: "rgba(255, 255, 0, 0.3)",
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    }
    
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentHighlight(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "text") {
      const canvas = annotationCanvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      const text = window.prompt("Enter text annotation:");
      if (text) {
        const newAnnotation: Annotation = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "text",
          pageIndex: currentPage - 1,
          x,
          y,
          width: 200,
          height: 20,
          content: text,
          color: "#000000",
        };
        setAnnotations(prev => [...prev, newAnnotation]);
      }
    } else if (activeTool === "signature") {
      setShowSignatureCapture(true);
    }
  };

  // Signature handler
  const handleSignatureSave = (imageData: string) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    // Place signature at center of visible area
    const x = (canvas.width / zoom) / 2 - 100;
    const y = (canvas.height / zoom) / 2 - 25;
    
    const newAnnotation: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "signature",
      pageIndex: currentPage - 1,
      x,
      y,
      width: 200,
      height: 50,
      imageData,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setShowSignatureCapture(false);
    setActiveTool("select");
  };

  // Save handler - uses pdf-lib to apply annotations to original PDF
  const handleSave = async () => {
    if (!pdfBytes || !document) return;
    
    setIsSaving(true);
    
    try {
      // Load original PDF with pdf-lib
      const pdfLibDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfLibDoc.getPages();
      
      // Embed font for text edits
      const helveticaFont = await pdfLibDoc.embedFont('Helvetica');
      
      // Apply annotations
      for (const ann of annotations) {
        const page = pages[ann.pageIndex];
        if (!page) continue;
        
        const pageHeight = page.getHeight();
        
        if (ann.type === "highlight") {
          page.drawRectangle({
            x: ann.x,
            y: pageHeight - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
            color: rgb(1, 1, 0),
            opacity: 0.3,
          });
        } else if (ann.type === "text" && ann.content) {
          page.drawText(ann.content, {
            x: ann.x,
            y: pageHeight - ann.y,
            size: 14,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        } else if (ann.type === "textEdit" && ann.content !== undefined) {
          // Text edit: cover original with white, then draw new text
          const fontSize = ann.fontSize || 12;
          
          // Calculate cover width based on ORIGINAL text (to fully cover longer original text)
          const originalTextWidth = ann.originalText 
            ? ann.originalText.length * fontSize * 0.65 
            : ann.width;
          const newTextWidth = ann.content.length * fontSize * 0.65;
          // Use the larger of: original width, stored width, or calculated original text width
          const coverWidth = Math.max(ann.width, originalTextWidth, newTextWidth) + 10;
          
          // Draw white rectangle to FULLY cover original text
          page.drawRectangle({
            x: ann.x - 2,
            y: pageHeight - ann.y - ann.height - 4,
            width: coverWidth,
            height: ann.height + 8,
            color: rgb(1, 1, 1), // White
            opacity: 1,
          });
          
          // Draw new text (if not empty)
          if (ann.content.trim()) {
            page.drawText(ann.content, {
              x: ann.x,
              y: pageHeight - ann.y - fontSize,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
        } else if (ann.type === "signature" && ann.imageData) {
          try {
            const base64Data = ann.imageData.split(",")[1];
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const image = await pdfLibDoc.embedPng(imageBytes);
            
            page.drawImage(image, {
              x: ann.x,
              y: pageHeight - ann.y - ann.height,
              width: ann.width,
              height: ann.height,
            });
          } catch (imgErr) {
            console.error("Failed to embed signature:", imgErr);
          }
        }
      }
      
      // Save modified PDF
      const modifiedBytes = await pdfLibDoc.save();
      const arrayBuffer = modifiedBytes.buffer.slice(
        modifiedBytes.byteOffset,
        modifiedBytes.byteOffset + modifiedBytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const fileName = document.path.split("/").pop() || "document.pdf";
      const file = new File([blob], fileName, { type: "application/pdf" });
      
      await onSave(file);
      onClose();
    } catch (err) {
      console.error("Failed to save PDF:", err);
      alert("Failed to save document. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Download original
  const handleDownload = () => {
    if (!pdfBytes || !document) return;
    
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = document.path.split("/").pop() || "document.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !document) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 flex flex-col ${isFullscreen ? "" : "p-4"}`}
      onClick={onClose}
    >
      <div
        className={`bg-gray-900 flex flex-col overflow-hidden ${
          isFullscreen ? "w-full h-full" : "rounded-xl max-w-7xl max-h-[95vh] mx-auto w-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Toolbar */}
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-4">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="text-white font-medium truncate max-w-xs">
              {document.path.split("/").pop()}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Page Navigation */}
            <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
              <button
                onClick={prevPage}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="text-white text-sm px-2">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage >= numPages}
                className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-600" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
              <button onClick={zoomOut} className="p-1 hover:bg-gray-600 rounded">
                <ZoomOut className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={resetZoom}
                className="text-white text-sm px-2 hover:bg-gray-600 rounded"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={zoomIn} className="p-1 hover:bg-gray-600 rounded">
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            </div>

            <button onClick={rotate} className="p-2 hover:bg-gray-700 rounded-lg">
              <RotateCw className="w-4 h-4 text-white" />
            </button>

            <div className="w-px h-6 bg-gray-600" />

            {/* Tools */}
            <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-1 py-1">
              <button
                onClick={() => setActiveTool("select")}
                className={`p-1.5 rounded ${activeTool === "select" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Select"
              >
                <MousePointer className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setActiveTool("pan")}
                className={`p-1.5 rounded ${activeTool === "pan" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Pan"
              >
                <Hand className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setActiveTool("highlight")}
                className={`p-1.5 rounded ${activeTool === "highlight" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Highlight"
              >
                <Highlighter className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setActiveTool("text")}
                className={`p-1.5 rounded ${activeTool === "text" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Add Text"
              >
                <Type className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setActiveTool("edit")}
                className={`p-1.5 rounded ${activeTool === "edit" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Edit Text"
              >
                <Edit3 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setActiveTool("signature")}
                className={`p-1.5 rounded ${activeTool === "signature" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Add Signature"
              >
                <PenTool className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-600" />

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-700 rounded-lg"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-white" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white" />
              )}
            </button>

            <button onClick={handleDownload} className="p-2 hover:bg-gray-700 rounded-lg">
              <Download className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || annotations.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                annotations.length > 0 ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {annotations.length > 0 ? "Save Changes" : "Save"}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 min-h-0">
          {/* Thumbnails Sidebar */}
          <div className="w-32 bg-gray-800 border-r border-gray-700 overflow-y-auto flex-shrink-0">
            <div className="p-2 space-y-2">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`w-full p-1 rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? "bg-blue-600 ring-2 ring-blue-400"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <canvas
                    ref={(el) => {
                      if (el && pdfDoc) {
                        thumbnailRefs.current.set(pageNum, el);
                        renderThumbnail(pageNum, el);
                      }
                    }}
                    className="w-full bg-white rounded"
                  />
                  <span className="text-xs text-gray-400 mt-1 block">{pageNum}</span>
                </button>
              ))}
            </div>
          </div>

          {/* PDF Viewer */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-gray-600 flex items-start justify-center p-8"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            ) : error ? (
              <div className="text-red-400 text-center">
                <p>{error}</p>
              </div>
            ) : (
              <div className="relative shadow-2xl">
                {/* Main PDF Canvas */}
                <canvas
                  ref={canvasRef}
                  className="bg-white"
                  style={{ display: "block" }}
                />
                
                {/* Annotation Overlay Canvas */}
                <canvas
                  ref={annotationCanvasRef}
                  className="absolute top-0 left-0"
                  style={{
                    cursor: activeTool === "highlight" ? "crosshair" :
                            activeTool === "text" ? "text" :
                            activeTool === "signature" ? "pointer" :
                            activeTool === "edit" ? "text" :
                            activeTool === "pan" ? "grab" : "default"
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onClick={handleCanvasClick}
                />

                {/* Text Layer - Shows editable text overlay */}
                {textItems.get(currentPage) && (
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {textItems.get(currentPage)!.map((item, idx) => {
                      // Check if this text has been edited (cached)
                      const editedAnnotation = annotations.find(
                        a => a.type === "textEdit" && 
                        a.pageIndex === currentPage - 1 && 
                        a.originalText === item.str &&
                        Math.abs(a.x - item.x) < 5 &&
                        Math.abs(a.y - item.y) < 5
                      );
                      
                      const isCurrentlyEditing = editingText && 
                        editingText.itemIndex === idx && 
                        editingText.pageIndex === currentPage - 1;
                      
                      // Show edited text as overlay (real-time cached display)
                      // Must cover the FULL width of the original text
                      if (editedAnnotation && !isCurrentlyEditing) {
                        // Calculate width to cover original text completely
                        const originalTextWidth = item.str.length * item.fontSize * 0.65;
                        const coverWidth = Math.max(item.width, originalTextWidth) + 5;
                        
                        return (
                          <div
                            key={idx}
                            className={`absolute ${activeTool === "edit" ? "pointer-events-auto cursor-text" : "pointer-events-none"}`}
                            style={{
                              left: (item.x - 1) * zoom,
                              top: (item.y - 1) * zoom,
                              minWidth: coverWidth * zoom,
                              height: (item.height + 2) * zoom,
                              fontSize: item.fontSize * zoom,
                              lineHeight: 1,
                              backgroundColor: 'white',
                              padding: `${zoom}px ${2 * zoom}px`,
                            }}
                            onClick={(e) => {
                              if (activeTool === "edit") {
                                e.stopPropagation();
                                setEditingText({
                                  pageIndex: currentPage - 1,
                                  itemIndex: idx,
                                  text: editedAnnotation.content || item.str,
                                  x: item.x,
                                  y: item.y,
                                  width: item.width,
                                  height: item.height,
                                  fontSize: item.fontSize,
                                  originalText: item.str,
                                });
                              }
                            }}
                          >
                            <span className="text-black whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                              {editedAnnotation.content}
                            </span>
                          </div>
                        );
                      }
                      
                      // Show clickable regions in edit mode (for unedited text)
                      if (activeTool === "edit" && !isCurrentlyEditing) {
                        return (
                          <div
                            key={idx}
                            className="absolute pointer-events-auto cursor-text hover:bg-blue-100/50 hover:outline hover:outline-1 hover:outline-blue-400 transition-all"
                            style={{
                              left: item.x * zoom,
                              top: item.y * zoom,
                              minWidth: item.width * zoom,
                              height: item.height * zoom,
                              fontSize: item.fontSize * zoom,
                              lineHeight: 1,
                              padding: '0 1px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingText({
                                pageIndex: currentPage - 1,
                                itemIndex: idx,
                                text: item.str,
                                x: item.x,
                                y: item.y,
                                width: item.width,
                                height: item.height,
                                fontSize: item.fontSize,
                                originalText: item.str,
                              });
                            }}
                            title="Click to edit"
                          >
                            <span className="text-transparent select-none">
                              {item.str}
                            </span>
                          </div>
                        );
                      }
                      
                      return null;
                    })}
                  </div>
                )}

                {/* Inline Text Editor - appears seamlessly over the text */}
                {editingText && (
                  <div
                    className="absolute"
                    style={{
                      left: editingText.x * zoom - 2,
                      top: editingText.y * zoom - 2,
                      zIndex: 100,
                    }}
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editingText.text}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setEditingText({ ...editingText, text: newText });
                        
                        // Real-time cache: update annotations immediately as user types
                        const filteredAnnotations = annotations.filter(
                          a => !(a.type === "textEdit" && 
                            a.pageIndex === editingText.pageIndex && 
                            a.originalText === editingText.originalText &&
                            Math.abs(a.x - editingText.x) < 5 &&
                            Math.abs(a.y - editingText.y) < 5)
                        );
                        
                        // Only add annotation if text changed from original
                        if (newText !== editingText.originalText) {
                          const newAnnotation: Annotation = {
                            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            type: "textEdit",
                            pageIndex: editingText.pageIndex,
                            x: editingText.x,
                            y: editingText.y,
                            width: editingText.width,
                            height: editingText.height,
                            content: newText,
                            originalText: editingText.originalText,
                            fontSize: editingText.fontSize,
                          };
                          setAnnotations([...filteredAnnotations, newAnnotation]);
                        } else {
                          // If reverted to original, remove the edit annotation
                          setAnnotations(filteredAnnotations);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          setEditingText(null);
                        } else if (e.key === "Escape") {
                          // Revert changes on escape
                          const filteredAnnotations = annotations.filter(
                            a => !(a.type === "textEdit" && 
                              a.pageIndex === editingText.pageIndex && 
                              a.originalText === editingText.originalText &&
                              Math.abs(a.x - editingText.x) < 5 &&
                              Math.abs(a.y - editingText.y) < 5)
                          );
                          setAnnotations(filteredAnnotations);
                          setEditingText(null);
                        }
                      }}
                      onBlur={() => setEditingText(null)}
                      className="bg-white text-black outline-none border-2 border-blue-500 rounded-sm shadow-lg"
                      style={{
                        fontSize: editingText.fontSize * zoom,
                        lineHeight: 1.2,
                        padding: '2px 4px',
                        minWidth: Math.max(editingText.width * zoom + 20, 80),
                        fontFamily: 'Helvetica, Arial, sans-serif',
                      }}
                    />
                  </div>
                )}

                {/* Page rendering indicator */}
                {pageRendering && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-800 px-4 py-1.5 flex items-center justify-between text-xs border-t border-gray-700">
          <div className="flex items-center gap-4">
            {annotations.length > 0 ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-yellow-400 font-medium">Unsaved changes:</span>
                <span className="text-gray-400">
                  {annotations.filter(a => a.type !== "textEdit").length > 0 && (
                    <>{annotations.filter(a => a.type !== "textEdit").length} annotation{annotations.filter(a => a.type !== "textEdit").length !== 1 ? "s" : ""}</>
                  )}
                  {annotations.filter(a => a.type !== "textEdit").length > 0 && annotations.filter(a => a.type === "textEdit").length > 0 && ", "}
                  {annotations.filter(a => a.type === "textEdit").length > 0 && (
                    <>{annotations.filter(a => a.type === "textEdit").length} text edit{annotations.filter(a => a.type === "textEdit").length !== 1 ? "s" : ""}</>
                  )}
                </span>
              </span>
            ) : (
              <span className="text-gray-400">No unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <span>Tool: {activeTool}</span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            {activeTool === "edit" && <span className="text-blue-400">Click on text to edit • Enter to confirm • Esc to cancel</span>}
          </div>
        </div>
      </div>

      {/* Signature Capture Modal */}
      <SignatureCapture
        isOpen={showSignatureCapture}
        onClose={() => {
          setShowSignatureCapture(false);
          setActiveTool("select");
        }}
        onSave={handleSignatureSave}
      />
    </div>
  );
};

