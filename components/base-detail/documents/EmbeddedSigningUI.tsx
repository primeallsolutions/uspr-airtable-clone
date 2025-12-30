"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, X, PenTool, Loader2, AlertCircle } from "lucide-react";
import { SignatureCapture } from "./SignatureCapture";
import { toast } from "sonner";

type SignerData = {
  id: string;
  email: string;
  name?: string;
  status: string;
};

type SignatureField = {
  id: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  field_type: "signature" | "initial" | "date" | "text";
  label?: string;
  is_required: boolean;
};

type EmbeddedSigningUIProps = {
  token: string;
  onComplete?: () => void;
  onDecline?: () => void;
};

export const EmbeddedSigningUI = ({
  token,
  onComplete,
  onDecline,
}: EmbeddedSigningUIProps) => {
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState<SignerData | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [showSignatureModal, setShowSignatureModal] = useState<{ fieldId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fieldBounds, setFieldBounds] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    loadSigningData();
  }, [token, loadSigningData]);

  const loadSigningData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/esignature/sign/${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load signing data");
      }

      const data = await response.json();
      setSigner(data.signer);
      setDocumentUrl(data.documentUrl);
      setFields(data.fields || []);
      
      // Check if already signed
      if (data.alreadySigned || data.signer?.status === "signed") {
        setAlreadySigned(true);
        // Redirect to success page
        window.location.href = `/sign/${token}/success`;
        return;
      }

      // Load PDF document - follow TemplateFieldEditor pattern exactly
      if (data.documentUrl) {
        const pdfjs = await import("pdfjs-dist");
        if (typeof window !== "undefined") {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const loadingTask = pdfjs.getDocument({ url: data.documentUrl });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
      }
    } catch (err: any) {
      console.error("Failed to load signing data:", err);
      setError(err.message || "Failed to load document");
      toast.error(err.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Update field bounds for overlay positioning
  const updateFieldBounds = useCallback((viewport: any) => {
    const pageFields = fields.filter((f) => f.page_number === currentPage);
    const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();

    pageFields.forEach((field) => {
      const scale = viewport.scale;
      const x = field.x_position * scale;
      const y = viewport.height - field.y_position * scale; // PDF Y is from bottom
      const width = (field.width || 150) * scale;
      const height = (field.height || 50) * scale;

      bounds.set(field.id, {
        x,
        y: y - height,
        width,
        height,
      });
    });

    setFieldBounds(bounds);
  }, [fields, currentPage]);

  // Draw field overlays and signatures on canvas - defined before renderPage
  const drawFieldOverlays = useCallback(async (
    context: CanvasRenderingContext2D,
    viewport: any
  ) => {
    const pageFields = fields.filter((f) => f.page_number === currentPage);
    
    // Track images that need to be loaded
    const imagesToLoad: Promise<void>[] = [];
    
    pageFields.forEach((field) => {
      const scale = viewport.scale;
      const x = field.x_position * scale;
      const y = viewport.height - field.y_position * scale; // PDF Y is from bottom
      const width = (field.width || 150) * scale;
      const height = (field.height || 50) * scale;

      // Draw signature if it exists
      if (fieldValues[field.id] && field.field_type === "signature") {
        const img = new Image();
        const loadPromise = new Promise<void>((resolve) => {
          img.onload = () => {
            // Draw signature image once loaded
            context.drawImage(img, x, y - height, width, height);
            resolve();
          };
          img.onerror = () => resolve(); // Resolve even on error to prevent hanging
        });
        img.src = fieldValues[field.id];
        imagesToLoad.push(loadPromise);
      } else {
        // Draw field border for unsigned fields
        context.strokeStyle = "#3b82f6";
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        context.strokeRect(x, y - height, width, height);
        context.setLineDash([]);

        // Draw label
        if (field.label) {
          context.fillStyle = "#374151";
          context.font = "12px Arial";
          context.fillText(field.label, x, y - height - 5);
        }
      }
    });
    
    // Wait for all images to load before returning
    await Promise.all(imagesToLoad);
  }, [fields, currentPage, fieldValues]);

  // Render PDF when page changes - follow TemplateFieldEditor pattern
  const renderPage = useCallback(async () => {
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

    try {
      // Use currentPage directly (1-based) like TemplateFieldEditor does
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      // Create render task and store reference
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      // Draw signature fields and signatures after render completes
      await drawFieldOverlays(context, viewport);
      
      // Update field bounds for overlay positioning
      updateFieldBounds(viewport);
      
      // Clear render task reference after completion
      renderTaskRef.current = null;
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name !== "RenderingCancelledException") {
        console.error("Failed to render PDF page", err);
      }
      renderTaskRef.current = null;
    }
  }, [pdfDoc, currentPage, drawFieldOverlays, updateFieldBounds]);

  // Render page when PDF doc, current page, or field values change
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }
    
    // Cleanup: cancel any pending render task when component unmounts or dependencies change
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, fieldValues, renderPage]);

  const handleFieldClick = (field: SignatureField) => {
    if (field.field_type === "signature") {
      setShowSignatureModal({ fieldId: field.id });
    } else if (field.field_type === "date") {
      const today = new Date().toISOString().split("T")[0];
      setFieldValues({ ...fieldValues, [field.id]: today });
    } else if (field.field_type === "text") {
      const value = prompt(`Enter ${field.label || "text"}:`, fieldValues[field.id] || "");
      if (value !== null) {
        setFieldValues({ ...fieldValues, [field.id]: value });
      }
    }
  };

  const handleSignatureSave = (imageData: string) => {
    if (showSignatureModal) {
      setFieldValues({ ...fieldValues, [showSignatureModal.fieldId]: imageData });
      setShowSignatureModal(null);
      // Page will re-render automatically via useEffect
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missingFields = fields.filter(
      (f) => f.is_required && !fieldValues[f.id]
    );

    if (missingFields.length > 0) {
      toast.error(
        `Please fill in required fields: ${missingFields.map((f) => f.label || f.id).join(", ")}`
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/esignature/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureData: fieldValues,
          fieldValues: fieldValues,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit signature");
      }

      toast.success("Document signed successfully!");
      
      // Redirect to success page
      window.location.href = `/sign/${token}/success`;
    } catch (err: any) {
      console.error("Failed to submit signature:", err);
      toast.error(err.message || "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    const reason = prompt("Please provide a reason for declining:");
    if (reason === null) return;

    try {
      // TODO: Call API to decline
      toast.info("Document declined");
      if (onDecline) {
        onDecline();
      }
    } catch (err: any) {
      console.error("Failed to decline:", err);
      toast.error("Failed to decline document");
    }
  };

  if (alreadySigned) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <Check className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Already Signed</h2>
          <p className="text-gray-600 mb-4">This document has already been signed.</p>
          <a
            href={`/sign/${token}/success`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Confirmation
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pageFields = fields.filter((f) => f.page_number === currentPage);
  const hasRequiredFields = fields.some((f) => f.is_required);
  const allRequiredFilled = fields
    .filter((f) => f.is_required)
    .every((f) => fieldValues[f.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Sign Document</h1>
              {signer && (
                <p className="text-sm text-gray-600 mt-1">
                  Signing as: {signer.name || signer.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasRequiredFields && (
                <div className="text-sm text-gray-600 mr-4">
                  {fields.filter((f) => f.is_required && fieldValues[f.id]).length} /{" "}
                  {fields.filter((f) => f.is_required).length} required fields
                </div>
              )}
              <button
                onClick={handleDecline}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4 inline mr-1" />
                Decline
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (hasRequiredFields && !allRequiredFilled)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Sign & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Navigation */}
        {numPages > 1 && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage === numPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        )}

        {/* Canvas Container - View Only */}
        <div ref={containerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex justify-center">
            <div className="relative" style={{ display: "inline-block" }}>
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded block"
                style={{ maxWidth: "100%", height: "auto" }}
              />
              
              {/* Clickable Field Overlays - Only show for unsigned fields */}
              {canvasRef.current && fieldBounds.size > 0 && (
                <div
                  ref={overlayRef}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{
                    width: `${canvasRef.current.width}px`,
                    height: `${canvasRef.current.height}px`,
                  }}
                >
                  {pageFields.map((field) => {
                    // Skip if already signed (signature is drawn on canvas)
                    if (fieldValues[field.id] && field.field_type === "signature") {
                      return null;
                    }

                    const bounds = fieldBounds.get(field.id);
                    if (!bounds) return null;
                    
                    return (
                      <div
                        key={field.id}
                        className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 hover:bg-blue-500/30 cursor-pointer transition-colors pointer-events-auto z-50"
                        style={{
                          left: `${bounds.x}px`,
                          top: `${bounds.y}px`,
                          width: `${bounds.width}px`,
                          height: `${bounds.height}px`,
                          minWidth: "50px",
                          minHeight: "30px",
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFieldClick(field);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#2563eb";
                          e.currentTarget.style.backgroundColor = "rgba(37, 99, 235, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#3b82f6";
                          e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.2)";
                        }}
                        title={`${field.label || field.field_type}${field.is_required ? " (Required)" : ""} - Click to ${field.field_type === "signature" ? "sign" : "fill"}`}
                      >
                        <div className="w-full h-full flex items-center justify-center text-xs text-blue-700 font-medium">
                          {field.label || field.field_type}
                          {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {pageFields.length === 0 && fields.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-yellow-50/50 border-2 border-yellow-300 rounded z-40">
                  <p className="text-sm text-yellow-800">
                    No signature fields found on page {currentPage}. Fields may be on other pages.
                  </p>
                </div>
              )}
              {fields.length === 0 && !loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50/50 border-2 border-red-300 rounded z-40">
                  <p className="text-sm text-red-800">
                    No signature fields configured for this document.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        {pageFields.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Instructions:</strong> Click on the highlighted blue dashed boxes on the document above to fill them in. Required fields are marked with an asterisk (*). Your signatures will appear on the document once added.
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Found {pageFields.length} field(s) on page {currentPage} of {numPages}
            </p>
          </div>
        )}
        {fields.length > 0 && pageFields.length === 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-900">
              <strong>Note:</strong> No signature fields found on page {currentPage}. Try navigating to other pages using the page navigation buttons above.
            </p>
          </div>
        )}
        {fields.length === 0 && !loading && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">
              <strong>Warning:</strong> No signature fields are configured for this document. Please contact the document sender.
            </p>
          </div>
        )}
      </div>

      {/* Signature Capture Modal */}
      {showSignatureModal && (
        <SignatureCapture
          isOpen={true}
          onClose={() => {
            setShowSignatureModal(null);
          }}
          onSave={(imageData) => {
            handleSignatureSave(imageData);
          }}
        />
      )}
    </div>
  );
};
