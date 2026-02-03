"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Trash2, Mail, User, FileText, Loader2, Save, Send, ChevronDown, ChevronUp, Database, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StoredDocument } from "@/lib/services/documents-service";
import { ESignatureService, SignatureRequestSigner, SignatureField } from "@/lib/services/esign-service";
import type { RecordRow } from "@/lib/types/base-detail";
import { toast } from "sonner";

type SignatureRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  selectedDocument?: StoredDocument | null;
  onRequestCreated?: () => void;
  // Pre-selected record for status update
  recordId?: string | null;
  // Pre-selected template ID
  selectedTemplateId?: string;
  // Fields available for status column selection
  availableFields?: Array<{ id: string; name: string; type: string; options?: Record<string, { name?: string; label?: string }> }>;
  // Record values for auto-populating signer info
  recordValues?: Record<string, any>;
  // Available records for selection (for base-level templates)
  records?: RecordRow[];
};

export const SignatureRequestModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  selectedDocument,
  onRequestCreated,
  recordId,
  selectedTemplateId: preSelectedTemplateId,
  availableFields = [],
  recordValues,
  records = [],
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
  
  // Record selection for base-level templates
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(recordId || null);

  // Document mode vs Template mode
  const [mode, setMode] = useState<'template' | 'document'>('template');
  // Signature fields placed on document (for document mode)
  const [documentSignatureFields, setDocumentSignatureFields] = useState<Array<{
    id: string;
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  }>>([]);
  // For placing new signature fields
  const [isPlacingField, setIsPlacingField] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  
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
  // Get primary field value for a record
  const getPrimaryValue = (record: RecordRow): string => {
    if (!record.values) return "No value";
    // Get first field value (assuming first field is primary)
    const firstFieldId = availableFields[0]?.id;
    if (firstFieldId && record.values[firstFieldId]) {
      return `${record.values[firstFieldId]} (${record.id?.slice(0, 8)})`;
    }
    return `Record ${record.id?.slice(0, 8)}`;
  };

  // Get email from selected record
  const getRecordEmail = (): string | null => {
    if (!selectedRecordId) return null;
    
    const selectedRecord = records.find(r => r.id === selectedRecordId);
    if (!selectedRecord || !selectedRecord.values) return null;
    
    // Find email field
    const emailField = availableFields.find(f => f.type === 'email');
    
    if (!emailField) return null;
    
    const emailValue = selectedRecord.values[emailField.id];
    return emailValue ? String(emailValue) : null;
  };

  // Get name from selected record
  const getRecordName = (): string | null => {
    if (!selectedRecordId) return null;
    
    const selectedRecord = records.find(r => r.id === selectedRecordId);
    if (!selectedRecord || !selectedRecord.values) return null;
    
    // First, try to find a field with "name" in its name
    const nameField = availableFields.find(f => 
      f.name.toLowerCase().includes('name')
    );
    
    if (nameField && selectedRecord.values[nameField.id]) {
      return String(selectedRecord.values[nameField.id]);
    }
    
    // If not found, use the primary field (first field)
    const primaryFieldId = availableFields[0]?.id;
    if (primaryFieldId && selectedRecord.values[primaryFieldId]) {
      return String(selectedRecord.values[primaryFieldId]);
    }
    
    return null;
  };

  // Check if email is already in use by another signer
  const isEmailAlreadyUsed = (email: string | null, excludeIndex?: number): boolean => {
    if (!email) return false;
    return signers.some((signer, index) => 
      signer.email === email && (excludeIndex === undefined || index !== excludeIndex)
    );
  };

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Fetch all templates for this base (not filtered by table - get base-level templates)
      const response = await fetch(`/api/templates?baseId=${baseId}`, { headers });
      
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
      
      // Auto-select template if one was pre-selected and available
      if (preSelectedTemplateId) {
        const preSelectedTemplate = templatesWithSignatures.find(
          (t: { id: string; name: string; description?: string }) => t.id === preSelectedTemplateId
        );
        if (preSelectedTemplate) {
          setSelectedTemplateId(preSelectedTemplateId);
          setTitle(preSelectedTemplate.name || "Signature Request");
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates with signature fields");
    } finally {
      setLoading(false);
    }
  }, [baseId, preSelectedTemplateId]);

  // Track if templates have been loaded to prevent duplicate loads
  const templatesLoadedRef = useRef(false);
  const signerAutoPopulatedRef = useRef(false);
  const documentLoadedRef = useRef(false);

  // Switch to document mode when selectedDocument is provided
  useEffect(() => {
    if (isOpen && selectedDocument) {
      setMode('document');
      // Set default title from document name
      const docName = selectedDocument.path.split('/').pop() || 'Document';
      setTitle(`Signature Request - ${docName}`);
    } else if (isOpen && !selectedDocument) {
      setMode('template');
    }
  }, [isOpen, selectedDocument]);

  // Load document PDF when in document mode
  const loadDocumentPDF = useCallback(async () => {
    if (!selectedDocument || mode !== 'document') return;
    
    try {
      setPdfLoading(true);
      console.log('Loading document PDF:', selectedDocument.path);
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Get signed URL for the document
      const urlParams = new URLSearchParams({
        baseId,
        ...(tableId && { tableId }),
        path: selectedDocument.path,
        expiresIn: '600',
        ...(recordId && { recordId }),
      });
      
      const urlResponse = await fetch(`/api/documents/signed-url?${urlParams}`, { headers });
      if (!urlResponse.ok) {
        throw new Error("Failed to get document URL");
      }
      const urlData = await urlResponse.json();
      setPdfUrl(urlData.url);

      // Load PDF with pdfjs-dist
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument({ url: urlData.url });
      const pdf = await loadingTask.promise;
      console.log('Document PDF loaded successfully:', { numPages: pdf.numPages });
      
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      setPdfLoading(false);
      isRenderingRef.current = false;
    } catch (error) {
      console.error("Failed to load document PDF:", error);
      toast.error("Failed to load document preview");
      setPdfLoading(false);
    }
  }, [selectedDocument, mode, baseId, tableId, recordId]);

  // Load document PDF when in document mode
  useEffect(() => {
    if (isOpen && mode === 'document' && selectedDocument && !documentLoadedRef.current) {
      documentLoadedRef.current = true;
      loadDocumentPDF();
    } else if (!isOpen || mode !== 'document') {
      documentLoadedRef.current = false;
    }
  }, [isOpen, mode, selectedDocument, loadDocumentPDF]);

  // Load templates when modal opens (only once) - only in template mode
  useEffect(() => {
    if (isOpen && mode === 'template' && !templatesLoadedRef.current) {
      templatesLoadedRef.current = true;
      loadTemplates();
    } else if (!isOpen) {
      // Reset loaded flag when modal closes
      templatesLoadedRef.current = false;
      signerAutoPopulatedRef.current = false;
      documentLoadedRef.current = false;
      // Reset document mode state
      setDocumentSignatureFields([]);
      setIsPlacingField(false);
      setSelectedFieldId(null);
    }
  }, [isOpen, mode, loadTemplates]);
  
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
        `/api/templates/${templateId}/signed-url?baseId=${baseId}`,
        { headers }
      );
      if (!urlResponse.ok) {
        throw new Error("Failed to get template URL");
      }
      const urlData = await urlResponse.json();
      setPdfUrl(urlData.url);

      // Load all fillable fields from the template (signature, text, date, initials, etc.)
      const allFields = (template.fields || []).filter((f: any) => f.field_type);
      setTemplateFields(allFields);
      
      // Initialize field-signer assignments (default to empty - user will assign)
      const assignments: Record<string, string> = {};
      allFields.forEach((field: any) => {
        assignments[field.id || field.field_key] = "";
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

  const handleSignerChange = (changes: Array<{index: number, field: string, value: string}>) => {
    const updated = [...signers];
    changes.forEach(({ index, field, value }) => {
      if (field === "email" || field === "name") {
        updated[index] = { ...updated[index], [field]: value };
      } else if (field === "role") {
        updated[index] = { ...updated[index], role: value as "signer" | "viewer" | "approver" };
      } else if (field === "sign_order") {
        updated[index] = { ...updated[index], sign_order: parseInt(value) || 0 };
      }
    });
    setSigners(updated);
  };

  const handleSave = async () => {
    // Validate based on mode
    if (mode === 'template' && !selectedTemplateId) {
      toast.error("Please select a template with signature fields");
      return;
    }
    if (mode === 'document' && !selectedDocument) {
      toast.error("No document selected");
      return;
    }
    if (mode === 'document' && documentSignatureFields.length === 0) {
      toast.error("Please add at least one signature field on the document");
      return;
    }
    if (!title) {
      toast.error("Please provide a title");
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

      let documentPath: string;
      let signatureFields: Array<{
        signer_email: string;
        page_number: number;
        x_position: number;
        y_position: number;
        width: number;
        height: number;
        field_type: "signature";
        label: string;
        is_required: boolean;
      }>;

      if (mode === 'document' && selectedDocument) {
        // Document mode: use existing document directly
        documentPath = selectedDocument.path;
        
        // Map document signature fields to request fields
        signatureFields = documentSignatureFields.map((field) => ({
          signer_email: fieldSignerAssignments[field.id] || validSigners[0]?.email || "",
          page_number: field.pageIndex + 1, // Convert 0-indexed to 1-indexed
          x_position: field.x,
          y_position: field.y,
          width: field.width,
          height: field.height,
          field_type: "signature" as const,
          label: field.label,
          is_required: true,
        }));
      } else {
        // Template mode: generate document from template
        const generateResponse = await fetch("/api/templates/generate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            templateId: selectedTemplateId,
            baseId,
            fieldValues: {}, // Empty field values - template will be used as-is
          }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.error || "Failed to generate document from template");
        }

        const generateData = await generateResponse.json();
        documentPath = generateData.documentPath;

        if (!documentPath) {
          throw new Error("Failed to get generated document path");
        }

        // Get all fillable fields from the template (including non-signature fields)
        const templateResponse = await fetch(`/api/templates/${selectedTemplateId}`, { headers });
        if (!templateResponse.ok) {
          throw new Error("Failed to load template fields");
        }
        const templateData = await templateResponse.json();
        const templateFieldsData = (templateData.template?.fields || []).filter(
          (f: any) => f.field_type
        );

        // Map all template fields to signature request fields
        signatureFields = templateFieldsData.map((field: any) => ({
          signer_email: fieldSignerAssignments[field.id || field.field_key] || validSigners[0]?.email || "",
          page_number: field.page_number,
          x_position: Number(field.x_position),
          y_position: Number(field.y_position),
          width: field.width ? Number(field.width) : 150,
          height: field.height ? Number(field.height) : 50,
          field_type: field.field_type as any,
          label: field.field_name,
          is_required: field.is_required !== false,
        }));
      }

      // Get full document path
      const prefix = `bases/${baseId}/`;
      const fullDocumentPath = documentPath.startsWith(prefix) ? documentPath : `${prefix}${documentPath}`;

      const response = await fetch("/api/esignature/requests", {
        method: "POST",
        headers,
        body: JSON.stringify({
          baseId,
          tableId: tableId || null,
          record_id: selectedRecordId || recordId || null,
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
    // Validate based on mode
    if (mode === 'template' && !selectedTemplateId) {
      toast.error("Please select a template with signature fields");
      return;
    }
    if (mode === 'document' && !selectedDocument) {
      toast.error("No document selected");
      return;
    }
    if (mode === 'document' && documentSignatureFields.length === 0) {
      toast.error("Please add at least one signature field on the document");
      return;
    }
    if (!title) {
      toast.error("Please provide a title");
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

      let documentPath: string;
      let signatureFields: Array<{
        signer_email: string;
        page_number: number;
        x_position: number;
        y_position: number;
        width: number;
        height: number;
        field_type: "signature";
        label: string;
        is_required: boolean;
      }>;

      if (mode === 'document' && selectedDocument) {
        // Document mode: use existing document directly
        documentPath = selectedDocument.path;
        
        // Map document signature fields to request fields
        signatureFields = documentSignatureFields.map((field) => ({
          signer_email: fieldSignerAssignments[field.id] || validSigners[0]?.email || "",
          page_number: field.pageIndex + 1, // Convert 0-indexed to 1-indexed
          x_position: field.x,
          y_position: field.y,
          width: field.width,
          height: field.height,
          field_type: "signature" as const,
          label: field.label,
          is_required: true,
        }));
      } else {
        // Template mode: generate document from template
        const generateResponse = await fetch("/api/templates/generate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            templateId: selectedTemplateId,
            baseId,
            fieldValues: {}, // Empty field values - template will be used as-is
            skipSignatureRequest: true, // We'll create signature request manually with our signers
          }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.error || "Failed to generate document from template");
        }

        const generateData = await generateResponse.json();
        documentPath = generateData.documentPath;

        if (!documentPath) {
          throw new Error("Failed to get generated document path");
        }

        // Get all fillable fields from the template (including non-signature fields)
        const templateResponse = await fetch(`/api/templates/${selectedTemplateId}`, { headers });
        if (!templateResponse.ok) {
          throw new Error("Failed to load template fields");
        }
        const templateData = await templateResponse.json();
        const templateFieldsData = (templateData.template?.fields || []).filter(
          (f: any) => f.field_type
        );

        // Map all template fields to signature request fields
        signatureFields = templateFieldsData.map((field: any) => ({
          signer_email: fieldSignerAssignments[field.id || field.field_key] || validSigners[0]?.email || "",
          page_number: field.page_number,
          x_position: Number(field.x_position),
          y_position: Number(field.y_position),
          width: field.width ? Number(field.width) : 150,
          height: field.height ? Number(field.height) : 50,
          field_type: field.field_type as any,
          label: field.field_name,
          is_required: field.is_required !== false,
        }));
      }

      // Get full document path
      const prefix = `bases/${baseId}/`;
      const fullDocumentPath = documentPath.startsWith(prefix) ? documentPath : `${prefix}${documentPath}`;

      // First, create the request
      const createResponse = await fetch("/api/esignature/requests", {
        method: "POST",
        headers,
        body: JSON.stringify({
          baseId,
          tableId: tableId || null,
          record_id: selectedRecordId || recordId || null,
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Request Signature</h2>
            <p className="text-sm text-gray-600 mt-1">Send document for e-signature</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/70 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-6">
          {/* Document/Template Selection */}
          <div>
            {mode === 'document' && selectedDocument ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Document
                </label>
                <div className="w-full px-3 py-2 border border-green-300 rounded-lg bg-green-50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 font-medium truncate">
                    {selectedDocument.path.split('/').pop()}
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Click on the document preview to add signature fields where signers need to sign.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Record Selection (for base-level templates) */}
          {records.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Record
              </label>
              <select
                value={selectedRecordId || ""}
                onChange={(e) => setSelectedRecordId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {getPrimaryValue(record)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selecting a record will automatically attach the signed document to that record when the signature is complete.
              </p>
            </div>
          )}

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
                          onChange={(e) => handleSignerChange([{index, field: "email", value: e.target.value}])}
                          placeholder="signer@example.com"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name (Optional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={signer.name}
                            onChange={(e) => handleSignerChange([{index, field: "name", value: e.target.value}])}
                            placeholder="Full Name"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {selectedRecordId && (getRecordName() || getRecordEmail()) && !isEmailAlreadyUsed(getRecordEmail(), index) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSignerChange([
                                  {index, field: "email", value: getRecordEmail() || ""},
                                  {index, field: "name", value: getRecordName() || ""},
                                ]);
                              }}
                              className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 whitespace-nowrap"
                              title="Fill email and name from selected record"
                            >
                              Autofill
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Role
                        </label>
                        <select
                          value={signer.role}
                          onChange={(e) => handleSignerChange([{index, field: "role", value: e.target.value}])}
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
                          onChange={(e) => handleSignerChange([{index, field: "sign_order", value: e.target.value}])}
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
                  
                  {/* Field Assignment Section - Template Mode */}
                  {mode === 'template' && templateFields.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700">
                          Assign Fields to Signer
                          {signer.email ? ` (${signer.email})` : " (Please enter signer's email to assign fields)"}
                        </label>
                        <span className="text-xs text-gray-500">
                          {Object.entries(fieldSignerAssignments).filter(([_, email]) => email === signer.email).length} / {templateFields.length} assigned
                        </span>
                      </div>
                      
                      {/* Field Checkboxes - Separated by Type */}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {/* Signature Fields */}
                        {templateFields.filter((f: any) => f.field_type === "signature").length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded mb-1">
                              Signature Fields
                            </div>
                            {templateFields
                              .filter((f: any) => f.field_type === "signature")
                              .map((field: any) => {
                                const fieldKey = field.id || field.field_key;
                                const isAssigned = signer.email && fieldSignerAssignments[fieldKey] === signer.email;
                                
                                return (
                                  <label
                                    key={fieldKey}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!isAssigned}
                                      disabled={!signer.email}
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
                        )}
                        
                        {/* Other Fillable Fields */}
                        {templateFields.filter((f: any) => f.field_type !== "signature").length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded mb-1 mt-2">
                              Other Fields
                            </div>
                            {templateFields
                              .filter((f: any) => f.field_type !== "signature")
                              .map((field: any) => {
                                const fieldKey = field.id || field.field_key;
                                const isAssigned = signer.email && fieldSignerAssignments[fieldKey] === signer.email;
                                
                                return (
                                  <label
                                    key={fieldKey}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!isAssigned}
                                      disabled={!signer.email}
                                      onChange={(e) => {
                                        setFieldSignerAssignments({
                                          ...fieldSignerAssignments,
                                          [fieldKey]: e.target.checked ? signer.email : "",
                                        });
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex-1 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-700">
                                          {field.field_name || field.field_type}
                                          {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                        </span>
                                        <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                          {field.field_type}
                                        </span>
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        Page {field.page_number}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                        )}
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
                  
                  {/* Field Assignment Section - Document Mode */}
                  {mode === 'document' && documentSignatureFields.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700">
                          Assigned Signature Fields
                        </label>
                        <span className="text-xs text-gray-500">
                          {Object.entries(fieldSignerAssignments).filter(([_, email]) => email === signer.email).length} / {documentSignatureFields.length} assigned
                        </span>
                      </div>
                      
                      {/* Field Checkboxes */}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {documentSignatureFields.map((field) => {
                          const isAssigned = fieldSignerAssignments[field.id] === signer.email;
                          
                          return (
                            <label
                              key={field.id}
                              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => {
                                  setFieldSignerAssignments({
                                    ...fieldSignerAssignments,
                                    [field.id]: e.target.checked ? signer.email : "",
                                  });
                                }}
                                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                              />
                              <div className="flex-1 flex items-center justify-between">
                                <span className="text-xs text-gray-700">
                                  {field.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Page {field.pageIndex + 1}
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
                            documentSignatureFields.forEach((field) => {
                              newAssignments[field.id] = signer.email;
                            });
                            setFieldSignerAssignments(newAssignments);
                          }}
                          className="text-xs text-green-600 hover:text-green-700 hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newAssignments = { ...fieldSignerAssignments };
                            documentSignatureFields.forEach((field) => {
                              if (newAssignments[field.id] === signer.email) {
                                newAssignments[field.id] = "";
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Document Preview</h3>
                {mode === 'document' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlacingField(!isPlacingField)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isPlacingField
                          ? "bg-green-600 text-white"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      {isPlacingField ? "Click on PDF to place..." : "Add Signature Field"}
                    </button>
                    {documentSignatureFields.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {documentSignatureFields.length} field(s)
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Show PDF preview for both template mode (with template selected) and document mode (with document) */}
              {((mode === 'template' && selectedTemplateId && pdfDoc) || (mode === 'document' && selectedDocument && pdfDoc)) ? (
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
                          className={`border border-gray-300 rounded shadow-sm ${
                            mode === 'document' && isPlacingField ? 'cursor-crosshair' : ''
                          }`}
                          style={{ maxWidth: "100%", height: "auto" }}
                          onClick={(e) => {
                            // Handle click to place signature field in document mode
                            if (mode === 'document' && isPlacingField && canvasRef.current) {
                              const rect = canvasRef.current.getBoundingClientRect();
                              const x = (e.clientX - rect.left) / zoom;
                              const y = (e.clientY - rect.top) / zoom;
                              
                              const newField = {
                                id: `sig-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                pageIndex: currentPage - 1,
                                x: Math.round(x),
                                y: Math.round(y),
                                width: 150,
                                height: 50,
                                label: `Signature ${documentSignatureFields.length + 1}`,
                              };
                              
                              setDocumentSignatureFields(prev => [...prev, newField]);
                              setFieldSignerAssignments(prev => ({
                                ...prev,
                                [newField.id]: signers[0]?.email || "",
                              }));
                              setIsPlacingField(false);
                            }
                          }}
                        />
                        
                        {/* Signature Field Overlays - Template Mode */}
                        {mode === 'template' && canvasRef.current && fieldBounds.size > 0 && canvasDisplaySize && (
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
                        
                        {/* Signature Field Overlays - Document Mode */}
                        {mode === 'document' && canvasRef.current && canvasDisplaySize && documentSignatureFields.length > 0 && (
                          <div
                            className="absolute top-0 left-0 pointer-events-none"
                            style={{
                              width: `${canvasDisplaySize.width}px`,
                              height: `${canvasDisplaySize.height}px`,
                            }}
                          >
                            {documentSignatureFields
                              .filter(f => f.pageIndex === currentPage - 1)
                              .map((field) => {
                                const assignedSignerEmail = fieldSignerAssignments[field.id];
                                const assignedSigner = signers.find(s => s.email === assignedSignerEmail);
                                const isSelected = selectedFieldId === field.id;
                                
                                return (
                                  <div
                                    key={field.id}
                                    className="absolute pointer-events-auto cursor-pointer"
                                    style={{
                                      left: `${field.x * zoom}px`,
                                      top: `${field.y * zoom}px`,
                                      width: `${field.width * zoom}px`,
                                      height: `${field.height * zoom}px`,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFieldId(isSelected ? null : field.id);
                                    }}
                                  >
                                    {/* Field border */}
                                    <div className={`absolute inset-0 border-2 rounded transition-all ${
                                      isSelected 
                                        ? 'border-green-500 bg-green-500/20 ring-2 ring-green-300' 
                                        : assignedSignerEmail 
                                          ? 'border-blue-500 bg-blue-500/10 border-dashed' 
                                          : 'border-red-500 bg-red-500/10 border-dashed'
                                    }`} />
                                    
                                    {/* Field label */}
                                    <div className={`absolute -top-6 left-0 rounded shadow-sm px-2 py-0.5 text-xs whitespace-nowrap ${
                                      isSelected
                                        ? 'bg-green-100 border border-green-300'
                                        : assignedSignerEmail 
                                          ? 'bg-blue-100 border border-blue-300' 
                                          : 'bg-red-100 border border-red-300'
                                    }`}>
                                      <span className="font-medium text-gray-800">
                                        {field.label}
                                      </span>
                                      {assignedSignerEmail && (
                                        <span className="text-blue-700 ml-1">
                                          - {assignedSigner?.name || assignedSignerEmail.split('@')[0]}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Delete button when selected */}
                                    {isSelected && (
                                      <button
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDocumentSignatureFields(prev => prev.filter(f => f.id !== field.id));
                                          const newAssignments = { ...fieldSignerAssignments };
                                          delete newAssignments[field.id];
                                          setFieldSignerAssignments(newAssignments);
                                          setSelectedFieldId(null);
                                        }}
                                        title="Remove field"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Field summary - Template Mode */}
                  {mode === 'template' && templateFields.length > 0 && (
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
                  
                  {/* Field summary - Document Mode */}
                  {mode === 'document' && (
                    <div className="bg-green-50 border-t border-green-200 px-3 py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-900">
                          <strong>{documentSignatureFields.filter(f => f.pageIndex === currentPage - 1).length}</strong> signature field(s) on this page
                        </span>
                        <span className={documentSignatureFields.length > 0 ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                          {documentSignatureFields.length} total field(s)
                        </span>
                      </div>
                      {documentSignatureFields.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Click &quot;Add Signature Field&quot; then click on the document to place signature fields.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (mode === 'template' && selectedTemplateId) || (mode === 'document' && selectedDocument) ? (
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading preview...</p>
                </div>
              ) : mode === 'document' ? (
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Document preview will appear here</p>
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
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {signers.filter((s) => s.email.trim() !== "").length} signer(s) added
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || sending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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







