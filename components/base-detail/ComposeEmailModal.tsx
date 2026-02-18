"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  Mail,
  User,
  FileText,
  Sparkles,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { RecordEmail, EmailTemplate, FieldRow } from "@/lib/types/base-detail";
import { EmailTemplateSelector } from "./EmailTemplateSelector";
import { EmailAttachmentPicker } from "./EmailAttachmentPicker";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string;
  recipientEmail?: string;
  recipientName?: string;
  replyToEmail?: RecordEmail | null;
  onEmailSent?: () => void;
  workspaceId?: string;
  recordValues?: Record<string, unknown>;
  fields?: FieldRow[];
}

export const ComposeEmailModal = ({
  isOpen,
  onClose,
  recordId,
  recipientEmail = "",
  recipientName = "",
  replyToEmail,
  onEmailSent,
  workspaceId,
  recordValues,
  fields,
}: ComposeEmailModalProps) => {
  const [to, setTo] = useState(recipientEmail);
  const [toName, setToName] = useState(recipientName);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Template and attachment state
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setSelectedTemplate(null);
      setAttachmentIds([]);
      
      if (replyToEmail) {
        // Populate reply fields
        setTo(replyToEmail.from_email);
        setToName(replyToEmail.from_name || "");
        setSubject(
          replyToEmail.subject?.startsWith("Re:")
            ? replyToEmail.subject
            : `Re: ${replyToEmail.subject || ""}`
        );
        setBody(
          `\n\n---\nOn ${new Date(replyToEmail.created_at).toLocaleString()}, ${
            replyToEmail.from_name || replyToEmail.from_email
          } wrote:\n\n${replyToEmail.body_text || ""}`.trim()
        );
      } else {
        setTo(recipientEmail);
        setToName(recipientName);
        setSubject("");
        setBody("");
      }
    }
  }, [isOpen, replyToEmail, recipientEmail, recipientName]);

  // Handle template selection
  const handleTemplateSelect = (template: EmailTemplate | null) => {
    setSelectedTemplate(template);
    
    if (template) {
      // Apply template content with placeholder resolution
      let resolvedSubject = template.subject;
      let resolvedBody = template.body_text || template.body_html.replace(/<[^>]*>/g, "");
      
      // Resolve system placeholders
      const placeholderValues: Record<string, string> = {
        record_name: recipientName || "",
        record_email: recipientEmail || "",
        record_id: recordId,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        sender_name: "US Prime Realty",
        company_name: "US Prime Realty",
      };

      // Resolve field placeholders from record values
      if (recordValues && fields) {
        fields.forEach((field) => {
          const value = recordValues[field.id];
          if (value !== undefined && value !== null) {
            placeholderValues[`field:${field.name}`] = String(value);
          }
        });
      }

      // Replace placeholders
      Object.entries(placeholderValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        resolvedSubject = resolvedSubject.replace(regex, value);
        resolvedBody = resolvedBody.replace(regex, value);
      });

      setSubject(resolvedSubject);
      setBody(resolvedBody);
    }
  };

  // Focus on subject or body when modal opens
  useEffect(() => {
    if (isOpen && bodyRef.current) {
      setTimeout(() => {
        if (replyToEmail) {
          bodyRef.current?.focus();
          bodyRef.current?.setSelectionRange(0, 0);
        }
      }, 100);
    }
  }, [isOpen, replyToEmail]);

  const handleSend = async () => {
    // Validate fields
    if (!to.trim() || !to.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    if (!body.trim()) {
      setError("Please enter a message");
      return;
    }

    try {
      setSending(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Generate HTML from body
      const bodyHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
          ${body.split("\n").map(line => `<p style="margin: 0 0 1em;">${line || "&nbsp;"}</p>`).join("")}
        </div>
      `;

      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          record_id: recordId,
          to: to.trim(),
          to_name: toName.trim() || undefined,
          subject: subject.trim(),
          body_html: bodyHtml,
          body_text: body.trim(),
          in_reply_to: replyToEmail?.message_id,
          template_id: selectedTemplate?.id,
          attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      setSuccess(true);
      setTimeout(() => {
        onEmailSent?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {replyToEmail ? "Reply to Email" : "Compose Email"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              Email Sent Successfully!
            </h4>
            <p className="text-gray-500">Your email has been sent.</p>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Template Selector - Only show if workspace ID is provided and not a reply */}
              {workspaceId && !replyToEmail && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    Email Template
                  </label>
                  <EmailTemplateSelector
                    workspaceId={workspaceId}
                    selectedTemplateId={selectedTemplate?.id}
                    onSelectTemplate={handleTemplateSelect}
                  />
                </div>
              )}

              {/* To Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  To
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="recipient@email.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={sending}
                    />
                  </div>
                  <div className="relative w-48">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={toName}
                      onChange={(e) => setToName(e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={sending}
                    />
                  </div>
                </div>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sending}
                  />
                </div>
              </div>

              {/* Body Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Message
                </label>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message here..."
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={sending}
                />
              </div>

              {/* Attachment Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Attachments
                </label>
                <EmailAttachmentPicker
                  recordId={recordId}
                  selectedIds={attachmentIds}
                  onSelectionChange={setAttachmentIds}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Replies will be tracked in this record.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  disabled={sending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
