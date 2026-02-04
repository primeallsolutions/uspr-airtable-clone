/**
 * PDF Thumbnails Sidebar
 * Shows thumbnail previews of all pages for navigation
 */

"use client";

import React, { useRef, useEffect, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface ThumbnailsProps {
  document: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

export function Thumbnails({
  document,
  numPages,
  currentPage,
  onPageSelect,
}: ThumbnailsProps) {
  return (
    <div className="w-32 bg-gray-800 border-r border-gray-700 overflow-y-auto flex-shrink-0">
      <div className="p-2 space-y-2">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <ThumbnailItem
            key={pageNum}
            document={document}
            pageNumber={pageNum}
            isActive={currentPage === pageNum}
            onClick={() => onPageSelect(pageNum)}
          />
        ))}
      </div>
    </div>
  );
}

interface ThumbnailItemProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}

function ThumbnailItem({
  document,
  pageNumber,
  isActive,
  onClick,
}: ThumbnailItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const isRenderedRef = useRef(false);
  const renderGenerationRef = useRef(0);

  const cancelRender = useCallback(async () => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        await renderTaskRef.current.promise.catch(() => {
          // Ignore cancellation errors
        });
      } catch {
        // Ignore
      }
      renderTaskRef.current = null;
    }
  }, []);

  const renderThumbnail = useCallback(async () => {
    if (!canvasRef.current || isRenderedRef.current) return;

    const currentGeneration = ++renderGenerationRef.current;

    // Cancel any existing render and wait for completion
    await cancelRender();

    // Check if a newer render was requested
    if (currentGeneration !== renderGenerationRef.current) return;

    try {
      const page = await document.getPage(pageNumber);
      
      // Check if still valid
      if (currentGeneration !== renderGenerationRef.current) return;
      
      const viewport = page.getViewport({ scale: 0.2 });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Check again if still valid
      if (currentGeneration !== renderGenerationRef.current) return;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
      
      if (currentGeneration === renderGenerationRef.current) {
        isRenderedRef.current = true;
      }
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render thumbnail:", err);
      }
    }
  }, [document, pageNumber, cancelRender]);

  useEffect(() => {
    renderThumbnail();
    const generationAtMount = renderGenerationRef.current;

    return () => {
      renderGenerationRef.current = generationAtMount + 1;
      cancelRender();
    };
  }, [renderThumbnail, cancelRender]);

  return (
    <button
      onClick={onClick}
      className={`w-full p-1 rounded-lg transition-colors ${
        isActive
          ? "bg-blue-600 ring-2 ring-blue-400"
          : "hover:bg-gray-700"
      }`}
    >
      <canvas ref={canvasRef} className="w-full bg-white rounded" />
      <span className="text-xs text-gray-400 mt-1 block">{pageNumber}</span>
    </button>
  );
}
