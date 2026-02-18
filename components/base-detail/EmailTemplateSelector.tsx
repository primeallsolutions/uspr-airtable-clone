"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  ChevronDown,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { EmailTemplate } from "@/lib/types/base-detail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface EmailTemplateSelectorProps {
  workspaceId: string;
  selectedTemplateId?: string;
  onSelectTemplate: (template: EmailTemplate | null) => void;
  category?: string;
}

export const EmailTemplateSelector = ({
  workspaceId,
  selectedTemplateId,
  onSelectTemplate,
  category,
}: EmailTemplateSelectorProps) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch templates
  useEffect(() => {
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
        if (category) {
          url.searchParams.set("category", category);
        }

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

    if (workspaceId) {
      fetchTemplates();
    }
  }, [workspaceId, category]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.category || "general";
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, EmailTemplate[]>);

  const categoryLabels: Record<string, string> = {
    general: "General",
    "follow-up": "Follow-up",
    outreach: "Outreach",
    welcome: "Welcome",
    reminder: "Reminder",
    notification: "Notification",
    custom: "Custom",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading templates...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-red-600 text-sm">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-500 text-sm">
        <FileText className="w-4 h-4" />
        No templates available
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className={selectedTemplate ? "text-gray-900" : "text-gray-500"}>
            {selectedTemplate ? selectedTemplate.name : "Select a template..."}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* Clear selection option */}
            <button
              type="button"
              onClick={() => {
                onSelectTemplate(null);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
            >
              No template (write from scratch)
            </button>

            {/* Templates grouped by category */}
            {Object.entries(groupedTemplates).map(([cat, categoryTemplates]) => (
              <div key={cat}>
                <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {categoryLabels[cat] || cat}
                </div>
                {categoryTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onSelectTemplate(template);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors ${
                      selectedTemplateId === template.id
                        ? "bg-blue-50 border-l-2 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {template.name}
                          </span>
                          {template.is_default && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {template.subject}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
