"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Mail, User, FileText, Loader2, Save, Send } from "lucide-react";
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
};

export const SignatureRequestModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  selectedDocument,
  onRequestCreated,
}: SignatureRequestModalProps) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [signers, setSigners] = useState<Array<{ email: string; name: string; role: "signer" | "viewer" | "approver"; sign_order: number }>>([
    { email: "", name: "", role: "signer", sign_order: 0 },
  ]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

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

      // Filter templates that have active signature fields (already included in API response)
      // Also log for debugging
      const templatesWithSignatures = templates
        .filter((template: any) => {
          const hasActive = template.hasActiveSignatureFields === true;
          if (!hasActive && template.fields?.some((f: any) => f.field_type === "signature")) {
            // Log templates with signature fields but not marked as active (for debugging)
            console.log("Template has signature fields but not active:", {
              templateId: template.id,
              templateName: template.name,
              signatureFields: template.fields?.filter((f: any) => f.field_type === "signature").map((f: any) => ({
                id: f.id,
                requires_esignature: f.requires_esignature,
                esignature_signer_email: f.esignature_signer_email
              }))
            });
          }
          return hasActive;
        })
        .map((template: any) => ({
          id: template.id,
          name: template.name,
          description: template.description
        }));

      console.log(`Found ${templatesWithSignatures.length} templates with active signature fields out of ${templates.length} total templates`);
      setAvailableTemplates(templatesWithSignatures);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates with signature fields");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

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

      // Get template signature fields to include in signature request
      const templateResponse = await fetch(`/api/templates/${selectedTemplateId}`, { headers });
      if (!templateResponse.ok) {
        throw new Error("Failed to load template fields");
      }
      const templateData = await templateResponse.json();
      const templateFields = (templateData.template?.fields || []).filter(
        (f: any) => f.field_type === "signature" && f.requires_esignature
      );

      // Map template fields to signature request fields
      // Assign all fields to the first signer (we can enhance this later to match by email)
      const signatureFields = templateFields.map((field: any) => ({
        signer_email: validSigners[0]?.email || "", // Assign to first signer
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

      // Get template signature fields to include in signature request
      const templateResponse = await fetch(`/api/templates/${selectedTemplateId}`, { headers });
      if (!templateResponse.ok) {
        throw new Error("Failed to load template fields");
      }
      const templateData = await templateResponse.json();
      const templateFields = (templateData.template?.fields || []).filter(
        (f: any) => f.field_type === "signature" && f.requires_esignature
      );

      // Map template fields to signature request fields
      // Assign all fields to the first signer (we can enhance this later to match by email)
      const signatureFields = templateFields.map((field: any) => ({
        signer_email: validSigners[0]?.email || "", // Assign to first signer
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
        toast.success("Signature request created and sent successfully!");
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
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
          {/* Template Selection */}
          <div className="mb-6">
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
                    Only templates with configured signature fields are shown. Create a template with signature fields to use this feature.
                  </p>
                )}
                {availableTemplates.length === 0 && !loading && (
                  <p className="text-xs text-yellow-600 mt-1">
                    No templates with signature fields found. Please create a template with e-signature fields configured.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Title */}
          <div className="mb-6">
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
          <div className="mb-6">
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
          <div className="mb-6">
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
                </div>
              ))}
            </div>
          </div>

          {/* Expiration */}
          <div className="mb-6">
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







