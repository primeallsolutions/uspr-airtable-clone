"use client";

import { EmbeddedSigningUI } from "@/components/base-detail/documents/EmbeddedSigningUI";
import { useParams } from "next/navigation";

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600">The signing link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return <EmbeddedSigningUI token={token} />;
}










