"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, XCircle, Mail, Eye, FileText, Loader2, RefreshCw, X, Trash2, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ESignatureService, SignatureRequest } from "@/lib/services/esign-service";
import { toast } from "sonner";
import { PdfViewer } from "../PdfViewer";

type SignatureRequestStatusProps = {
  baseId: string;
  tableId?: string | null;
  recordId?: string | null;
};

export const SignatureRequestStatus = ({
  baseId,
  tableId,
  recordId,
}: SignatureRequestStatusProps) => {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ requestId: string; documentUrl: string; title: string } | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `/api/esignature/requests?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}${recordId ? `&recordId=${recordId}` : ""}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Failed to load signature requests");
      }

      const data = await response.json();
      // Filter by recordId if provided
      const allRequests = data.requests || [];
      const filteredRequests = recordId 
        ? allRequests.filter((req: SignatureRequest) => req.record_id === recordId)
        : allRequests;
      setRequests(filteredRequests);
    } catch (error: any) {
      console.error("Failed to load signature requests:", error);
      toast.error("Failed to load signature requests");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId, recordId]);

  useEffect(() => {
    loadRequests();
    // Set up polling for real-time updates (poll every 5 seconds)
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [baseId, tableId, recordId, loadRequests]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "in_progress":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "sent":
        return <Mail className="w-5 h-5 text-blue-500" />;
      case "declined":
      case "cancelled":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "sent":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "declined":
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSignerStatusIcon = (status: string) => {
    switch (status) {
      case "signed":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "viewed":
        return <Eye className="w-4 h-4 text-blue-600" />;
      case "sent":
        return <Mail className="w-4 h-4 text-blue-500" />;
      case "declined":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleDeleteRequest = async (request: SignatureRequest) => {
    if (!request.id) {
      toast.error("Invalid request");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the signature request "${request.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/esignature/requests/${request.id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete signature request");
      }

      toast.success("Signature request deleted successfully");
      await loadRequests();
    } catch (error: any) {
      console.error("Failed to delete signature request:", error);
      toast.error(error.message || "Failed to delete signature request");
    }
  };

  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);

  const handleSendRequest = async (request: SignatureRequest) => {
    if (!request.id) {
      toast.error("Invalid request");
      return;
    }

    if (!request.signers || request.signers.length === 0) {
      toast.error("No signers added to this request");
      return;
    }

    try {
      setSendingRequestId(request.id);
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/esignature/requests/${request.id}/send`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send signature request");
      }

      const data = await response.json();
      
      if (data.emailsFailed > 0 && data.emailsSent > 0) {
        toast.warning(`Sent ${data.emailsSent} email(s), but ${data.emailsFailed} failed`);
      } else {
        toast.success(`Signature request sent to ${data.emailsSent || request.signers.length} signer(s)`);
      }
      
      await loadRequests();
    } catch (error: any) {
      console.error("Failed to send signature request:", error);
      toast.error(error.message || "Failed to send signature request");
    } finally {
      setSendingRequestId(null);
    }
  };

  const handleViewSignedDocument = async (request: SignatureRequest) => {
    if (!request.id) {
      toast.error("Invalid request");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/esignature/requests/${request.id}/view`, { headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get document URL");
      }

      const data = await response.json();
      setViewingDocument({
        requestId: request.id!,
        documentUrl: data.documentUrl,
        title: data.title || request.title,
      });
    } catch (error: any) {
      console.error("Failed to view signed document:", error);
      toast.error(error.message || "Failed to view signed document");
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Signature Requests</h3>
        <p className="text-gray-600">Create a signature request to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Signature Requests</h2>
        <button
          onClick={loadRequests}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {requests.map((request) => {
          const completedSigners = request.signers?.filter((s) => s.status === "signed").length || 0;
          const totalSigners = request.signers?.length || 0;
          const progress = totalSigners > 0 ? (completedSigners / totalSigners) * 100 : 0;

          return (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedRequest(selectedRequest?.id === request.id ? null : request)}
            >
              <div className="flex items-start justify-between gap-3 flex-col sm:flex-row sm:items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(request.status || "draft")}
                    <h3 className="text-lg font-semibold text-gray-900">{request.title}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                        request.status || "draft"
                      )}`}
                    >
                      {request.status || "draft"}
                    </span>
                  </div>

                  {request.message && (
                    <p className="text-sm text-gray-600 mb-3">{request.message}</p>
                  )}

                  {/* Progress Bar */}
                  {totalSigners > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>
                          {completedSigners} of {totalSigners} signers completed
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Signers List */}
                  {request.signers && request.signers.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {request.signers.map((signer) => (
                        <div
                          key={signer.id}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          {getSignerStatusIcon(signer.status || "pending")}
                          <span>{signer.name || signer.email}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-500 capitalize">
                            {signer.status || "pending"}
                          </span>
                          {signer.signed_at && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-xs text-gray-500">
                                {new Date(signer.signed_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-col gap-2 text-xs text-gray-500">
                    <span>
                      Created: {new Date(request.created_at || "").toLocaleDateString()}
                    </span>
                    {request.completed_at && (
                      <span>
                        Completed: {new Date(request.completed_at).toLocaleDateString()}
                      </span>
                    )}
                    {request.expires_at && (
                      <span>
                        Expires: {new Date(request.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap justify-end">
                  {/* Send button for draft requests */}
                  {request.status === "draft" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendRequest(request);
                      }}
                      disabled={sendingRequestId === request.id}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Send Signature Request"
                    >
                      {sendingRequestId === request.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send
                        </>
                      )}
                    </button>
                  )}
                  {(request.status === "completed" || request.status === "in_progress") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSignedDocument(request);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Signed Document"
                    >
                      <Eye className="w-4 h-4" />
                      View Document
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRequest(request);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Signature Request"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedRequest?.id === request.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Document:</span>
                      <span className="ml-2 text-gray-600">{request.document_path}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Request ID:</span>
                      <span className="ml-2 text-gray-600 font-mono text-xs">{request.id}</span>
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Document Viewer Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {viewingDocument.title}
                </h2>
              </div>
              <button
                onClick={() => setViewingDocument(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <PdfViewer fileUrl={viewingDocument.documentUrl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};








