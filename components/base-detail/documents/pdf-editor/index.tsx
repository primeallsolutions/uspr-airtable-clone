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

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Loader2, PenTool, Share2, Edit3 } from "lucide-react";

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
import { SignerPanel, type Signer } from "./components/SignerPanel";
import { SignatureCapture } from "../SignatureCapture";
import { PostActionPrompt, type ActionSuggestion } from "../PostActionPrompt";

// Text box editor for adding new text annotations
function TextBoxEditor({
  position,
  zoom,
  onSave,
  onCancel,
}: {
  position: Point;
  zoom: number;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to save (allows regular Enter for new lines)
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (text.trim()) {
        onSave(text.trim());
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
    // Backspace and Delete work naturally in textarea - no special handling needed
  };

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
      className="flex flex-col gap-1"
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type text here..."
        className="bg-white text-black outline-none border-2 border-green-500 rounded-sm shadow-lg resize-none"
        style={{
          fontSize: 14 * zoom,
          lineHeight: 1.4,
          padding: "6px 10px",
          minWidth: 220,
          minHeight: 60,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
        rows={3}
      />
      <div className="flex gap-1 justify-end">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim()}
          className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Text
        </button>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">
        Press Ctrl+Enter to save, Escape to cancel
      </div>
    </div>
  );
}

export function PdfEditor({
  document: docInfo,
  signedUrl,
  isOpen,
  onClose,
  onSave,
  onRequestSignature,
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
  
  // Post-save prompt state
  const [showPostSavePrompt, setShowPostSavePrompt] = useState(false);
  const [savedDocumentName, setSavedDocumentName] = useState<string | null>(null);

  // Signer panel state
  const [showSignerPanel, setShowSignerPanel] = useState(false);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [fieldAssignments, setFieldAssignments] = useState<Record<string, string>>({});
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Text editing state
  const [editingText, setEditingText] = useState<{
    item: TextItem;
    index: number;
  } | null>(null);

  // Text box creation state
  const [textBoxPosition, setTextBoxPosition] = useState<{ pdf: Point; screen: Point } | null>(null);

  // Container ref for pan scrolling
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Annotation store
  const {
    annotations,
    addTextBox,
    addSignature,
    addSignatureField,
    getSignatureFields,
    clearAnnotations,
    hasChanges,
    selectedAnnotationId,
    selectAnnotation,
    removeSelectedAnnotation,
    undo,
    redo,
    canUndo,
    canRedo,
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
      setTextBoxPosition(null);
      clearAnnotations();
      reset();
    }
  }, [isOpen, clearAnnotations, reset]);

  // Comprehensive keyboard shortcuts handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // === Save Shortcut (Ctrl/Cmd + S) ===
      if (isMod && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !isSaving && onSave) {
          // Trigger save - need to call handleSave
          setIsSaving(true);
          // Note: The actual save is handled by the toolbar button
        }
        return;
      }

      // === Undo: Ctrl+Z (or Cmd+Z on Mac) ===
      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
        return;
      }

      // === Redo: Ctrl+Shift+Z or Ctrl+Y (or Cmd+Shift+Z on Mac) ===
      if (isMod && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
        return;
      }

      // === Page Navigation ===
      // Page Up / Down
      if (e.key === "PageUp" || (isMod && e.key === "ArrowUp")) {
        e.preventDefault();
        if (currentPage > 1) {
          setCurrentPage(p => p - 1);
        }
        return;
      }
      if (e.key === "PageDown" || (isMod && e.key === "ArrowDown")) {
        e.preventDefault();
        if (currentPage < numPages) {
          setCurrentPage(p => p + 1);
        }
        return;
      }

      // Home/End for first/last page
      if (e.key === "Home" && isMod) {
        e.preventDefault();
        setCurrentPage(1);
        return;
      }
      if (e.key === "End" && isMod) {
        e.preventDefault();
        setCurrentPage(numPages);
        return;
      }

      // === Zoom Shortcuts ===
      // Ctrl/Cmd + Plus for zoom in
      if (isMod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setZoomIndex(i => Math.min(i + 1, ZOOM_LEVELS.length - 1));
        return;
      }
      // Ctrl/Cmd + Minus for zoom out
      if (isMod && e.key === "-") {
        e.preventDefault();
        setZoomIndex(i => Math.max(i - 1, 0));
        return;
      }
      // Ctrl/Cmd + 0 for reset zoom
      if (isMod && e.key === "0") {
        e.preventDefault();
        setZoomIndex(DEFAULT_ZOOM_INDEX);
        return;
      }

      // === Tool Shortcuts (when not holding modifier) ===
      if (!isMod && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "v": // Select tool
            e.preventDefault();
            setActiveTool("select");
            break;
          case "t": // Text tool
            e.preventDefault();
            setActiveTool("text");
            break;
          case "h": // Highlight tool
            e.preventDefault();
            setActiveTool("highlight");
            break;
          case "e": // Edit tool
            e.preventDefault();
            setActiveTool("edit");
            break;
          case "s": // Signature (when not saving)
            e.preventDefault();
            setActiveTool("signature");
            setShowSignatureCapture(true);
            break;
          case "f": // Signature Field
            e.preventDefault();
            setActiveTool("signatureField");
            break;
          case "i": // Initials Field
            e.preventDefault();
            setActiveTool("initialsField");
            break;
          case "d": // Date Field
            e.preventDefault();
            setActiveTool("dateField");
            break;
          case "p": // Pan tool
            e.preventDefault();
            setActiveTool("pan");
            break;
        }
      }

      // === Delete selected annotation with Delete or Backspace ===
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        e.preventDefault();
        removeSelectedAnnotation();
        return;
      }

      // === Escape to deselect or cancel ===
      if (e.key === "Escape") {
        e.preventDefault();
        if (textBoxPosition) {
          setTextBoxPosition(null);
        } else if (selectedAnnotationId) {
          selectAnnotation(null);
        } else if (activeTool !== "select") {
          setActiveTool("select");
        }
        return;
      }

      // === Tab to cycle through signature fields ===
      if (e.key === "Tab") {
        const signatureFields = getSignatureFields();
        if (signatureFields.length > 0) {
          e.preventDefault();
          const currentIdx = selectedAnnotationId
            ? signatureFields.findIndex(f => f.id === selectedAnnotationId)
            : -1;
          const nextIdx = e.shiftKey
            ? (currentIdx <= 0 ? signatureFields.length - 1 : currentIdx - 1)
            : ((currentIdx + 1) % signatureFields.length);
          selectAnnotation(signatureFields[nextIdx].id);
          // Navigate to the page containing this field if needed
          const field = signatureFields[nextIdx];
          if (field.pageIndex + 1 !== currentPage) {
            setCurrentPage(field.pageIndex + 1);
          }
        }
        return;
      }

      // === Arrow keys for fine-tuning position (when annotation selected) ===
      if (selectedAnnotationId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        // This could be implemented with moveAnnotation if needed
        // For now, just prevent default to avoid scrolling
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen, 
    selectedAnnotationId, 
    removeSelectedAnnotation, 
    selectAnnotation, 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    currentPage, 
    numPages, 
    hasChanges, 
    isSaving, 
    onSave, 
    activeTool, 
    textBoxPosition,
    getSignatureFields,
  ]);

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
        setTextBoxPosition(null);
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
    setTextBoxPosition(null);

    if (tool === "signature") {
      setShowSignatureCapture(true);
    }
  }, []);

  const handleTextClick = useCallback((item: TextItem, index: number) => {
    setEditingText({ item, index });
  }, []);

  const handleCanvasClick = useCallback(
    (pdfPoint: Point, screenPoint: Point) => {
      if (activeTool === "text") {
        // Show inline text editor instead of prompt
        setTextBoxPosition({ pdf: pdfPoint, screen: screenPoint });
      } else if (activeTool === "signatureField") {
        // Add signature field marker at clicked position
        addSignatureField(currentPage - 1, pdfPoint, "signature", "Signature", true);
      } else if (activeTool === "initialsField") {
        // Add initials field marker at clicked position
        addSignatureField(currentPage - 1, pdfPoint, "initial", "Initials", true);
      } else if (activeTool === "dateField") {
        // Add auto date-signed field at clicked position
        addSignatureField(currentPage - 1, pdfPoint, "date", "Date Signed", true);
      }
    },
    [activeTool, currentPage, addSignatureField]
  );

  const handleTextBoxSave = useCallback(
    (text: string) => {
      if (textBoxPosition) {
        addTextBox(currentPage - 1, textBoxPosition.pdf, text);
        setTextBoxPosition(null);
      }
    },
    [textBoxPosition, currentPage, addTextBox]
  );

  const handleTextBoxCancel = useCallback(() => {
    setTextBoxPosition(null);
  }, []);

  // Pan handlers
  const handlePanMove = useCallback((deltaX: number, deltaY: number) => {
    if (viewerContainerRef.current) {
      viewerContainerRef.current.scrollLeft -= deltaX;
      viewerContainerRef.current.scrollTop -= deltaY;
    }
  }, []);

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

      // Show post-save prompt instead of closing immediately
      setSavedDocumentName(documentName);
      setShowPostSavePrompt(true);
    } catch (err) {
      console.error("Failed to save PDF:", err);
      alert("Failed to save document. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [bytes, docInfo, annotations, documentName, onSave]);

  const handleClose = useCallback(() => {
    if (hasChanges()) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  const handleRequestSignature = useCallback(() => {
    const signatureFields = getSignatureFields();
    if (onRequestSignature) {
      onRequestSignature(signatureFields);
    }
  }, [getSignatureFields, onRequestSignature]);

  // Handle field assignment changes from signer panel
  const handleFieldAssignmentChange = useCallback((fieldId: string, signerId: string) => {
    setFieldAssignments(prev => ({
      ...prev,
      [fieldId]: signerId,
    }));
  }, []);

  // Handle sending signature request directly from the panel
  const handleSendSignatureRequest = useCallback(async () => {
    const signatureFields = getSignatureFields();
    if (signatureFields.length === 0) return;
    
    // If parent has onRequestSignature, use that (for backward compatibility)
    // Otherwise show the signer panel to collect signers
    if (signers.length === 0) {
      setShowSignerPanel(true);
      return;
    }

    // Validate signers
    const validSigners = signers.filter(s => s.email.trim() && s.email.includes('@'));
    if (validSigners.length === 0) {
      setShowSignerPanel(true);
      return;
    }

    // If onRequestSignature is provided, call it with the collected data
    if (onRequestSignature) {
      setIsSendingRequest(true);
      try {
        // Pass the signature fields with signer assignments
        const fieldsWithAssignments = signatureFields.map(field => ({
          ...field,
          assignedTo: fieldAssignments[field.id] || undefined,
        }));
        onRequestSignature(fieldsWithAssignments);
      } finally {
        setIsSendingRequest(false);
      }
    }
  }, [getSignatureFields, signers, fieldAssignments, onRequestSignature]);

  // Handle post-save prompt close
  const handlePostSaveClose = useCallback(() => {
    setShowPostSavePrompt(false);
    setSavedDocumentName(null);
    onClose();
  }, [onClose]);

  // Build post-save suggestions
  const postSaveSuggestions = useCallback((): ActionSuggestion[] => {
    const suggestions: ActionSuggestion[] = [];
    
    if (onRequestSignature) {
      suggestions.push({
        id: "request-signature",
        label: "Request Signature",
        description: "Send this document for e-signature",
        icon: <PenTool className="w-4 h-4 text-purple-600" />,
        variant: "primary",
        onClick: () => {
          setShowPostSavePrompt(false);
          handleRequestSignature();
        },
      });
    }
    
    suggestions.push({
      id: "continue-editing",
      label: "Continue Editing",
      description: "Make more changes to this document",
      icon: <Edit3 className="w-4 h-4 text-blue-600" />,
      variant: "secondary",
      onClick: () => {
        setShowPostSavePrompt(false);
        setSavedDocumentName(null);
        // Stay in the editor, clear annotations since they've been saved
        clearAnnotations();
      },
    });
    
    return suggestions;
  }, [onRequestSignature, handleRequestSignature, clearAnnotations]);

  // Don't render if not open
  if (!isOpen || !docInfo) return null;

  // Count annotation types for status bar
  const annotationCount = annotations.filter(
    (a) => a.type !== "textEdit"
  ).length;
  const textEditCount = annotations.filter((a) => a.type === "textEdit").length;

  // Count signature field types for status bar
  const signatureFieldCounts = useMemo(() => {
    const fields = getSignatureFields();
    return {
      signature: fields.filter(f => f.fieldType === "signature").length,
      initial: fields.filter(f => f.fieldType === "initial").length,
      date: fields.filter(f => f.fieldType === "date").length,
    };
  }, [annotations, getSignatureFields]);

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
          canUndo={canUndo()}
          canRedo={canRedo()}
          hasSignatureFields={getSignatureFields().length > 0}
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
          onUndo={undo}
          onRedo={redo}
          onRequestSignature={onRequestSignature ? handleRequestSignature : undefined}
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
          <div 
            ref={viewerContainerRef}
            className="flex-1 overflow-auto bg-gray-600 flex items-start justify-center p-8 relative"
            style={{ cursor: activeTool === "pan" ? "grab" : undefined }}
          >
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
                  onPanMove={handlePanMove}
                />

                {/* Text Edit Overlay for editing existing text */}
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

                {/* Text Box Editor for adding new text */}
                {textBoxPosition && (
                  <TextBoxEditor
                    position={textBoxPosition.screen}
                    zoom={zoom}
                    onSave={handleTextBoxSave}
                    onCancel={handleTextBoxCancel}
                  />
                )}
              </div>
            )}
          </div>

          {/* Signer Panel - Integrated signature request management */}
          <SignerPanel
            isOpen={showSignerPanel}
            onToggle={() => setShowSignerPanel(!showSignerPanel)}
            signatureFields={getSignatureFields()}
            signers={signers}
            onSignersChange={setSigners}
            fieldAssignments={fieldAssignments}
            onFieldAssignmentChange={handleFieldAssignmentChange}
            onSendRequest={handleSendSignatureRequest}
            isSending={isSendingRequest}
            documentName={documentName}
          />
        </div>

        {/* Status Bar */}
        <StatusBar
          activeTool={activeTool}
          zoomIndex={zoomIndex}
          annotationCount={annotationCount}
          textEditCount={textEditCount}
          fieldCounts={signatureFieldCounts}
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

      {/* Post-Save Prompt */}
      <PostActionPrompt
        type="document-saved"
        documentName={savedDocumentName || undefined}
        isOpen={showPostSavePrompt}
        onClose={handlePostSaveClose}
        suggestions={postSaveSuggestions()}
      />
    </div>
  );
}

// Export as default for backwards compatibility
export default PdfEditor;

// Re-export types
export type { PdfEditorProps };
