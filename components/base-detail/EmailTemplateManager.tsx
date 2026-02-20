"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Eye,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { EmailTemplate, EmailTemplateCategory } from "@/lib/types/base-detail";
import { SYSTEM_PLACEHOLDERS } from "@/lib/types/base-detail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface EmailTemplateManagerProps {
  workspaceId: string;
  onClose?: () => void;
}

const CATEGORIES: { value: EmailTemplateCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "follow-up", label: "Follow-up" },
  { value: "outreach", label: "Outreach" },
  { value: "welcome", label: "Welcome" },
  { value: "reminder", label: "Reminder" },
  { value: "notification", label: "Notification" },
  { value: "custom", label: "Custom" },
];

export const EmailTemplateManager = ({
  workspaceId,
  onClose,
}: EmailTemplateManagerProps) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory>("general");
  const [isDefault, setIsDefault] = useState(false);

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const url = new URL("/api/emails/templates", window.location.origin);
      url.searchParams.set("workspace_id", workspaceId);
      url.searchParams.set("active_only", "false");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Reset form
  const resetForm = () => {
    setName("");
    setSubject("");
    setBodyHtml("");
    setBodyText("");
    setCategory("general");
    setIsDefault(false);
    setEditingTemplate(null);
    setIsCreating(false);
    setPreviewMode(false);
  };

  // Start creating new template
  const startCreating = () => {
    resetForm();
    setIsCreating(true);
  };

  // Start editing template
  const startEditing = (template: EmailTemplate) => {
    setName(template.name);
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setBodyText(template.body_text || "");
    setCategory(template.category);
    setIsDefault(template.is_default);
    setEditingTemplate(template);
    setIsCreating(false);
    setPreviewMode(false);
  };

  // Save template
  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setError("Name, subject, and body are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const url = editingTemplate
        ? `/api/emails/templates/${editingTemplate.id}`
        : "/api/emails/templates";
      
      const method = editingTemplate ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: name.trim(),
        subject: subject.trim(),
        body_html: bodyHtml,
        body_text: bodyText.trim() || undefined,
        category,
        is_default: isDefault,
      };

      if (!editingTemplate) {
        body.workspace_id = workspaceId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save template");
      }

      await fetchTemplates();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (template: EmailTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/emails/templates/${template.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete template");
      }

      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  // Toggle template active status
  const toggleActive = async (template: EmailTemplate) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/emails/templates/${template.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_active: !template.is_active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update template");
      }

      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  // Get category badge color
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "follow-up":
        return "bg-blue-100 text-blue-700";
      case "outreach":
        return "bg-green-100 text-green-700";
      case "welcome":
        return "bg-purple-100 text-purple-700";
      case "reminder":
        return "bg-yellow-100 text-yellow-700";
      case "notification":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Extract placeholders used in template
  const extractPlaceholders = (content: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    return [...new Set(matches)];
  };

  const usedPlaceholders = extractPlaceholders(`${subject} ${bodyHtml}`);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Email Templates</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startCreating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Template List */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-700">No templates yet</p>
              <p className="text-sm mt-1">Create your first email template to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg transition-all cursor-pointer ${
                    editingTemplate?.id === template.id
                      ? "border-purple-300 bg-purple-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  } ${!template.is_active ? "opacity-60" : ""}`}
                  onClick={() => startEditing(template)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{template.name}</span>
                      {template.is_default && (
                        <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          Default
                        </span>
                      )}
                      {!template.is_active && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(template.category)}`}>
                      {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mb-2">{template.subject}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(template);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {template.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template);
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor Panel */}
        {(isCreating || editingTemplate) ? (
          <div className="w-1/2 flex flex-col overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-medium text-gray-700">
                {editingTemplate ? `Edit: ${editingTemplate.name}` : "New Template"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    previewMode
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !subject.trim() || !bodyHtml.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {previewMode ? (
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Subject:</div>
                    <div className="text-lg font-medium text-gray-900">{subject || "No subject"}</div>
                  </div>
                  <div className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">Body:</div>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>No content</p>" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Welcome Email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Category & Default */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as EmailTemplateCategory)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDefault}
                          onChange={(e) => setIsDefault(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Set as default</span>
                      </label>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email subject line"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Body HTML */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body (HTML)</label>
                    <textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      placeholder="Write your email content here..."
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>

                  {/* Body Text (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plain Text Version <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Plain text version for email clients that don't support HTML..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>

                  {/* Placeholders Used */}
                  {usedPlaceholders.length > 0 && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="text-sm font-medium text-purple-700 mb-2">Placeholders Used</div>
                      <div className="flex flex-wrap gap-2">
                        {usedPlaceholders.map((p) => (
                          <span
                            key={p}
                            className={`px-2 py-0.5 text-xs rounded ${
                              SYSTEM_PLACEHOLDERS.includes(p as typeof SYSTEM_PLACEHOLDERS[number])
                                ? "bg-green-100 text-green-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {`{{${p}}}`}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Green = System placeholders | Purple = Custom/Field placeholders
                      </p>
                    </div>
                  )}

                  {/* Available Placeholders */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">Available Placeholders</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {SYSTEM_PLACEHOLDERS.map((p) => (
                        <div key={p} className="text-gray-600">
                          <code className="bg-gray-100 px-1 rounded">{`{{${p}}}`}</code>
                        </div>
                      ))}
                      <div className="col-span-2 mt-2 text-gray-500">
                        Use <code className="bg-gray-100 px-1 rounded">{`{{field:FieldName}}`}</code> for record field values
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-1/2 flex flex-col items-center justify-center text-gray-500">
            <FileText className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">No template selected</p>
            <p className="text-sm mt-1">Select a template to edit or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};
