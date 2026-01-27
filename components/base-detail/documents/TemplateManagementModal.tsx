"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, Upload, Trash2, Edit2, Plus, Loader2, Settings, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DocumentTemplate } from "@/lib/services/template-service";

type TemplateManagementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  onTemplateSelect?: (template: DocumentTemplate) => void;
  onEditFields?: (template: DocumentTemplate) => void;
};

export const TemplateManagementModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  onTemplateSelect,
  onEditFields,
}: TemplateManagementModalProps) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(
        `/api/templates?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`,
        { headers }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load templates");
      }
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      console.error("Failed to load templates", err);
      setError(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, loadTemplates]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleUpload = async () => {
    if (!templateName.trim() || !selectedFile) {
      setError("Please provide a template name and select a PDF file");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are supported");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("baseId", baseId);
      if (tableId) formData.append("tableId", tableId);
      formData.append("name", templateName.trim());
      if (templateDescription) formData.append("description", templateDescription);
      formData.append("file", selectedFile);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/templates", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload template");
      }

      const result = await response.json();
      console.log("Template uploaded successfully:", result);

      // Reset form
      setTemplateName("");
      setTemplateDescription("");
      setSelectedFile(null);
      setShowUploadForm(false);
      setSuccessMessage("Template uploaded successfully!");

      // Reload templates immediately
      await loadTemplates();
    } catch (err: any) {
      console.error("Failed to upload template", err);
      setError(err.message || "Failed to upload template");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!window.confirm("Are you sure you want to delete this template? This cannot be undone.")) {
      return;
    }

    setDeletingId(templateId);
    setError(null);
    try {
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `/api/templates?templateId=${templateId}&baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`,
        { 
          method: "DELETE",
          headers
        }
      );

      // Handle error responses
      if (!response.ok) {
        // Check if response has JSON content
        const contentType = response.headers.get("content-type");
        let errorMessage = `Failed to delete template: ${response.status} ${response.statusText}`;
        
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            if (errorData.details) {
              console.error("Delete template error details:", errorData.details);
            }
            if (errorData.code) {
              console.error("Delete template error code:", errorData.code);
            }
          } catch (jsonError) {
            // If JSON parsing fails, try to get text
            try {
              const text = await response.text();
              if (text) {
                errorMessage = text;
              }
            } catch (textError) {
              // Use default error message
              console.error("Failed to parse error response:", textError);
            }
          }
        } else {
          // Try to get text response
          try {
            const text = await response.text();
            if (text) {
              errorMessage = text;
            }
          } catch (textError) {
            // Use default error message
            console.error("Failed to read error response:", textError);
          }
        }
        
        throw new Error(errorMessage);
      }
      
      // Success - no need to parse response body
      setSuccessMessage("Template deleted successfully!");
      await loadTemplates();
    } catch (err: any) {
      console.error("Failed to delete template", err);
      setError(err.message || "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      if (!showUploadForm) {
        setShowUploadForm(true);
      }
    } else if (file) {
      setError("Only PDF files are supported");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Document Templates</h2>
            <p className="text-sm text-gray-600">Manage your PDF templates and field mappings</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/70 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-800 font-medium">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 hover:text-green-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Form */}
          {showUploadForm && (
            <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl space-y-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Upload New Template</h3>
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setTemplateName("");
                    setTemplateDescription("");
                    setSelectedFile(null);
                    setError(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Purchase Agreement"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Brief description of this template..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDF File *
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${
                      dragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 bg-white hover:border-blue-400"
                    }`}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      {selectedFile ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PDF files only, up to 10MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !templateName.trim() || !selectedFile}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload Template
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadForm(false);
                      setTemplateName("");
                      setTemplateDescription("");
                      setSelectedFile(null);
                      setError(null);
                    }}
                    disabled={uploading}
                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Templates List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Get started by uploading your first PDF template. You can then map fields and generate documents.
              </p>
              <button
                onClick={() => setShowUploadForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Create Your First Template
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => onTemplateSelect?.(template)}
                  className="group p-5 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200 bg-white cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {template.name}
                        </h3>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 mb-3 ml-11">{template.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 ml-11">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                          {new Date(template.created_at).toLocaleDateString()}
                        </span>
                        {template.fields && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                            {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-4" onClick={(e) => e.stopPropagation()}>
                      {onEditFields && (
                        <button
                          onClick={() => {
                            onEditFields(template);
                          }}
                          className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all hover:scale-110 active:scale-95"
                          title="Edit template fields"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deletingId === template.id}
                        className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        title="Delete template"
                      >
                        {deletingId === template.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

