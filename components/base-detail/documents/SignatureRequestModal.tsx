"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Trash2, Mail, User, FileText, Loader2, Save, Send, ChevronDown, ChevronUp, Database, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StoredDocument } from "@/lib/services/documents-service";
import { ESignatureService, SignatureRequestSigner, SignatureField } from "@/lib/services/esign-service";
import { toast } from "sonner";

type SignatureRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  selectedDocument?: StoredDocument | null;
  onRequestCreated?: () => void;
  // Optional: Pre-selected record for status update
  recordId?: string | null;
  // Optional: Fields available for status column selection
  availableFields?: Array<{ id: string; name: string; type: string; options?: Record<string, { name?: string; label?: string }> }>;
  // Optional: Record values for auto-populating signer info
  recordValues?: Record<string, any>;
};

export const SignatureRequestModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  selectedDocument,
  onRequestCreated,
  recordId,
  availableFields = [],
  recordValues,
}: SignatureRequestModalProps) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [signers, setSigners] = useState<Array<{ email: string; name: string; role: "signer" | "viewer" | "approver"; sign_order: number }>>([{
    email: "", name: "", role: "signer", sign_order: 0,
  }]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Status column update state
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [selectedStatusFieldId, setSelectedStatusFieldId] = useState<string>("");
  const [statusValueOnComplete, setStatusValueOnComplete] = useState("Signed");
  const [statusValueOnDecline, setStatusValueOnDecline] = useState("Declined");
  
  // PDF Preview state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [templateFields, setTemplateFields] = useState<any[]>([]);
  const [fieldBounds, setFieldBounds] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const [fieldSignerAssignments, setFieldSignerAssignments] = useState<Record<string, string>>({}); // fieldId -> signerEmail
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const isRenderingRef = useRef(false);

  // Load available templates with valid signature fields
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Fetch all templates for this base/table
      const response = await fetch(`/api/templates?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`, { headers });
      
      if (!response.ok) {
        throw new Error("Failed to load templates");
      }

      const data = await response.json();
      const templates = data.templates || [];

      // Filter templates that have signature fields (any field_type === "signature")
      const templatesWithSignatures = templates
        .filter((template: any) => {
          // Show templates that have ANY signature fields
          const hasSignatureFields = template.fields?.some((f: any) => f.field_type === "signature");
          return hasSignatureFields;
        })
        .map((template: any) => ({
          id: template.id,
          name: template.name,
          description: template.description
        }));

      console.log(`Found ${templatesWithSignatures.length} templates with signature fields out of ${templates.length} total templates`);
      setAvailableTemplates(templatesWithSignatures);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates with signature fields");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

  // Track if templates have been loaded to prevent duplicate loads
  const templatesLoadedRef = useRef(false);
  const signerAutoPopulatedRef = useRef(false);

  // Load templates when modal opens (only once)
  useEffect(() => {
    if (isOpen && !templatesLoadedRef.current) {
      templatesLoadedRef.current = true;
      loadTemplates();
    } else if (!isOpen) {
      // Reset loaded flag when modal closes
      templatesLoadedRef.current = false;
      signerAutoPopulatedRef.current = false;
    }
  }, [isOpen, loadTemplates]);
  
  // Auto-populate signer from record data (only once when modal opens)
  useEffect(() => {
    if (isOpen && !signerAutoPopulatedRef.current && recordValues && availableFields.length > 0) {
      signerAutoPopulatedRef.current = true;
      
      // Find email field (common patterns)
      const emailField = availableFields.find(f => 
        f.name.toLowerCase().includes('email') ||
        f.name.toLowerCase().includes('e-mail') ||
        f.name.toLowerCase().includes('contact')
      );
      
      // Find name field (common patterns)
      const nameField = availableFields.find(f => 
        f.name.toLowerCase().includes('name') ||
        f.name.toLowerCase().includes('client') ||
        f.name.toLowerCase().includes('contact')
      );
      
      const autoEmail = emailField && recordValues[emailField.id] ? String(recordValues[emailField.id]) : "";
      const autoName = nameField && recordValues[nameField.id] ? String(recordValues[nameField.id]) : "";
      
      // Only auto-populate if we found at least one value
      if (autoEmail || autoName) {
        setSigners([{
          email: autoEmail,
          name: autoName,
          role: "signer",
          sign_order: 0,
        }]);
      }
    }
  }, [isOpen, recordValues, availableFields]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Cancel any pending render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }
      
      // Reset all state
      setPdfDoc(null);
      setPdfUrl(null);
      setTemplateFields([]);
      setFieldSignerAssignments({});
      setFieldBounds(new Map());
      setCanvasDisplaySize(null);
      isRenderingRef.current = false;
      setPdfLoading(false);
      setSelectedTemplateId("");
    }
  }, [isOpen]);

  // Load template PDF and fields when template is selected
  const loadTemplatePDF = useCallback(async (templateId: string) => {
    if (!templateId) return;
    
    try {
      setPdfLoading(true);
      console.log('Loading template PDF:', templateId);
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Get template details with fields
      const response = await fetch(`/api/templates/${templateId}`, { headers });
      if (!response.ok) {
        throw new Error("Failed to load template");
      }
      const data = await response.json();
      const template = data.template;
      
      // Get signed URL
      const urlResponse = await fetch(
        `/api/templates/${templateId}/signed-url?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`,
        { headers }
      );
      if (!urlResponse.ok) {
        throw new Error("Failed to get template URL");
      }
      const urlData = await urlResponse.json();
      setPdfUrl(urlData.url);

      // Load signature fields
      const signatureFields = (template.fields || []).filter((f: any) => f.field_type === "signature");
      setTemplateFields(signatureFields);
      
      // Initialize field-signer assignments (default to empty - user will assign)
      const assignments: Record<string, string> = {};
      signatureFields.forEach((field: any) => {
        assignments[field.id || field.field_key] = ""; // Don't use signers here
      });
      setFieldSignerAssignments(assignments);

      // Load PDF with pdfjs-dist
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument({ url: urlData.url });
      const pdf = await loadingTask.promise;
      console.log('PDF loaded successfully:', { numPages: pdf.numPages });
      
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      setPdfLoading(false);
      isRenderingRef.current = false; // Ensure rendering is allowed
    } catch (error) {
      console.error("Failed to load template PDF:", error);
      toast.error("Failed to load template preview");
      setPdfLoading(false);
    }
  }, [baseId, tableId]); // Removed signers and pdfLoading from deps

  // Track if we've loaded for this template to prevent duplicate loads
  const loadedTemplateRef = useRef<string | null>(null);

  // Load PDF when template is selected
  useEffect(() => {
    if (selectedTemplateId && isOpen && loadedTemplateRef.current !== selectedTemplateId) {
      loadedTemplateRef.current = selectedTemplateId;
      loadTemplatePDF(selectedTemplateId);
    } else if (!selectedTemplateId || !isOpen) {
      // Reset preview state
      loadedTemplateRef.current = null;
      setPdfDoc(null);
      setPdfUrl(null);
      setTemplateFields([]);
      setFieldSignerAssignments({});
      setFieldBounds(new Map());
      setCanvasDisplaySize(null);
      isRenderingRef.current = false; // Reset rendering flag
    }
  }, [selectedTemplateId, isOpen, loadTemplatePDF]);

  // Render PDF page - realtime, no debouncing
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) {
      console.log('Render skipped - no pdfDoc or canvas');
      return;
    }
    
    if (isRenderingRef.current) {
      console.log('Render skipped - already rendering');
      return;
    }

    // Set rendering flag to prevent concurrent renders
    isRenderingRef.current = true;
    console.log('Starting PDF render...');

    // Cancel any existing render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (err) {
        // Ignore cancellation errors
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      
      if (!canvas) {
        console.error('Canvas disappeared during render');
        isRenderingRef.current = false;
        return;
      }
      
      const context = canvas.getContext("2d");

      if (!context) {
        console.error('No 2D context available');
        isRenderingRef.current = false;
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      console.log('Canvas size set:', { width: canvas.width, height: canvas.height });

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      console.log('PDF rendered successfully');

      // Get canvas display size (accounting for CSS scaling)
      const displayWidth = canvas.offsetWidth;
      const displayHeight = canvas.offsetHeight;
      setCanvasDisplaySize({ width: displayWidth, height: displayHeight });
      
      // Calculate scale ratio between actual canvas size and displayed size
      const scaleX = displayWidth / viewport.width;
      const scaleY = displayHeight / viewport.height;

      // Update field bounds for overlay positioning
      const pageFields = templateFields.filter((f: any) => f.page_number === currentPage);
      const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();

      pageFields.forEach((field: any) => {
        const scale = viewport.scale;
        const x = field.x_position * scale * scaleX; // Apply display scale
        const y = (viewport.height - field.y_position * scale) * scaleY; // PDF Y is from bottom, apply display scale
        const width = (field.width || 150) * scale * scaleX;
        const height = (field.height || 50) * scale * scaleY;

        bounds.set(field.id || field.field_key, {
          x,
          y: y - height,
          width,
          height,
        });
      });

      setFieldBounds(bounds);
      console.log('Field bounds updated:', { count: bounds.size, pageFields: pageFields.length });
      
      renderTaskRef.current = null;
      isRenderingRef.current = false; // Clear rendering flag
    } catch (err: any) {
      // Silently ignore cancellation errors - this is expected behavior
      if (err?.name === "RenderingCancelledException") {
        console.log('Render cancelled (expected)');
      } else {
        console.error('Render error:', err);
        console.error("Failed to render PDF page:", err);
      }
      renderTaskRef.current = null;
      isRenderingRef.current = false; // Clear rendering flag on error
    }
  }, [pdfDoc, currentPage, zoom, templateFields]); // Removed pdfLoading

  // Render page when dependencies change
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }

    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }
      isRenderingRef.current = false;
    };
  }, [pdfDoc, currentPage, zoom, renderPage]);

  const handleAddSigner = () => {
    setSigners([...signers, { email: "", name: "", role: "signer", sign_order: signers.length }]);
  };

  const handleRemoveSigner = (index: number) => {
    setSigners(signers.filter((_, i) => i !== index));
  };

  const handleSignerChange = (index: number, field: string, value: string) => {
    const updated = [...signers];
    if (field === "email" || field === "name") {
      updated[index] = { ...updated[index], [field]: value };
    } else if (field === "role") {
      updated[index] = { ...updated[index], role: value as "signer" | "viewer" | "approver" };
    } else if (field === "sign_order") {
      updated[index] = { ...updated[index], sign_order: parseInt(value) || 0 };
    }
    setSigners(updated);
  };

  const handleSave = async () => {
    if (!title || !selectedTemplateId) {
      toast.error("Please provide a title and select a template with signature fields");
      return;
    }

    const validSigners = signers.filter((s) => s.email.trim() !== "");
    if (validSigners.length === 0) {
      toast.error("Please add at least one signer");
      return;
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const signer of validSigners) {
      if (!emailRegex.test(signer.email)) {
        toast.error(`Invalid email address: ${signer.email}`);
        return;
      }
    }

    try {
      setSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Generate document from template first
      const generateResponse = await fetch("/api/templates/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          templateId: selectedTemplateId,
          baseId,
          tableId: tableId || null,
          fieldValues: {}, // Empty field values - template will be used as-is
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || "Failed to generate document from template");
      }

      const generateData = await generateResponse.json();
      const documentPath = generateData.documentPath;

      if (!documentPath) {
        throw new Error("Failed to get generated document path");
      }

      // Get all signature fields from the template
      const templateResponse = await fetch(`/api/templates/${selectedTemplateId}`, { headers });
      if (!templateResponse.ok) {
        throw new Error("Failed to load template fields");
      }
      const templateData = await templateResponse.json();
      const templateFields = (templateData.template?.fields || []).filter(
        (f: any) => f.field_type === "signature"
      );

      // Map template fields to signature request fields
      // Use per-field signer assignments from the preview
      const signatureFields = templateFields.map((field: any) => ({
        signer_email: fieldSignerAssignments[field.id || field.field_key] || validSigners[0]?.email || "",
        page_number: field.page_number,
        x_position: Number(field.x_position),
        y_position: Number(field.y_position),
        width: field.width ? Number(field.width) : 150,
        height: field.height ? Number(field.height) : 50,
        field_type: "signature" as const,
        label: field.field_name,
        is_required: field.is_required !== false,
      }));

      // Get full document path
      const prefix = tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
      const fullDocumentPath = documentPath.startsWith(prefix) ? documentPath : `${prefix}${documentPath}`;

      const response = await fetch("/api/esignature/requests", {
        method: "POST",
        headers,
        body: JSON.stringify({
          baseId,
          tableId: tableId || null,
          record_id: recordId || null,
          title,
          message: message || null,
          document_path: fullDocumentPath,
          expires_at: expiresAt || null,
          signers: validSigners.map((s) => ({
            email: s.email.trim(),
            name: s.name.trim() || null,
            role: s.role,
            sign_order: s.sign_order,
          })),
          fields: signatureFields.length > 0 ? signatureFields : undefined,
          // Status column update fields
          status_field_id: showStatusUpdate && selectedStatusFieldId ? selectedStatusFieldId : null,
          status_value_on_complete: showStatusUpdate ? statusValueOnComplete : null,
          status_value_on_decline: showStatusUpdate ? statusValueOnDecline : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create signature request");
      }

      toast.success("Signature request created successfully!");
      if (onRequestCreated) {
        onRequestCreated();
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to create signature request:", error);
      toast.error(error.message || "Failed to create signature request");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    if (!title || !selectedTemplateId) {
      toast.error("Please provide a title and select a template with signature fields");
      return;
    }

    const validSigners = signers.filter((s) => s.email.trim() !== "");
    if (validSigners.length === 0) {
      toast.error("Please add at least one signer");
      return;
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const signer of validSigners) {
      if (!emailRegex.test(signer.email)) {
        toast.error(`Invalid email address: ${signer.email}`);
        return;
      }
    }

    try {
      setSending(true);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Generate document from template first (skip auto signature request creation)
      const generateResponse = await fetch("/api/templates/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          templateId: selectedTemplateId,
          baseId,
          tableId: tableId || null,
          recordId: recordId || null,
          fieldValues: {}, // Empty field values - template will be used as-is
          skipSignatureRequest: true, // We'll create signature request manually with our signers
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || "Failed to generate document from template");
      }

      const generateData = await generateResponse.json();
      const documentPath = generateData.documentPath;

      if (!documentPath) {
        throw new Error("Failed to get generated document path");
      }

      // Get all signature fields from the template
      const templateResponse = await fetch(`/api/templates/${selectedTemplateId}`, { headers });
      if (!templateResponse.ok) {
        throw new Error("Failed to load template fields");
      }
      const templateData = await templateResponse.json();
      const templateFields = (templateData.template?.fields || []).filter(
        (f: any) => f.field_type === "signature"
      );

      // Map template fields to signature request fields
      // Use per-field signer assignments from the preview
      const signatureFields = templateFields.map((field: any) => ({
        signer_email: fieldSignerAssignments[field.id || field.field_key] || validSigners[0]?.email || "",
        page_number: field.page_number,
        x_position: Number(field.x_position),
        y_position: Number(field.y_position),
        width: field.width ? Number(field.width) : 150,
        height: field.height ? Number(field.height) : 50,
        field_type: "signature" as const,
        label: field.field_name,
        is_required: field.is_required !== false,
      }));

      // Get full document path
      const prefix = tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
      const fullDocumentPath = documentPath.startsWith(prefix) ? documentPath : `${prefix}${documentPath}`;

      // First, create the request
      const createResponse = await fetch("/api/esignature/requests", {
        method: "POST",
        headers,
        body: JSON.stringify({
          baseId,
          tableId: tableId || null,
          record_id: recordId || null,
          title,
          message: message || null,
          document_path: fullDocumentPath,
          expires_at: expiresAt || null,
          signers: validSigners.map((s) => ({
            email: s.email.trim(),
            name: s.name.trim() || null,
            role: s.role,
            sign_order: s.sign_order,
          })),
          fields: signatureFields.length > 0 ? signatureFields : undefined,
          // Status column update fields
          status_field_id: showStatusUpdate && selectedStatusFieldId ? selectedStatusFieldId : null,
          status_value_on_complete: showStatusUpdate ? statusValueOnComplete : null,
          status_value_on_decline: showStatusUpdate ? statusValueOnDecline : null,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create signature request");
      }

      const createData = await createResponse.json();
      const requestId = createData.request?.id;

      if (!requestId) {
        throw new Error("Failed to get request ID after creation");
      }

      // Then, send the request
      const sendResponse = await fetch(`/api/esignature/requests/${requestId}/send`, {
        method: "POST",
        headers,
      });

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        // Request was created, but sending failed
        toast.warning("Request created but failed to send emails. You can try sending again from the status view.");
        console.error("Failed to send request:", errorData);
      } else {
        const sendData = await sendResponse.json();
        if (sendData.emailsFailed > 0 && sendData.emailsSent > 0) {
          toast.warning(`Request created. Sent ${sendData.emailsSent} email(s), but ${sendData.emailsFailed} failed.`);
        } else {
          toast.success(`Signature request created and sent to ${sendData.emailsSent || validSigners.length} signer(s)!`);
        }
      }

      if (onRequestCreated) {
        onRequestCreated();
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to create and send signature request:", error);
      toast.error(error.message || "Failed to create signature request");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl md:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Request Signature</h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Send document for e-signature</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/70 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-6">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template with Signature Fields <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Loading templates...</span>
              </div>
            ) : (
              <>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    const selected = availableTemplates.find(t => t.id === e.target.value);
                    if (selected) {
                      setTitle(selected.name || "Signature Request");
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a template with signature fields...</option>
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.description ? `- ${template.description}` : ""}
                    </option>
                  ))}
                </select>
                {!selectedTemplateId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Select a template with signature fields to request e-signatures.
                  </p>
                )}
                {availableTemplates.length === 0 && !loading && (
                  <p className="text-xs text-yellow-600 mt-1">
                    No templates with signature fields found. Please create a template with signature fields first.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Contract Signature Request"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Signers (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personalized message for the signers..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Signers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Signers <span className="text-red-500">*</span>
              </label>
              <button
                onClick={handleAddSigner}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Signer
              </button>
            </div>
            <div className="space-y-3">
              {signers.map((signer, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={signer.email}
                          onChange={(e) => handleSignerChange(index, "email", e.target.value)}
                          placeholder="signer@example.com"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={signer.name}
                          onChange={(e) => handleSignerChange(index, "name", e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Role
                        </label>
                        <select
                          value={signer.role}
                          onChange={(e) => handleSignerChange(index, "role", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="signer">Signer</option>
                          <option value="viewer">Viewer</option>
                          <option value="approver">Approver</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Sign Order (0 = parallel)
                        </label>
                        <input
                          type="number"
                          value={signer.sign_order}
                          onChange={(e) => handleSignerChange(index, "sign_order", e.target.value)}
                          min="0"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    {signers.length > 1 && (
                      <button
                        onClick={() => handleRemoveSigner(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Field Assignment Section - Show if template has signature fields */}
                  {templateFields.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700">
                          Assigned Signature Fields
                        </label>
                        <span className="text-xs text-gray-500">
                          {Object.entries(fieldSignerAssignments).filter(([_, email]) => email === signer.email).length} / {templateFields.length} assigned
                        </span>
                      </div>
                      
                      {/* Field Checkboxes */}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {templateFields.map((field: any) => {
                          const fieldKey = field.id || field.field_key;
                          const isAssigned = fieldSignerAssignments[fieldKey] === signer.email;
                          
                          return (
                            <label
                              key={fieldKey}
                              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => {
                                  setFieldSignerAssignments({
                                    ...fieldSignerAssignments,
                                    [fieldKey]: e.target.checked ? signer.email : "",
                                  });
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div className="flex-1 flex items-center justify-between">
                                <span className="text-xs text-gray-700">
                                  {field.field_name || "Signature Field"}
                                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Page {field.page_number}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newAssignments = { ...fieldSignerAssignments };
                            templateFields.forEach((field: any) => {
                              newAssignments[field.id || field.field_key] = signer.email;
                            });
                            setFieldSignerAssignments(newAssignments);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newAssignments = { ...fieldSignerAssignments };
                            templateFields.forEach((field: any) => {
                              const fieldKey = field.id || field.field_key;
                              if (newAssignments[fieldKey] === signer.email) {
                                newAssignments[fieldKey] = "";
                              }
                            });
                            setFieldSignerAssignments(newAssignments);
                          }}
                          className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Column Update - Advanced Option */}
          {recordId && availableFields.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowStatusUpdate(!showStatusUpdate)}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Auto-Update Record Status</span>
                  {showStatusUpdate && selectedStatusFieldId && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Enabled
                    </span>
                  )}
                </div>
                {showStatusUpdate ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {showStatusUpdate && (
                <div className="p-4 border-t border-gray-200 bg-white space-y-4">
                  <p className="text-xs text-gray-500">
                    Automatically update a field in the linked record when this signature request is completed or declined.
                  </p>
                  
                  {/* Status Field Selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Field to Update
                    </label>
                    <select
                      value={selectedStatusFieldId}
                      onChange={(e) => setSelectedStatusFieldId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a field...</option>
                      {availableFields
                        .filter(f => f.type === "single_select" || f.type === "text")
                        .map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.name} ({field.type === "single_select" ? "Single Select" : "Text"})
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  {/* Status Values */}
                  {selectedStatusFieldId && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Value on Signed
                        </label>
                        <input
                          type="text"
                          value={statusValueOnComplete}
                          onChange={(e) => setStatusValueOnComplete(e.target.value)}
                          placeholder="Signed"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Value on Declined
                        </label>
                        <input
                          type="text"
                          value={statusValueOnDecline}
                          onChange={(e) => setStatusValueOnDecline(e.target.value)}
                          placeholder="Declined"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Help text for single_select fields */}
                  {selectedStatusFieldId && availableFields.find(f => f.id === selectedStatusFieldId)?.type === "single_select" && (
                    <p className="text-xs text-amber-600">
                      Tip: For single select fields, make sure the values match existing options in the field.
                    </p>
                  )}
                </div>
              )}  
            </div>
          )}
            </div>
            
            {/* Right Column - PDF Preview */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Document Preview</h3>
              
              {selectedTemplateId && pdfDoc ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  {/* Preview Controls */}
                  <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-gray-600">
                        Page {currentPage} of {numPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                        disabled={currentPage === numPages}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Next Page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-gray-600">{Math.round(zoom * 100)}%</span>
                      <button
                        onClick={() => setZoom(Math.min(2, zoom + 0.2))}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Canvas with signature field overlays */}
                  <div className="p-4 overflow-auto max-h-[500px]">
                    <div className="flex justify-center">
                      <div className="relative inline-block">
                        <canvas
                          ref={canvasRef}
                          className="border border-gray-300 rounded shadow-sm"
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                        
                        {/* Signature Field Overlays */}
                        {canvasRef.current && fieldBounds.size > 0 && canvasDisplaySize && (
                          <div
                            ref={overlayRef}
                            className="absolute top-0 left-0 pointer-events-none"
                            style={{
                              width: `${canvasDisplaySize.width}px`,
                              height: `${canvasDisplaySize.height}px`,
                            }}
                          >
                            {templateFields
                              .filter((f: any) => f.page_number === currentPage)
                              .map((field: any) => {
                                const fieldKey = field.id || field.field_key;
                                const bounds = fieldBounds.get(fieldKey);
                                if (!bounds) return null;
                                
                                const assignedSignerEmail = fieldSignerAssignments[fieldKey];
                                const assignedSigner = signers.find(s => s.email === assignedSignerEmail);
                                
                                return (
                                  <div
                                    key={fieldKey}
                                    className="absolute pointer-events-auto"
                                    style={{
                                      left: `${bounds.x}px`,
                                      top: `${bounds.y}px`,
                                      width: `${bounds.width}px`,
                                      height: `${bounds.height}px`,
                                    }}
                                  >
                                    {/* Field border - color coded by assignment status */}
                                    <div className={`absolute inset-0 border-3 border-dashed rounded ${
                                      assignedSignerEmail 
                                        ? 'border-blue-500 bg-blue-500/10' 
                                        : 'border-red-500 bg-red-500/10'
                                    }`} />
                                    
                                    {/* Field label and assignment indicator */}
                                    <div className={`absolute -top-7 left-0 right-0 rounded shadow-sm px-2 py-1 text-xs ${
                                      assignedSignerEmail 
                                        ? 'bg-blue-100 border border-blue-300' 
                                        : 'bg-red-100 border border-red-300'
                                    }`}>
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-medium text-gray-800 truncate">
                                          {field.field_name || "Signature"}
                                          {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                        </span>
                                        {assignedSignerEmail ? (
                                          <span className="text-blue-700 font-medium truncate" title={assignedSigner?.name || assignedSignerEmail}>
                                            {assignedSigner?.name || assignedSignerEmail}
                                          </span>
                                        ) : (
                                          <span className="text-red-700 font-medium">
                                            Unassigned
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Field summary */}
                  {templateFields.length > 0 && (
                    <div className="bg-blue-50 border-t border-blue-200 px-3 py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-blue-900">
                          <strong>{templateFields.filter((f: any) => f.page_number === currentPage).length}</strong> signature field(s) on this page
                        </span>
                        <span className={Object.values(fieldSignerAssignments).filter(email => email !== "").length === templateFields.length ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                          {Object.values(fieldSignerAssignments).filter(email => email !== "").length} / {templateFields.length} assigned
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedTemplateId ? (
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading preview...</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Select a template to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-600">
            {signers.filter((s) => s.email.trim() !== "").length} signer(s) added
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || sending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Draft
                </>
              )}
            </button>
            <button
              onClick={handleSaveAndSend}
              disabled={saving || sending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Save & Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};







