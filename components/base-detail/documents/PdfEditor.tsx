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
  
  // Render coordination state
  const [renderInProgress, setRenderInProgress] = useState(false);
  
  // View state
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [showContentOutlines, setShowContentOutlines] = useState(true);
  
  // Drag and drop state
  const [draggedBlock, setDraggedBlock] = useState<{
    id: string;
    type: 'text' | 'image' | 'annotation';
    originalX: number;
    originalY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [viewportOffset, setViewportOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
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
  
  // Content outline state
  const [contentBlocks, setContentBlocks] = useState<Map<number, Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'text' | 'image' | 'annotation';
    id: string;
  }>>>(new Map());
  
  // Container refs for panning
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTaskRef = useRef<any>(null);
  const currentRenderPageRef = useRef<number | null>(null);
  const thumbnailTasksRef = useRef<Map<number, any>>(new Map());
  
  // Render queue to prevent concurrent operations
  const renderQueueRef = useRef<Array<{pageNum: number, resolve: () => void}>>([]);
  const isProcessingRenderRef = useRef<boolean>(false);
  
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
    
    // Clear render queue
    renderQueueRef.current = [];
    isProcessingRenderRef.current = false;
    
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
      // Clear text items as well
      setTextItems(new Map());
      setEditingText(null);
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
  
  // Cleanup on unmount
  useEffect(() => {
    const taskRef = thumbnailTasksRef.current;
    return () => {
      // Cancel any remaining render tasks
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }
      taskRef.forEach((task) => {
        try {
          task.cancel();
        } catch {
          // Ignore
        }
      });
      taskRef.clear();
      
      // Clear render queue
      renderQueueRef.current = [];
      isProcessingRenderRef.current = false;
      
      // Clear current render page tracking
      currentRenderPageRef.current = null;
      
      // Also clean up any ongoing drag operations
      setIsDragging(false);
      setDraggedBlock(null);
      setPanStart(null);
      setRenderInProgress(false);
      
      // Clean up any temporary drag annotations
      setAnnotations(prev => prev.filter(a => !a.id.startsWith('drag_')));
      
      // Reset drag update throttle
      lastDragUpdateRef.current = 0;
    };
  }, []);

  // Actual render implementation
  const performRender = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    // Prevent multiple concurrent renders
    if (renderInProgress) {
      console.debug("Render already in progress, skipping");
      return;
    }
    
    // Check if this page is already being rendered
    if (currentRenderPageRef.current === pageNum) {
      console.debug(`Page ${pageNum} is already being rendered, skipping`);
      return;
    }
    
    setRenderInProgress(true);
    
    // Track which page is currently being rendered
    currentRenderPageRef.current = pageNum;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom, rotation });
      
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn("Canvas ref became null during render preparation");
        return;
      }
      
      const context = canvas.getContext("2d");
      if (!context) {
        console.warn("Could not get 2D context from canvas");
        return;
      }

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Also resize annotation canvas
      if (annotationCanvasRef.current) {
        annotationCanvasRef.current.width = viewport.width;
        annotationCanvasRef.current.height = viewport.height;
      }

      // Create render task with explicit cancellation protection
      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      
      // Store render task reference temporarily
      renderTaskRef.current = renderTask;
      
      // Wait for render to complete
      await renderTask.promise;
      
      // Clear the render task reference after completion
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }

      // Extract text content for editing
      try {
        const textContent = await page.getTextContent();
        const rawItems: TextItem[] = [];
        const pageContentBlocks: Array<{x: number; y: number; width: number; height: number; type: 'text' | 'image' | 'annotation'; id: string;}> = [];
        
        for (const item of textContent.items) {
          if ('str' in item && item.str.trim()) {
            const tx = item.transform;
            // Transform coordinates to viewport space
            const fontSize = Math.abs(tx[0]) || 12;
            const x = tx[4];
            const y = tx[5];
            
            const textItem = {
              str: item.str,
              x: x,
              y: viewport.height / zoom - y - fontSize, // Convert to top-down coordinates
              width: item.width || (item.str.length * fontSize * 0.6),
              height: fontSize * 1.2,
              fontSize: fontSize,
              fontName: (item as any).fontName || 'Helvetica',
            };
            
            rawItems.push(textItem);
            
            // Add text block to content outlines
            pageContentBlocks.push({
              x: textItem.x,
              y: textItem.y,
              width: textItem.width,
              height: textItem.height,
              type: 'text',
              id: `text-${pageNum}-${rawItems.length - 1}`
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
        
        // Add annotation blocks to content outlines
        const pageAnnotations = annotations.filter(a => a.pageIndex === pageNum - 1);
        pageAnnotations.forEach(ann => {
          pageContentBlocks.push({
            x: ann.x,
            y: ann.y,
            width: ann.width,
            height: ann.height,
            type: 'annotation',
            id: ann.id
          });
        });
        
        // Update content blocks for this page
        setContentBlocks(prev => new Map(prev).set(pageNum, pageContentBlocks));
        
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
      // Clear the current render page tracking
      if (currentRenderPageRef.current === pageNum) {
        currentRenderPageRef.current = null;
      }
      setPageRendering(false);
      setRenderInProgress(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, zoom, rotation, annotations]);
  
  // Process render queue sequentially
  const processRenderQueue = useCallback(async () => {
    if (isProcessingRenderRef.current || renderQueueRef.current.length === 0) {
      return;
    }
    
    isProcessingRenderRef.current = true;
    
    while (renderQueueRef.current.length > 0) {
      const { pageNum, resolve } = renderQueueRef.current.shift()!;
      
      try {
        await performRender(pageNum);
      } catch (error) {
        console.error("Render queue error:", error);
      } finally {
        resolve();
      }
    }
    
    isProcessingRenderRef.current = false;
  }, [performRender]);

  // Queue-based render function to prevent concurrent operations
  const queueRender = useCallback((pageNum: number): Promise<void> => {
    return new Promise((resolve) => {
      // Add to queue
      renderQueueRef.current.push({ pageNum, resolve });
      
      // Process queue if not already processing
      if (!isProcessingRenderRef.current) {
        processRenderQueue();
      }
    });
  }, [processRenderQueue]);
  
  // Public render function that uses the queue
  const renderPage = useCallback(async (pageNum: number) => {
    await queueRender(pageNum);
  }, [queueRender]);

  // Render annotations overlay
  const renderAnnotations = useCallback((pageNum: number, viewport: any) => {
    if (!annotationCanvasRef.current || !pdfDoc || pageRendering || isDragging || renderInProgress) return;
    
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
      } else if (ann.type === "textEdit" && ann.content) {
        // For text edits, draw them on the canvas as well
        ctx.font = `${ann.fontSize || 12 * zoom}px Arial`;
        ctx.fillStyle = ann.color || "#000000";
        ctx.fillText(ann.content, scaledX, scaledY + (ann.fontSize || 12) * zoom);
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
  }, [annotations, zoom, currentHighlight, activeTool, pdfDoc, pageRendering, isDragging, renderInProgress]);

  // Re-render when page/zoom/rotation changes
  useEffect(() => {
    if (pdfDoc && currentPage && !pageRendering && !isDragging && !renderInProgress) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, zoom, rotation, renderPage, pageRendering, isDragging, renderInProgress]);
  
  // Memoize content blocks calculation to prevent unnecessary updates
  const calculateContentBlocks = useCallback(() => {
    if (!pdfDoc || pageRendering || isDragging || renderInProgress) return;
    
    const newContentBlocks = new Map<number, Array<{x: number; y: number; width: number; height: number; type: 'text' | 'image' | 'annotation'; id: string;}>>();
    
    // For each page, collect content blocks
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageContentBlocks: Array<{x: number; y: number; width: number; height: number; type: 'text' | 'image' | 'annotation'; id: string;}> = [];
      
      // Add text items
      const pageTextItems = textItems.get(pageNum) || [];
      pageTextItems.forEach((item, idx) => {
        pageContentBlocks.push({
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          type: 'text',
          id: `text-${pageNum}-${idx}`
        });
      });
      
      // Add annotations
      const pageAnnotations = annotations.filter(a => a.pageIndex === pageNum - 1);
      pageAnnotations.forEach(ann => {
        pageContentBlocks.push({
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height,
          type: 'annotation',
          id: ann.id
        });
      });
      
      newContentBlocks.set(pageNum, pageContentBlocks);
    }
    
    return newContentBlocks;
  }, [annotations, textItems, numPages, pdfDoc, pageRendering, isDragging, renderInProgress]);

  // Re-render annotations when they change (only if PDF is already rendered)
  // Prevent re-render spam by adding drag state and render coordination guards
  useEffect(() => {
    if (pdfDoc && canvasRef.current && annotationCanvasRef.current && !pageRendering && !isDragging && !renderInProgress) {
      const canvas = canvasRef.current;
      const viewport = { width: canvas.width, height: canvas.height };
      renderAnnotations(currentPage, viewport);
    }
  }, [annotations, currentPage, renderAnnotations, pdfDoc, pageRendering, isDragging, renderInProgress]);
  
  // Update content blocks when annotations/textItems change
  // Only update when NOT dragging to prevent re-render spam
  useEffect(() => {
    if (!pdfDoc || pageRendering || isDragging || renderInProgress) return;  // Don't update while page is rendering, dragging, or render in progress
    
    const newContentBlocks = calculateContentBlocks();
    if (!newContentBlocks) return;
    
    // Only update if content blocks actually changed
    let contentChanged = false;
    if (contentBlocks.size !== newContentBlocks.size) {
      contentChanged = true;
    } else {
      for (const [pageNum, blocks] of newContentBlocks) {
        const existingBlocks = contentBlocks.get(pageNum);
        if (!existingBlocks || existingBlocks.length !== blocks.length) {
          contentChanged = true;
          break;
        }
        
        for (let i = 0; i < blocks.length; i++) {
          const newBlock = blocks[i];
          const existingBlock = existingBlocks[i];
          if (
            newBlock.x !== existingBlock.x ||
            newBlock.y !== existingBlock.y ||
            newBlock.width !== existingBlock.width ||
            newBlock.height !== existingBlock.height ||
            newBlock.type !== existingBlock.type ||
            newBlock.id !== existingBlock.id
          ) {
            contentChanged = true;
            break;
          }
        }
        if (contentChanged) break;
      }
    }
    
    if (contentChanged) {
      setContentBlocks(newContentBlocks);
    }
  }, [calculateContentBlocks, contentBlocks, pdfDoc, pageRendering, isDragging, renderInProgress]);
  
  // Special content blocks update during drag operations
  // Updates only the specific dragged block to prevent ghost outlines
  useEffect(() => {
    if (!pdfDoc || pageRendering || !isDragging || !draggedBlock || renderInProgress) return;
    
    // During drag, update only the specific dragged content block
    const newContentBlocks = new Map(contentBlocks);
    const currentPageBlocks = newContentBlocks.get(currentPage) || [];
    
    // Find the dragged block in content blocks
    const blockIndex = currentPageBlocks.findIndex(block => block.id === draggedBlock.id);
    if (blockIndex !== -1) {
      // Get the current annotation position for the dragged block
      const currentAnnotation = annotations.find(a => a.id === draggedBlock.id);
      if (currentAnnotation) {
        // Update the content block with current annotation position
        const updatedBlock = {
          ...currentPageBlocks[blockIndex],
          x: currentAnnotation.x,
          y: currentAnnotation.y
        };
        
        // Create new array with updated block
        const updatedPageBlocks = [...currentPageBlocks];
        updatedPageBlocks[blockIndex] = updatedBlock;
        newContentBlocks.set(currentPage, updatedPageBlocks);
        
        setContentBlocks(newContentBlocks);
      }
    }
  }, [annotations, draggedBlock, currentPage, contentBlocks, pdfDoc, pageRendering, isDragging, renderInProgress]);
  
  // Update editing text position when zoom changes
  useEffect(() => {
    if (editingText && zoom) {
      // When zoom changes, we need to potentially update the editor position
      // but we shouldn't interrupt active editing
      // Just make sure the editor stays visible
    }
  }, [zoom, editingText]);

  // Render thumbnails
  const renderThumbnail = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!pdfDoc) return;
    
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
      
      // Store the task temporarily
      thumbnailTasksRef.current.set(pageNum, renderTask);
      
      await renderTask.promise;
      
      // Remove the task after completion
      thumbnailTasksRef.current.delete(pageNum);
    } catch (err: any) {
      // Remove the task if there's an error
      thumbnailTasksRef.current.delete(pageNum);
      
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

  // Mouse handlers for annotations and interactions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || pageRendering || renderInProgress) return; // Don't process if page is rendering or render in progress
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    if (activeTool === "highlight") {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentHighlight({ x, y, width: 0, height: 0 });
    } else if (activeTool === "pan") {
      // Start panning
      setIsDragging(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (activeTool === "select") {
      // Check if clicking on a content block for dragging
      const currentPageBlocks = contentBlocks.get(currentPage) || [];
      
      for (const block of currentPageBlocks) {
        if (x >= block.x && x <= block.x + block.width &&
            y >= block.y && y <= block.y + block.height) {
          
          // Allow dragging both annotation and text blocks
          const offsetX = x - block.x;
          const offsetY = y - block.y;
          
          setDraggedBlock({
            id: block.id,
            type: block.type,
            originalX: block.x,
            originalY: block.y,
            offsetX,
            offsetY
          });
          setIsDragging(true);
          e.preventDefault();
          break;
        }
      }
    }
  };

  // Ref to store last drag update timestamp to prevent excessive updates
  const lastDragUpdateRef = useRef<number>(0);
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || pageRendering || renderInProgress) return; // Don't process if page is rendering or render in progress
    
    const rect = canvas.getBoundingClientRect();
    
    if (isDrawing && activeTool === "highlight" && drawStart) {
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      setCurrentHighlight({
        x: Math.min(drawStart.x, x),
        y: Math.min(drawStart.y, y),
        width: Math.abs(x - drawStart.x),
        height: Math.abs(y - drawStart.y),
      });
    } else if (isDragging && activeTool === "pan" && panStart && viewerContainerRef.current) {
      // Handle panning
      const deltaX = (e.clientX - panStart.x) / zoom;
      const deltaY = (e.clientY - panStart.y) / zoom;
      
      setViewportOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (isDragging && draggedBlock && activeTool === "select") {
      // Throttle drag updates to prevent excessive state changes
      const now = Date.now();
      if (now - lastDragUpdateRef.current < 16) { // ~60fps max
        return;
      }
      lastDragUpdateRef.current = now;
      
      // Handle content block dragging
      const x = (e.clientX - rect.left) / zoom - draggedBlock.offsetX;
      const y = (e.clientY - rect.top) / zoom - draggedBlock.offsetY;
      
      if (draggedBlock.type === 'annotation') {
        // Update annotation position - batch update to prevent re-renders
        setAnnotations(prev => {
          const updated = [...prev];
          const index = updated.findIndex(ann => ann.id === draggedBlock.id);
          if (index !== -1) {
            updated[index] = { ...updated[index], x, y };
          }
          return updated;
        });
      } else if (draggedBlock.type === 'text') {
        // For text items, create or update a textEdit annotation to reposition the text
        // Find the text item based on the block ID
        const textItemMatch = draggedBlock.id.match(/text-(\d+)-(\d+)/);
        if (textItemMatch) {
          const pageIdx = parseInt(textItemMatch[1], 10);
          const itemIdx = parseInt(textItemMatch[2], 10);
          const textItemsOnPage = textItems.get(pageIdx) || [];
          const textItem = textItemsOnPage[itemIdx];
          
          if (textItem) {
            // Create or update a textEdit annotation to reposition the text
            // First, check if we already have a textEdit annotation for this drag operation
            const dragAnnotationId = `drag_${draggedBlock.id}`;
            
            const newAnnotation: Annotation = {
              id: dragAnnotationId, // Use a consistent ID for this drag operation
              type: 'textEdit',
              pageIndex: currentPage - 1,
              x,
              y,
              width: textItem.width,
              height: textItem.height,
              content: textItem.str,
              originalText: textItem.str,
              fontSize: textItem.fontSize,
              color: '#000000'
            };
            
            // Batch update to prevent re-renders
            setAnnotations(prev => {
              const index = prev.findIndex(a => a.id === dragAnnotationId);
              if (index !== -1) {
                // Update existing annotation
                const updated = [...prev];
                updated[index] = newAnnotation;
                return updated;
              } else {
                // Add new annotation
                return [...prev, newAnnotation];
              }
            });
          }
        }
      } else if (draggedBlock.type === 'image') {
        // For future image dragging functionality
        // Currently not implemented, but placeholder for consistency
      }
      
      e.preventDefault();
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && activeTool === "highlight" && currentHighlight) {
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
    }
    
    // Finalize text dragging if applicable
    if (isDragging && draggedBlock && draggedBlock.type === 'text') {
      // Convert the temporary drag annotation to a permanent one
      const dragAnnotationId = `drag_${draggedBlock.id}`;
      const tempAnnotation = annotations.find(a => a.id === dragAnnotationId);
      
      if (tempAnnotation) {
        // Create a permanent annotation with a unique ID
        const permanentAnnotation: Annotation = {
          ...tempAnnotation,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, // New unique ID
        };
        
        // Remove the temporary annotation and add the permanent one
        setAnnotations(prev => {
          const filtered = prev.filter(a => a.id !== dragAnnotationId);
          return [...filtered, permanentAnnotation];
        });
      }
    }
    
    // Reset all drag/drawing states
    setIsDrawing(false);
    setIsDragging(false);
    setDraggedBlock(null);
    setDrawStart(null);
    setCurrentHighlight(null);
    setPanStart(null);
    
    // Reset drag update throttle
    lastDragUpdateRef.current = 0;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (pageRendering || renderInProgress) return; // Don't process if page is rendering or render in progress
    
    // Reset drag update throttle on click
    lastDragUpdateRef.current = 0;
    
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
    } else if (activeTool === "edit") {
      // Handle text editing in edit mode
      const canvas = annotationCanvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      // Check if click is on existing text that can be edited
      const currentPageTextItems = textItems.get(currentPage) || [];
      
      for (let i = 0; i < currentPageTextItems.length; i++) {
        const item = currentPageTextItems[i];
        // Check if click is within the bounds of the text item
        // Use a slightly larger hit area for better UX
        const hitMargin = 5; // pixels
        if (x >= item.x - hitMargin && x <= item.x + item.width + hitMargin && 
            y >= item.y - hitMargin && y <= item.y + item.height + hitMargin) {
          
          // Check if this text has already been edited
          const existingTextEdit = annotations.find(
            a => a.type === "textEdit" && 
                 a.pageIndex === currentPage - 1 && 
                 a.originalText === item.str &&
                 Math.abs(a.x - item.x) < 5 &&
                 Math.abs(a.y - item.y) < 5
          );
          
          setEditingText({
            pageIndex: currentPage - 1,
            itemIndex: i,
            text: existingTextEdit?.content || item.str,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            fontSize: item.fontSize,
            originalText: item.str,
          });
          return; // Exit early to prevent other actions
        }
      }
    } else if (activeTool === "signature") {
      setShowSignatureCapture(true);
    }
  };

  // Signature handler
  const handleSignatureSave = (imageData: string) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) {
      setShowSignatureCapture(false);
      setActiveTool("select");
      return;
    }
    
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
                title="Select & Move - Drag both text and annotation blocks to reposition them"
              >
                <MousePointer className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setActiveTool("pan")}
                className={`p-1.5 rounded ${activeTool === "pan" ? "bg-blue-600" : "hover:bg-gray-600"}`}
                title="Pan - Click and drag to move the entire document view"
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
              onClick={() => setShowContentOutlines(!showContentOutlines)}
              className={`p-2 rounded-lg ${showContentOutlines ? "bg-blue-600" : "hover:bg-gray-700"}`}
              title={showContentOutlines ? "Hide Content Outlines" : "Show Content Outlines"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </button>
            
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
            ref={viewerContainerRef}
            className="flex-1 overflow-auto bg-gray-600 flex items-start justify-center p-8"
            style={{
              cursor: activeTool === "pan" ? "grab" : "default",
              transform: `translate(${viewportOffset.x * zoom}px, ${viewportOffset.y * zoom}px)`
            }}
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
                  style={{ display: "block", zIndex: 1 }}
                />
                
                {/* Annotation Overlay Canvas */}
                <canvas
                  ref={annotationCanvasRef}
                  className="absolute top-0 left-0"
                  style={{
                    cursor: isDragging ? "grabbing" :
                            activeTool === "highlight" ? "crosshair" :
                            activeTool === "text" ? "text" :
                            activeTool === "signature" ? "pointer" :
                            activeTool === "edit" ? "text" :
                            activeTool === "pan" ? "grab" : "default",
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={() => {
                    setIsDrawing(false);
                    setIsDragging(false);
                    setDraggedBlock(null);
                    setDrawStart(null);
                    setCurrentHighlight(null);
                    setPanStart(null);
                                       
                    // Reset drag update throttle
                    lastDragUpdateRef.current = 0;
                                       
                    // Clean up any temporary drag annotations
                    setAnnotations(prev => prev.filter(a => !a.id.startsWith('drag_')));
                  }}
                  onClick={handleCanvasClick}
                />

                {/* Content Outlines Layer */}
                {showContentOutlines && contentBlocks.get(currentPage) && (
                  <div className="absolute top-0 left-0 w-full h-full" style={{ zIndex: 4 }}>
                    {contentBlocks.get(currentPage)!.map((block, idx) => (
                      <div
                        key={`${block.id}-${idx}`}
                        className={`absolute border border-dashed transition-all duration-150 ${
                          activeTool === 'select' 
                            ? 'hover:border-solid hover:cursor-move hover:shadow-md hover:scale-[1.02]' 
                            : ''
                        } ${isDragging && draggedBlock?.id === block.id ? 'opacity-100 border-solid shadow-lg' : ''}`}
                        style={{
                          left: block.x * zoom,
                          top: block.y * zoom,
                          width: block.width * zoom,
                          height: block.height * zoom,
                          borderColor: block.type === 'text' ? '#4ade80' : 
                                     block.type === 'annotation' ? '#60a5fa' : '#f87171',
                          borderWidth: '1px',
                          opacity: isDragging && draggedBlock?.id === block.id ? 1 : 0.7,
                          pointerEvents: activeTool === 'select' ? 'auto' : 'none',
                          transform: isDragging && draggedBlock?.id === block.id ? 'scale(1.05)' : 'none',
                          transition: 'all 0.1s ease-out',
                        }}
                        title={`${block.type.charAt(0).toUpperCase() + block.type.slice(1)} block${activeTool === 'select' ? ' - Click and drag to move' : ''}`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Text Layer - Shows editable text overlay */}
                {textItems.get(currentPage) && (
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
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
                      zIndex: 1000,
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
            <span>Tool: {activeTool === "select" ? "Select & Move" : activeTool === "pan" ? "Pan View" : activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <span>Outlines: {showContentOutlines ? 'ON' : 'OFF'}</span>
            {activeTool === "select" && <span className="text-blue-400">Click and drag green (text) or blue (annotation) outlined blocks to move them</span>}
            {activeTool === "pan" && <span className="text-blue-400">Click and drag anywhere to pan the document view</span>}
            {activeTool === "edit" && <span className="text-blue-400">Click on text to edit • Enter to confirm • Esc to cancel</span>}
            {activeTool === "highlight" && <span className="text-blue-400">Click and drag to create highlight annotations</span>}
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

