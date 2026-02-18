"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Clock,
  Trash2,
  MailPlus,
  Eye,
  MousePointer,
  CheckCircle,
  XCircle,
  Paperclip,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { RecordEmail, FieldRow } from "@/lib/types/base-detail";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";
import { ComposeEmailModal } from "./ComposeEmailModal";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RecordEmailsProps {
  recordId: string;
  recordName?: string;
  recordValues?: Record<string, unknown>;
  fields?: FieldRow[];
  workspaceId?: string;
}

type FilterType = "all" | "inbound" | "outbound";

export const RecordEmails = ({
  recordId,
  recordName,
  recordValues,
  fields,
  workspaceId,
}: RecordEmailsProps) => {
  const { timezone } = useTimezone();
  const [emails, setEmails] = useState<RecordEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [recordEmailAddress, setRecordEmailAddress] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<RecordEmail | null>(null);

  // Find email field value from record
  const recipientEmail = fields?.find(
    (f) => f.type === "email" || f.name.toLowerCase().includes("email")
  )?.id
    ? String(recordValues?.[
        fields.find((f) => f.type === "email" || f.name.toLowerCase().includes("email"))!.id
      ] || "")
    : "";

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const url = new URL(`/api/emails/record/${recordId}`, window.location.origin);
      if (filter !== "all") {
        url.searchParams.set("direction", filter);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }

      const data = await response.json();
      setEmails(data.emails || []);
      setRecordEmailAddress(data.record_email_address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [recordId, filter]);

  // Fetch record email address
  const fetchEmailAddress = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/emails/address/${recordId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRecordEmailAddress(data.email_address);
      }
    } catch (err) {
      console.error("Failed to fetch email address:", err);
    }
  }, [recordId]);

  useEffect(() => {
    fetchEmails();
    fetchEmailAddress();
  }, [fetchEmails, fetchEmailAddress]);

  // Copy email address to clipboard
  const copyEmailAddress = async () => {
    if (!recordEmailAddress) return;
    
    try {
      await navigator.clipboard.writeText(recordEmailAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle reply to email
  const handleReply = (email: RecordEmail) => {
    setReplyToEmail(email);
    setShowComposeModal(true);
  };

  // Handle delete email
  const handleDelete = async (emailId: string) => {
    if (!confirm("Are you sure you want to delete this email?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `/api/emails/record/${recordId}?email_id=${emailId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        setEmails((prev) => prev.filter((e) => e.id !== emailId));
      }
    } catch (err) {
      console.error("Failed to delete email:", err);
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
      case "opened":
      case "clicked":
        return "bg-green-100 text-green-700";
      case "sent":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
      case "bounced":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Render tracking indicators for outbound emails
  const renderTrackingIndicators = (email: RecordEmail) => {
    if (email.direction !== "outbound") return null;

    const indicators = [];

    // Delivered indicator
    if (["delivered", "opened", "clicked"].includes(email.status)) {
      indicators.push(
        <div key="delivered" className="flex items-center gap-1 text-green-600" title="Delivered">
          <CheckCircle className="w-3.5 h-3.5" />
        </div>
      );
    } else if (email.status === "bounced") {
      indicators.push(
        <div key="bounced" className="flex items-center gap-1 text-red-600" title="Bounced">
          <XCircle className="w-3.5 h-3.5" />
        </div>
      );
    }

    // Opened indicator
    if (email.opened_at) {
      indicators.push(
        <div 
          key="opened" 
          className="flex items-center gap-1 text-purple-600" 
          title={`Opened ${email.open_count || 1} time(s)`}
        >
          <Eye className="w-3.5 h-3.5" />
          {(email.open_count || 0) > 1 && (
            <span className="text-xs font-medium">{email.open_count}</span>
          )}
        </div>
      );
    }

    // Clicked indicator
    if (email.clicked_at) {
      indicators.push(
        <div 
          key="clicked" 
          className="flex items-center gap-1 text-blue-600" 
          title={`Clicked ${email.click_count || 1} time(s)`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          {(email.click_count || 0) > 1 && (
            <span className="text-xs font-medium">{email.click_count}</span>
          )}
        </div>
      );
    }

    // Attachment indicator
    if (email.attachment_count && email.attachment_count > 0) {
      indicators.push(
        <div 
          key="attachments" 
          className="flex items-center gap-1 text-gray-500" 
          title={`${email.attachment_count} attachment(s)`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span className="text-xs">{email.attachment_count}</span>
        </div>
      );
    }

    if (indicators.length === 0) return null;

    return (
      <div className="flex items-center gap-2 ml-2">
        {indicators}
      </div>
    );
  };

  // Filter counts
  const inboundCount = emails.filter((e) => e.direction === "inbound").length;
  const outboundCount = emails.filter((e) => e.direction === "outbound").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Email Address */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Record Email Address</h3>
          </div>
          <button
            onClick={() => setShowComposeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <MailPlus className="w-4 h-4" />
            Compose Email
          </button>
        </div>
        
        {recordEmailAddress ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm font-mono text-gray-700 truncate">
              {recordEmailAddress}
            </code>
            <button
              onClick={copyEmailAddress}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              title="Copy email address"
            >
              {copiedAddress ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading email address...</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Send emails to this address to have them appear in this record.
        </p>
      </div>

      {/* Filter Tabs and Refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All ({emails.length})
          </button>
          <button
            onClick={() => setFilter("inbound")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "inbound"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Received ({inboundCount})
          </button>
          <button
            onClick={() => setFilter("outbound")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "outbound"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Sent ({outboundCount})
          </button>
        </div>

        <button
          onClick={fetchEmails}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p>Loading emails...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-red-500">
            <AlertCircle className="w-8 h-8 mb-3" />
            <p>{error}</p>
            <button
              onClick={fetchEmails}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Mail className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">No emails yet</p>
            <p className="text-sm mt-1">
              Send an email to the record address above, or compose a new email.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`border rounded-xl transition-all ${
                  expandedEmailId === email.id
                    ? "border-blue-300 shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Email Header */}
                <button
                  onClick={() =>
                    setExpandedEmailId(
                      expandedEmailId === email.id ? null : email.id
                    )
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    {/* Direction Icon */}
                    <div
                      className={`p-2 rounded-lg ${
                        email.direction === "inbound"
                          ? "bg-green-100"
                          : "bg-blue-100"
                      }`}
                    >
                      {email.direction === "inbound" ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-blue-600" />
                      )}
                    </div>

                    {/* Email Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {email.direction === "inbound"
                            ? email.from_name || email.from_email
                            : email.to_name || email.to_email}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                            email.status
                          )}`}
                        >
                          {email.status}
                        </span>
                        {/* Tracking indicators */}
                        {renderTrackingIndicators(email)}
                      </div>
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {email.subject || "(No subject)"}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {email.body_text?.substring(0, 100) || "No preview available"}
                        {(email.body_text?.length || 0) > 100 ? "..." : ""}
                      </p>
                    </div>

                    {/* Timestamp & Expand */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatInTimezone(email.created_at, timezone, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      {expandedEmailId === email.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedEmailId === email.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="pt-4 space-y-3">
                      {/* Email Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">From:</span>
                          <span className="ml-2 text-gray-900">
                            {email.from_name
                              ? `${email.from_name} <${email.from_email}>`
                              : email.from_email}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">To:</span>
                          <span className="ml-2 text-gray-900">
                            {email.to_name
                              ? `${email.to_name} <${email.to_email}>`
                              : email.to_email}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Date:</span>
                          <span className="ml-2 text-gray-900">
                            {formatInTimezone(email.created_at, timezone, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <span
                            className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                              email.status
                            )}`}
                          >
                            {email.status}
                          </span>
                        </div>
                      </div>

                      {/* Tracking Details for Outbound Emails */}
                      {email.direction === "outbound" && (email.opened_at || email.clicked_at) && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Tracking Information</h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {email.opened_at && (
                              <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4 text-purple-600" />
                                <div>
                                  <span className="text-gray-500">First opened:</span>
                                  <span className="ml-1 text-gray-900">
                                    {formatInTimezone(email.opened_at, timezone, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {email.open_count && email.open_count > 1 && (
                                    <span className="ml-1 text-gray-500">
                                      ({email.open_count} total opens)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {email.clicked_at && (
                              <div className="flex items-center gap-2">
                                <MousePointer className="w-4 h-4 text-blue-600" />
                                <div>
                                  <span className="text-gray-500">First click:</span>
                                  <span className="ml-1 text-gray-900">
                                    {formatInTimezone(email.clicked_at, timezone, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {email.click_count && email.click_count > 1 && (
                                    <span className="ml-1 text-gray-500">
                                      ({email.click_count} total clicks)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Email Body */}
                      <div className="border-t border-gray-100 pt-4">
                        {email.body_html ? (
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: email.body_html }}
                          />
                        ) : (
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {email.body_text || "No content"}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        {email.direction === "inbound" && (
                          <button
                            onClick={() => handleReply(email)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Send className="w-4 h-4" />
                            Reply
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(email.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={showComposeModal}
        onClose={() => {
          setShowComposeModal(false);
          setReplyToEmail(null);
        }}
        recordId={recordId}
        recipientEmail={recipientEmail}
        recipientName={recordName}
        replyToEmail={replyToEmail}
        onEmailSent={() => {
          setShowComposeModal(false);
          setReplyToEmail(null);
          fetchEmails();
        }}
        workspaceId={workspaceId}
        recordValues={recordValues}
        fields={fields}
      />
    </div>
  );
};
