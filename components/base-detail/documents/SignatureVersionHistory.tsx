"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, FileText, User, Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ESignatureService, SignatureVersion } from "@/lib/services/esign-service";
import { toast } from "sonner";

type SignatureVersionHistoryProps = {
  requestId: string;
};

export const SignatureVersionHistory = ({ requestId }: SignatureVersionHistoryProps) => {
  const [versions, setVersions] = useState<SignatureVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [requestId, loadVersions]);

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/esignature/requests/${requestId}/versions`, { headers });

      if (!response.ok) {
        throw new Error("Failed to load version history");
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (error: any) {
      console.error("Failed to load versions:", error);
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  const handleDownload = async (version: SignatureVersion) => {
    try {
      const { data: urlData, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(version.document_path, 3600);

      if (error || !urlData) {
        throw new Error("Failed to get document URL");
      }

      window.open(urlData.signedUrl, "_blank");
    } catch (error: any) {
      console.error("Failed to download version:", error);
      toast.error("Failed to download document");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No version history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Version History</h3>
      {versions.map((version) => (
        <div
          key={version.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">Version {version.version_number}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(version.created_at || "").toLocaleString()}
                  </span>
                </div>
                {version.change_description && (
                  <p className="text-sm text-gray-600 mb-2">{version.change_description}</p>
                )}
                <p className="text-xs text-gray-500 font-mono">{version.document_path}</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload(version)}
              className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Download this version"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};








