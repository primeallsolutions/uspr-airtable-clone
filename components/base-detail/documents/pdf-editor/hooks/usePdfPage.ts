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
  const isRenderingRef = useRef(false);

  const cancelRender = useCallback(() => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore cancel errors
      }
      renderTaskRef.current = null;
    }
    isRenderingRef.current = false;
  }, []);

  const renderPage = useCallback(async () => {
    if (!document || !canvasRef.current || pageNumber < 1 || pageNumber > document.numPages) {
      return;
    }

    // Prevent concurrent renders
    if (isRenderingRef.current) {
      return;
    }

    // Cancel any existing render
    cancelRender();
    isRenderingRef.current = true;

    setState((prev) => ({
      ...prev,
      status: "rendering",
      pageNumber,
    }));

    try {
      // Get the page
      const page = await document.getPage(pageNumber);
      pageRef.current = page;

      // Get viewport with zoom and rotation
      const viewport = page.getViewport({ scale: zoom, rotation });

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

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render the page
      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;

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

      setState({
        status: "ready",
        pageNumber,
        viewport: { width: viewport.width, height: viewport.height },
        textItems,
      });

      isRenderingRef.current = false;
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name === "RenderingCancelledException") {
        return;
      }

      console.error("Failed to render page:", err);
      setState((prev) => ({
        ...prev,
        status: "error",
        textItems: [],
      }));
      isRenderingRef.current = false;
    }
  }, [document, pageNumber, zoom, rotation, canvasRef, cancelRender]);

  // Render when dependencies change
  useEffect(() => {
    if (document && pageNumber > 0) {
      renderPage();
    }

    return () => {
      cancelRender();
    };
  }, [document, pageNumber, zoom, rotation, renderPage, cancelRender]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
