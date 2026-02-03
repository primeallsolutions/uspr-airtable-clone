/**
 * PDF Editor
 * A complete PDF viewing and editing solution
 * 
 * Features:
 * - View PDFs with zoom, rotation, and page navigation
 * - Edit existing text in PDFs
 * - Add highlights, text annotations, and signatures
 * - Save changes with version history preservation
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";

import type { PdfEditorProps, Tool, TextItem, Point } from "./types";
import { ZOOM_LEVELS, DEFAULT_ZOOM_INDEX } from "./types";
import { usePdfLoader } from "./hooks/usePdfLoader";
import { useAnnotationStore } from "./hooks/useAnnotationStore";
import { savePdfWithAnnotations, downloadPdf } from "./utils/pdf-save";

import { Toolbar } from "./components/Toolbar";
import { Thumbnails } from "./components/Thumbnails";
import { PageCanvas } from "./components/PageCanvas";
import { TextEditOverlay } from "./components/TextEditOverlay";
import { StatusBar } from "./components/StatusBar";
import { SignatureCapture } from "../SignatureCapture";

export function PdfEditor({
  document: docInfo,
  signedUrl,
  isOpen,
  onClose,
  onSave,
}: PdfEditorProps) {
  // PDF loading state
  const { status, document, bytes, numPages, error, reset } = usePdfLoader(
    isOpen ? signedUrl : null
  );

  // View state
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);

  // Text editing state
  const [editingText, setEditingText] = useState<{
    item: TextItem;
    index: number;
  } | null>(null);

  // Annotation store
  const {
    annotations,
    addTextBox,
    addSignature,
    clearAnnotations,
    hasChanges,
  } = useAnnotationStore();

  const zoom = ZOOM_LEVELS[zoomIndex];

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(1);
      setZoomIndex(DEFAULT_ZOOM_INDEX);
      setRotation(0);
      setActiveTool("select");
      setEditingText(null);
      clearAnnotations();
      reset();
    }
  }, [isOpen, clearAnnotations, reset]);

  // Reset page when document changes
  useEffect(() => {
    if (document) {
      setCurrentPage(1);
    }
  }, [document]);

  // Get document filename
  const documentName = docInfo?.path.split("/").pop() || "document.pdf";

  // Page height for coordinate conversion (approximation before render)
  const pageHeight = 792; // Standard letter size, will be refined by PageCanvas

  // Handlers
  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= numPages) {
        setCurrentPage(page);
        setEditingText(null);
      }
    },
    [numPages]
  );

  const handleZoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  const handleToolChange = useCallback((tool: Tool) => {
    setActiveTool(tool);
    setEditingText(null);

    if (tool === "signature") {
      setShowSignatureCapture(true);
    }
  }, []);

  const handleTextClick = useCallback((item: TextItem, index: number) => {
    setEditingText({ item, index });
  }, []);

  const handleCanvasClick = useCallback(
    (pdfPoint: Point) => {
      if (activeTool === "text") {
        const text = window.prompt("Enter text annotation:");
        if (text) {
          addTextBox(currentPage - 1, pdfPoint, text);
        }
      }
    },
    [activeTool, currentPage, addTextBox]
  );

  const handleSignatureSave = useCallback(
    (imageData: string) => {
      // Place signature in center of current view
      addSignature(
        currentPage - 1,
        { x: 200, y: pageHeight / 2 },
        imageData
      );
      setShowSignatureCapture(false);
      setActiveTool("select");
    },
    [currentPage, pageHeight, addSignature]
  );

  const handleDownload = useCallback(() => {
    if (bytes) {
      downloadPdf(bytes, documentName);
    }
  }, [bytes, documentName]);

  const handleSave = useCallback(async () => {
    if (!bytes || !docInfo || annotations.length === 0) return;

    setIsSaving(true);

    try {
      // Apply annotations to PDF
      const blob = await savePdfWithAnnotations(bytes, annotations);

      // Create file for upload
      const file = new File([blob], documentName, { type: "application/pdf" });

      // Call parent save handler
      await onSave(file);

      // Close editor on success
      onClose();
    } catch (err) {
      console.error("Failed to save PDF:", err);
      alert("Failed to save document. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [bytes, docInfo, annotations, documentName, onSave, onClose]);

  const handleClose = useCallback(() => {
    if (hasChanges()) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  // Don't render if not open
  if (!isOpen || !docInfo) return null;

  // Count annotation types for status bar
  const annotationCount = annotations.filter(
    (a) => a.type !== "textEdit"
  ).length;
  const textEditCount = annotations.filter((a) => a.type === "textEdit").length;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 flex flex-col ${
        isFullscreen ? "" : "p-4"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-gray-900 flex flex-col overflow-hidden ${
          isFullscreen
            ? "w-full h-full"
            : "rounded-xl max-w-7xl max-h-[95vh] mx-auto w-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <Toolbar
          documentName={documentName}
          currentPage={currentPage}
          numPages={numPages || 1}
          zoomIndex={zoomIndex}
          activeTool={activeTool}
          isFullscreen={isFullscreen}
          isSaving={isSaving}
          hasChanges={hasChanges()}
          onPageChange={handlePageChange}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onRotate={handleRotate}
          onToolChange={handleToolChange}
          onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
          onDownload={handleDownload}
          onSave={handleSave}
          onClose={handleClose}
        />

        {/* Main Content */}
        <div className="flex flex-1 min-h-0">
          {/* Thumbnails Sidebar */}
          {document && numPages > 0 && (
            <Thumbnails
              document={document}
              numPages={numPages}
              currentPage={currentPage}
              onPageSelect={handlePageChange}
            />
          )}

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto bg-gray-600 flex items-start justify-center p-8">
            {status === "loading" && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}

            {status === "error" && (
              <div className="text-red-400 text-center">
                <p>{error || "Failed to load PDF"}</p>
              </div>
            )}

            {status === "ready" && document && (
              <div className="relative">
                <PageCanvas
                  document={document}
                  pageNumber={currentPage}
                  zoom={zoom}
                  rotation={rotation}
                  activeTool={activeTool}
                  onTextClick={handleTextClick}
                  onCanvasClick={handleCanvasClick}
                />

                {/* Text Edit Overlay */}
                {editingText && (
                  <TextEditOverlay
                    textItem={editingText.item}
                    textIndex={editingText.index}
                    pageIndex={currentPage - 1}
                    pageHeight={pageHeight}
                    zoom={zoom}
                    onClose={() => setEditingText(null)}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          activeTool={activeTool}
          zoomIndex={zoomIndex}
          annotationCount={annotationCount}
          textEditCount={textEditCount}
        />
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
}

// Export as default for backwards compatibility
export default PdfEditor;

// Re-export types
export type { PdfEditorProps };
