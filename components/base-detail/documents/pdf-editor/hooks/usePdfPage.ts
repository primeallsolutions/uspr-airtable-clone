/**
 * usePdfPage Hook
 * Handles rendering a single PDF page to a canvas
 * Extracts text items for editing overlay
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { TextItem, PdfPageState } from "../types";
import { transformTextItem } from "../utils/coordinates";

const initialState: PdfPageState = {
  status: "idle",
  pageNumber: 0,
  viewport: null,
  textItems: [],
};

export function usePdfPage(
  document: PDFDocumentProxy | null,
  pageNumber: number,
  zoom: number,
  rotation: number,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const [state, setState] = useState<PdfPageState>(initialState);
  const renderTaskRef = useRef<any>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  // Use a render generation counter to invalidate stale renders
  const renderGenerationRef = useRef(0);

  const cancelRender = useCallback(async () => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        // Wait for the cancellation to complete
        await renderTaskRef.current.promise.catch(() => {
          // Ignore cancellation errors
        });
      } catch {
        // Ignore cancel errors
      }
      renderTaskRef.current = null;
    }
  }, []);

  const renderPage = useCallback(async () => {
    if (!document || !canvasRef.current || pageNumber < 1 || pageNumber > document.numPages) {
      return;
    }

    // Increment generation to invalidate any in-progress render
    const currentGeneration = ++renderGenerationRef.current;

    // Cancel any existing render and wait for it to complete
    await cancelRender();

    // Check if a newer render was requested while we were cancelling
    if (currentGeneration !== renderGenerationRef.current) {
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "rendering",
      pageNumber,
    }));

    try {
      // Get the page
      const page = await document.getPage(pageNumber);
      
      // Check if this render is still valid
      if (currentGeneration !== renderGenerationRef.current) {
        return;
      }
      
      pageRef.current = page;

      // Get viewport with zoom and rotation
      const viewport = page.getViewport({ scale: zoom, rotation });

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      // Set canvas dimensions (this also clears the canvas)
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Clear the canvas explicitly to ensure a fresh start
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Check again if this render is still valid
      if (currentGeneration !== renderGenerationRef.current) {
        return;
      }

      // Render the page
      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      // Clear the task ref after successful completion
      renderTaskRef.current = null;

      // Check if this render is still valid before updating state
      if (currentGeneration !== renderGenerationRef.current) {
        return;
      }

      // Extract text content for editing
      const textContent = await page.getTextContent();
      const pageHeight = viewport.height / zoom;
      
      const textItems: TextItem[] = [];
      for (const item of textContent.items) {
        if ("str" in item && item.str.trim()) {
          const transformed = transformTextItem(
            item.transform,
            item.str,
            item.width,
            pageHeight
          );
          
          textItems.push({
            str: item.str,
            x: transformed.x,
            y: transformed.y,
            width: transformed.width,
            height: transformed.height,
            fontSize: transformed.fontSize,
            fontName: (item as any).fontName || "Helvetica",
            transform: item.transform,
          });
        }
      }

      // Final check before updating state
      if (currentGeneration !== renderGenerationRef.current) {
        return;
      }

      setState({
        status: "ready",
        pageNumber,
        viewport: { width: viewport.width, height: viewport.height },
        textItems,
      });
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name === "RenderingCancelledException") {
        return;
      }

      // Only report error if this is still the current render
      if (currentGeneration === renderGenerationRef.current) {
        console.error("Failed to render page:", err);
        setState((prev) => ({
          ...prev,
          status: "error",
          textItems: [],
        }));
      }
    }
  }, [document, pageNumber, zoom, rotation, canvasRef, cancelRender]);

  // Render when dependencies change
  useEffect(() => {
    if (document && pageNumber > 0) {
      renderPage();
    }

    return () => {
      // Increment generation to invalidate in-progress renders
      renderGenerationRef.current++;
      cancelRender();
    };
  }, [document, pageNumber, zoom, rotation, renderPage, cancelRender]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      renderGenerationRef.current++;
      cancelRender();
      pageRef.current = null;
    };
  }, [cancelRender]);

  return {
    ...state,
    renderPage,
    cancelRender,
  };
}
