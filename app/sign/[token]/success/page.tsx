"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

export default function SignSuccessPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid token");
      setLoading(false);
      return;
    }

    // Fetch signer info to show confirmation
    const fetchSignerInfo = async () => {
      try {
        const response = await fetch(`/api/esignature/sign/${token}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load signer information");
        }

        const data = await response.json();
        setSigner(data.signer);
      } catch (err: any) {
        console.error("Failed to load signer info:", err);
        setError(err.message || "Failed to load information");
      } finally {
        setLoading(false);
      }
    };

    fetchSignerInfo();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Signed Successfully!</h1>
          <p className="text-gray-600">
            Thank you for signing the document.
          </p>
        </div>

        {signer && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Signed by:</span>{" "}
                <span className="text-gray-900">{signer.name || signer.email}</span>
              </div>
              {signer.signed_at && (
                <div>
                  <span className="font-medium text-gray-700">Signed on:</span>{" "}
                  <span className="text-gray-900">
                    {new Date(signer.signed_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8">
          <p className="text-sm text-gray-500 mb-4">
            You can safely close this page. The document has been saved and the requester has been notified.
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}



