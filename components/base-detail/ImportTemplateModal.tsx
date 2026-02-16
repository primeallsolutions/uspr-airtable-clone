"use client";

import { useState, useEffect } from "react";
import {
  X,
  ChevronDown,
  Loader2,
  FileText,
  CheckSquare,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DocumentTemplate, TemplateField } from "@/lib/services/template-service";
import type { ChecklistTemplate, ChecklistItem } from "@/lib/services/checklist-templates-service";

type Workspace = {
  id: string;
  name: string;
};

type Base = {
  id: string;
  name: string;
  workspace_id: string;
};

type ImportTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentBaseId: string;
  currentBaseName?: string;
  templateType: "documents" | "tasks"; // documents or checklist templates
  onImportSuccess: () => void;
};

type Template = DocumentTemplate | ChecklistTemplate;

export const ImportTemplateModal = ({
  isOpen,
  onClose,
  currentBaseId,
  currentBaseName = "Base",
  templateType,
  onImportSuccess,
}: ImportTemplateModalProps) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingBases, setLoadingBases] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load workspaces on modal open
  useEffect(() => {
    if (isOpen) {
      setSelectedWorkspaceId("");
      setSelectedBaseId("");
      setSelectedTemplateId(null);
      loadWorkspaces();
    }
  }, [isOpen]);

  // Load bases when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      loadBases();
    } else {
      setBases([]);
      setSelectedBaseId("");
    }
  }, [selectedWorkspaceId]);

  // Load templates when base changes
  useEffect(() => {
    if (selectedBaseId && selectedBaseId !== currentBaseId) {
      loadTemplates();
    } else {
      setTemplates([]);
      setSelectedTemplateId(null);
    }
  }, [selectedBaseId]);

  const loadWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.session?.access_token) {
        headers.Authorization = `Bearer ${session.session.access_token}`;
      }

      const response = await fetch(
        `/api/templates/import?action=get-workspaces`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load workspaces");
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      // Set first workspace as default (should be current workspace)
      if (data.workspaces && data.workspaces.length > 0) {
        setSelectedWorkspaceId(data.workspaces[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load workspaces", err);
      setError(err.message || "Failed to load workspaces");
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const loadBases = async () => {
    if (!selectedWorkspaceId) return;

    try {
      setLoadingBases(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.session?.access_token) {
        headers.Authorization = `Bearer ${session.session.access_token}`;
      }

      const response = await fetch(
        `/api/templates/import?action=get-bases&workspaceId=${selectedWorkspaceId}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load bases");
      }

      const data = await response.json();
      // Filter out current base
      const otherBases = (data.bases || []).filter(
        (b: Base) => b.id !== currentBaseId
      );
      setBases(otherBases);
      setSelectedBaseId("");
      setTemplates([]);
      setSelectedTemplateId(null);
    } catch (err: any) {
      console.error("Failed to load bases", err);
      setError(err.message || "Failed to load bases");
    } finally {
      setLoadingBases(false);
    }
  };

  const loadTemplates = async () => {
    if (!selectedBaseId) return;

    try {
      setLoadingTemplates(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.session?.access_token) {
        headers.Authorization = `Bearer ${session.session.access_token}`;
      }

      const type = templateType === "documents" ? "documents" : "tasks";
      const response = await fetch(
        `/api/templates/import?action=get-templates&baseId=${selectedBaseId}&type=${type}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load templates");
      }

      const data = await response.json();
      setTemplates(data.templates || []);
      setSelectedTemplateId(null);
    } catch (err: any) {
      console.error("Failed to load templates", err);
      setError(err.message || "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTemplateId) {
      setError("Please select a template to import");
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (session?.session?.access_token) {
        headers.Authorization = `Bearer ${session.session.access_token}`;
      }

      const response = await fetch("/api/templates/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sourceTemplateId: selectedTemplateId,
          targetBaseId: currentBaseId,
          type: templateType === "documents" ? "documents" : "tasks",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to import template");
      }

      const data = await response.json();
      setSuccessMessage(
        `Template "${data.template.name}" imported successfully!`
      );

      // Reset form
      setSelectedTemplateId(null);

      // Call callback after short delay
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to import template", err);
      setError(err.message || "Failed to import template");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId)
    : null;

  const isDocumentTemplate = (t: Template): t is DocumentTemplate =>
    "template_file_path" in t;
  const isChecklistTemplate = (t: Template): t is ChecklistTemplate =>
    "items" in t;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Import {templateType === "documents" ? "Template" : "Checklist"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Copy a {templateType === "documents" ? "template" : "checklist"} from another base to "{currentBaseName}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-900">Success</h3>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Workspace and Base Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Select Source</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Workspace Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace
                </label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  disabled={loadingWorkspaces || workspaces.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingWorkspaces ? "Loading..." : "Select workspace"}
                  </option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base
                </label>
                <div className="relative">
                  <select
                    value={selectedBaseId}
                    onChange={(e) => setSelectedBaseId(e.target.value)}
                    disabled={
                      !selectedWorkspaceId ||
                      loadingBases ||
                      bases.length === 0
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingBases
                        ? "Loading..."
                        : bases.length === 0
                          ? "No other bases available"
                          : "Select base"}
                    </option>
                    {bases.map((base) => (
                      <option key={base.id} value={base.id}>
                        {base.name}
                      </option>
                    ))}
                  </select>
                  {loadingBases && (
                    <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Templates List */}
          {selectedBaseId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Available{" "}
                  {templateType === "documents"
                    ? "Templates"
                    : "Checklists"}
                </h3>
                {loadingTemplates && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                )}
              </div>

              {templates.length === 0 && !loadingTemplates ? (
                <p className="text-sm text-gray-600 py-4 text-center">
                  No{" "}
                  {templateType === "documents"
                    ? "templates"
                    : "checklists"}{" "}
                  found in this base
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedTemplateId === template.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 pt-1">
                          {isDocumentTemplate(template) ? (
                            <FileText className="w-5 h-5 text-blue-600" />
                          ) : (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {template.name}
                          </h4>
                          {template.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          {isDocumentTemplate(template) &&
                            template.fields && (
                              <p className="text-xs text-gray-500 mt-2">
                                {template.fields.length} field
                                {template.fields.length !== 1 ? "s" : ""}
                              </p>
                            )}
                          {isChecklistTemplate(template) &&
                            template.items && (
                              <p className="text-xs text-gray-500 mt-2">
                                {template.items.length} item
                                {template.items.length !== 1 ? "s" : ""}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Preview</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedTemplate.name}
                    </p>
                  </div>
                  {selectedTemplate.description && (
                    <div>
                      <p className="text-sm text-gray-600">Description</p>
                      <p className="text-sm text-gray-900">
                        {selectedTemplate.description}
                      </p>
                    </div>
                  )}
                  {isDocumentTemplate(selectedTemplate) &&
                    selectedTemplate.fields &&
                    selectedTemplate.fields.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Fields ({selectedTemplate.fields.length})
                        </p>
                        <ul className="text-sm text-gray-900 space-y-1">
                          {selectedTemplate.fields.map((field) => (
                            <li key={field.id} className="text-xs">
                              • {field.field_name} ({field.field_type})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {isChecklistTemplate(selectedTemplate) &&
                    selectedTemplate.items &&
                    selectedTemplate.items.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Items ({selectedTemplate.items.length})
                        </p>
                        <ul className="text-sm text-gray-900 space-y-1">
                          {selectedTemplate.items.map((item) => (
                            <li key={item.id} className="text-xs">
                              • {item.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedTemplateId || importing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            Import
          </button>
        </div>
      </div>
    </div>
  );
};
