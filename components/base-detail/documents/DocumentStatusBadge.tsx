"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  PenTool,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  Loader2,
} from "lucide-react";

export type DocumentStatus = 
  | "draft"           // Recently uploaded, no actions taken
  | "edited"          // Has been edited/annotated
  | "pending_signature" // Waiting for signatures
  | "partially_signed"  // Some signers have signed
  | "signed"          // All signatures collected
  | "declined"        // Signature request declined
  | "expired";        // Signature request expired

export type DocumentStatusInfo = {
  status: DocumentStatus;
  label: string;
  description?: string;
  signersTotal?: number;
  signersSigned?: number;
  expiresAt?: string;
};

// Status configuration
const STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  draft: {
    label: "Draft",
    icon: <FileText className="w-3 h-3" />,
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-200",
    dotColor: "bg-gray-400",
  },
  edited: {
    label: "Edited",
    icon: <Edit3 className="w-3 h-3" />,
    bgColor: "bg-cyan-50",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-200",
    dotColor: "bg-cyan-500",
  },
  pending_signature: {
    label: "Pending Signature",
    icon: <Clock className="w-3 h-3" />,
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    dotColor: "bg-purple-500",
  },
  partially_signed: {
    label: "Partially Signed",
    icon: <PenTool className="w-3 h-3" />,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    dotColor: "bg-blue-500",
  },
  signed: {
    label: "Signed",
    icon: <CheckCircle2 className="w-3 h-3" />,
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  declined: {
    label: "Declined",
    icon: <XCircle className="w-3 h-3" />,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    dotColor: "bg-red-500",
  },
  expired: {
    label: "Expired",
    icon: <AlertTriangle className="w-3 h-3" />,
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    dotColor: "bg-amber-500",
  },
};

type DocumentStatusBadgeProps = {
  status: DocumentStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
  signersProgress?: { signed: number; total: number };
};

export function DocumentStatusBadge({
  status,
  size = "sm",
  showLabel = true,
  showIcon = true,
  className = "",
  signersProgress,
}: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  const sizeClasses = size === "sm" 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-medium border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${sizeClasses} ${className}
      `}
      title={signersProgress 
        ? `${signersProgress.signed} of ${signersProgress.total} signed`
        : config.label
      }
    >
      {showIcon && config.icon}
      {showLabel && (
        <span>
          {config.label}
          {signersProgress && status === "partially_signed" && (
            <span className="ml-0.5 opacity-80">
              ({signersProgress.signed}/{signersProgress.total})
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// Simple dot indicator for compact views
export function DocumentStatusDot({
  status,
  className = "",
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span 
      className={`w-2 h-2 rounded-full ${config.dotColor} ${className}`}
      title={config.label}
    />
  );
}

// Hook to get document status from signature requests
type UseDocumentStatusOptions = {
  documentPath: string;
  baseId: string;
  tableId?: string | null;
};

export function useDocumentStatus({ documentPath, baseId, tableId }: UseDocumentStatusOptions) {
  const [status, setStatus] = useState<DocumentStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        // For now, return draft status - this would be expanded to check signature_requests table
        // In a full implementation, this would query:
        // 1. signature_requests table for pending/completed signatures
        // 2. document_versions table for edit history
        setStatus({
          status: "draft",
          label: "Draft",
        });
      } catch (err) {
        console.error("Failed to fetch document status:", err);
        setError("Failed to load status");
      } finally {
        setLoading(false);
      }
    };

    if (documentPath && baseId) {
      fetchStatus();
    }
  }, [documentPath, baseId, tableId]);

  return { status, loading, error };
}

// Utility to determine status from signature request data
export function getStatusFromSignatureRequest(request: {
  status: string;
  signers?: Array<{ status: string }>;
  expires_at?: string | null;
}): DocumentStatusInfo {
  const now = new Date();
  
  // Check if expired
  if (request.expires_at && new Date(request.expires_at) < now) {
    return { status: "expired", label: "Expired" };
  }
  
  // Check request status
  if (request.status === "completed") {
    return { status: "signed", label: "Signed" };
  }
  
  if (request.status === "declined") {
    return { status: "declined", label: "Declined" };
  }
  
  // Check signers progress
  if (request.signers && request.signers.length > 0) {
    const signedCount = request.signers.filter(s => s.status === "signed").length;
    const totalCount = request.signers.length;
    
    if (signedCount > 0 && signedCount < totalCount) {
      return {
        status: "partially_signed",
        label: "Partially Signed",
        signersTotal: totalCount,
        signersSigned: signedCount,
      };
    }
  }
  
  return { status: "pending_signature", label: "Pending Signature" };
}


