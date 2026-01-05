"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Clock, XCircle, Mail, Eye, FileText, Download, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ESignatureService, SignatureRequest } from "@/lib/services/esign-service";
import { toast } from "sonner";
import { PdfViewer } from "../PdfViewer";

type SignatureRequestStatusProps = {
  baseId: string;
  tableId?: string | null;
};

export const SignatureRequestStatus = ({
  baseId,
  tableId,
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
        `/api/esignature/requests?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Failed to load signature requests");
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error: any) {
      console.error("Failed to load signature requests:", error);
      toast.error("Failed to load signature requests");
    } finally {
      setLoading(false);
    }
  }, [baseId, tableId]);

  useEffect(() => {
    loadRequests();
    // Set up polling for real-time updates (poll every 5 seconds)
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [baseId, tableId, loadRequests]);

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

  const handleDownloadCertificate = async (request: SignatureRequest) => {
    if (!request.completion_certificate_path) {
      toast.error("Completion certificate not available");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if the path looks like a placeholder (contains "_certificate_" with timestamp)
      // This indicates the certificate hasn't been generated yet
      if (request.completion_certificate_path.includes("_certificate_")) {
        toast.info("Completion certificate generation is not yet implemented. The certificate will be available once this feature is completed.");
        return;
      }

      // Try to get signed URL for certificate
      const { data: urlData, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(request.completion_certificate_path, 3600);

      if (error) {
        // Check if it's a file not found error
        if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
          toast.info("Completion certificate file not found. It may still be generating.");
          return;
        }
        console.error("Certificate URL error:", error);
        toast.error("Failed to get certificate URL. The certificate may not be available yet.");
        return;
      }

      if (!urlData) {
        toast.error("Failed to get certificate URL");
        return;
      }

      // Download file
      window.open(urlData.signedUrl, "_blank");
    } catch (error: any) {
      console.error("Failed to download certificate:", error);
      toast.error(error.message || "Failed to download certificate");
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Signature Requests</h2>
        <button
          onClick={loadRequests}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
              <div className="flex items-start justify-between">
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
                  <div className="flex items-center gap-4 text-xs text-gray-500">
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
                <div className="flex items-center gap-2 ml-4">
                  {(request.status === "completed" || request.status === "in_progress") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSignedDocument(request);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Signed Document"
                    >
                      <Eye className="w-4 h-4" />
                      View Document
                    </button>
                  )}
                  {request.status === "completed" && request.completion_certificate_path && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadCertificate(request);
                      }}
                      disabled={request.completion_certificate_path.includes("_certificate_")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        request.completion_certificate_path.includes("_certificate_")
                          ? "Certificate generation not yet implemented"
                          : "Download Completion Certificate"
                      }
                    >
                      <Download className="w-4 h-4" />
                      Certificate
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {selectedRequest?.id === request.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Document:</span>
                      <span className="ml-2 text-gray-600">{request.document_path}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Request ID:</span>
                      <span className="ml-2 text-gray-600 font-mono text-xs">{request.id}</span>
                    </div>
                    {request.completion_certificate_path && (
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700">Completion Certificate:</span>
                        <span className="ml-2 text-gray-600">{request.completion_certificate_path}</span>
                      </div>
                    )}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
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








