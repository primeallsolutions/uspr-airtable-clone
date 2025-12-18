"use client";

import { useState, useEffect } from "react";
import { X, FileDown, Loader2, Type, Hash, Calendar, CheckSquare, PenTool } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DocumentTemplate, TemplateField } from "@/lib/services/template-service";
import { DocumentsService } from "@/lib/services/documents-service";

type DocumentGeneratorFormProps = {
  isOpen: boolean;
  onClose: () => void;
  template: DocumentTemplate | null;
  baseId: string;
  tableId?: string | null;
  onDocumentGenerated?: () => void;
};

export const DocumentGeneratorForm = ({
  isOpen,
  onClose,
  template,
  baseId,
  tableId,
  onDocumentGenerated,
}: DocumentGeneratorFormProps) => {
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState("");

  useEffect(() => {
    if (isOpen && template) {
      // Initialize field values with defaults
      const initialValues: Record<string, any> = {};
      if (template.fields) {
        template.fields.forEach((field) => {
          if (field.default_value) {
            initialValues[field.field_key] = field.default_value;
          } else {
            initialValues[field.field_key] = "";
          }
        });
      }
      setFieldValues(initialValues);
      setOutputFileName(template.name.replace(/\s+/g, "_") + "_filled.pdf");
      setError(null);
    }
  }, [isOpen, template]);

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleGenerate = async () => {
    if (!template) return;

    // Validate required fields
    const missingFields: string[] = [];
    if (template.fields) {
      template.fields.forEach((field) => {
        if (field.is_required && !fieldValues[field.field_key]) {
          missingFields.push(field.field_name);
        }
      });
    }

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(", ")}`);
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/templates/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          templateId: template.id,
          baseId,
          tableId: tableId || null,
          fieldValues,
          outputFileName: outputFileName || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate document");
      }

      const data = await response.json();

      // Convert base64 to blob and download
      const pdfBytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Optionally upload to storage
      const file = new File([blob], data.fileName, { type: "application/pdf" });
      await DocumentsService.uploadDocument({
        baseId,
        tableId: tableId || null,
        folderPath: "",
        file,
        preserveName: false,
      });

      if (onDocumentGenerated) {
        onDocumentGenerated();
      }

      onClose();
    } catch (err: any) {
      console.error("Failed to generate document", err);
      setError(err.message || "Failed to generate document");
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !template) return null;

  // Group fields by page
  const fieldsByPage = new Map<number, TemplateField[]>();
  if (template.fields) {
    template.fields.forEach((field) => {
      const page = field.page_number || 1;
      if (!fieldsByPage.has(page)) {
        fieldsByPage.set(page, []);
      }
      fieldsByPage.get(page)!.push(field);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Generate Document</h2>
            <p className="text-sm text-gray-600 mt-1">{template.name}</p>
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
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Output File Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output File Name
            </label>
            <input
              type="text"
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
              placeholder="document_filled.pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Fields by Page */}
          {Array.from(fieldsByPage.entries())
            .sort(([a], [b]) => a - b)
            .map(([pageNumber, pageFields]) => (
              <div key={pageNumber} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Page {pageNumber}
                </h3>
                <div className="space-y-4">
                  {pageFields.map((field) => (
                    <div key={field.id || field.field_key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.field_name}
                        {field.is_required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        {field.field_type === "text" && (
                          <Type className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "number" && (
                          <Hash className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "date" && (
                          <Calendar className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "checkbox" && (
                          <CheckSquare className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "signature" && (
                          <PenTool className="w-4 h-4 text-gray-400" />
                        )}
                        {field.field_type === "text" && (
                          <input
                            type="text"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                              handleFieldChange(field.field_key, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={field.default_value || ""}
                          />
                        )}
                        {field.field_type === "number" && (
                          <input
                            type="number"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                field.field_key,
                                e.target.value ? parseFloat(e.target.value) : ""
                              )
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={field.default_value || ""}
                          />
                        )}
                        {field.field_type === "date" && (
                          <input
                            type="date"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                              handleFieldChange(field.field_key, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        )}
                        {field.field_type === "checkbox" && (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={fieldValues[field.field_key] === true || fieldValues[field.field_key] === "true" || fieldValues[field.field_key] === "1"}
                              onChange={(e) =>
                                handleFieldChange(field.field_key, e.target.checked)
                              }
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">
                              {fieldValues[field.field_key] ? "Yes" : "No"}
                            </span>
                          </div>
                        )}
                        {field.field_type === "signature" && (
                          <input
                            type="text"
                            value={fieldValues[field.field_key] || ""}
                            onChange={(e) =>
                              handleFieldChange(field.field_key, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter signature name"
                          />
                        )}
                      </div>
                      {field.default_value && (
                        <p className="text-xs text-gray-500 mt-1">
                          Default: {field.default_value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {template.fields?.filter((f) => f.is_required).length || 0} required field(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Generate & Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

