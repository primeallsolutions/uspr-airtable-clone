/**
 * Signer Panel
 * Integrated panel for managing signers and sending signature requests
 * directly from the PDF Editor
 */

"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Plus,
  Trash2,
  Send,
  Loader2,
  ChevronRight,
  ChevronDown,
  Mail,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { SignatureFieldAnnotation } from "../types";

export interface Signer {
  id: string;
  email: string;
  name: string;
  role: "signer" | "viewer" | "approver";
  status?: "pending" | "sent" | "signed" | "declined";
}

interface SignerPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  signatureFields: SignatureFieldAnnotation[];
  signers: Signer[];
  onSignersChange: (signers: Signer[]) => void;
  fieldAssignments: Record<string, string>; // fieldId -> signerId
  onFieldAssignmentChange: (fieldId: string, signerId: string) => void;
  onSendRequest: () => void;
  isSending?: boolean;
  requestStatus?: "draft" | "sent" | "completed" | "declined" | null;
  documentName?: string;
}

export function SignerPanel({
  isOpen,
  onToggle,
  signatureFields,
  signers,
  onSignersChange,
  fieldAssignments,
  onFieldAssignmentChange,
  onSendRequest,
  isSending = false,
  requestStatus,
  documentName,
}: SignerPanelProps) {
  const [expandedSigners, setExpandedSigners] = useState<Set<string>>(new Set());

  const addSigner = () => {
    const newSigner: Signer = {
      id: `signer-${Date.now()}`,
      email: "",
      name: "",
      role: "signer",
      status: "pending",
    };
    onSignersChange([...signers, newSigner]);
    setExpandedSigners((prev) => new Set([...prev, newSigner.id]));
  };

  const removeSigner = (id: string) => {
    onSignersChange(signers.filter((s) => s.id !== id));
    // Clear field assignments for this signer
    Object.entries(fieldAssignments).forEach(([fieldId, signerId]) => {
      if (signerId === id) {
        onFieldAssignmentChange(fieldId, "");
      }
    });
  };

  const updateSigner = (id: string, updates: Partial<Signer>) => {
    onSignersChange(
      signers.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const toggleSignerExpanded = (id: string) => {
    setExpandedSigners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getFieldsAssignedToSigner = (signerId: string) => {
    return signatureFields.filter(
      (field) => fieldAssignments[field.id] === signerId
    );
  };

  const unassignedFields = signatureFields.filter(
    (field) => !fieldAssignments[field.id]
  );

  const validSigners = signers.filter(
    (s) => s.email.trim() && s.email.includes("@")
  );

  const canSend = validSigners.length > 0 && signatureFields.length > 0;

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "signed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "sent":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "declined":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getFieldTypeColor = (fieldType: string) => {
    switch (fieldType) {
      case "signature":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "initial":
        return "bg-cyan-100 text-cyan-700 border-cyan-200";
      case "date":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-l-lg shadow-lg transition-all"
        title="Open Signers Panel"
      >
        <Users className="w-5 h-5" />
        {signatureFields.length > 0 && (
          <span className="absolute -top-1 -left-1 bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {signatureFields.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-white font-medium">Signers & Fields</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Request Status */}
        {requestStatus && requestStatus !== "draft" && (
          <div
            className={`p-3 rounded-lg ${
              requestStatus === "completed"
                ? "bg-green-900/30 border border-green-700"
                : requestStatus === "sent"
                ? "bg-amber-900/30 border border-amber-700"
                : "bg-red-900/30 border border-red-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(requestStatus)}
              <span className="text-sm font-medium text-white capitalize">
                {requestStatus === "completed" ? "All Signed" : requestStatus}
              </span>
            </div>
            {documentName && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {documentName}
              </p>
            )}
          </div>
        )}

        {/* Fields Summary */}
        <div className="bg-gray-700/50 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">
            Signature Fields
          </h3>
          {signatureFields.length === 0 ? (
            <p className="text-sm text-gray-500">
              No fields added. Use the toolbar to add signature, initials, or
              date fields.
            </p>
          ) : (
            <div className="space-y-1">
              {signatureFields.map((field) => (
                <div
                  key={field.id}
                  className={`flex items-center justify-between p-2 rounded border text-xs ${getFieldTypeColor(
                    field.fieldType
                  )}`}
                >
                  <span className="font-medium truncate">{field.label}</span>
                  <span className="text-[10px] uppercase opacity-75">
                    Page {field.pageIndex + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {unassignedFields.length > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              ⚠️ {unassignedFields.length} field(s) not assigned to any signer
            </p>
          )}
        </div>

        {/* Signers List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase">
              Signers
            </h3>
            <button
              onClick={addSigner}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {signers.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add signers to send this document for signature.
            </p>
          ) : (
            <div className="space-y-2">
              {signers.map((signer) => {
                const isExpanded = expandedSigners.has(signer.id);
                const assignedFields = getFieldsAssignedToSigner(signer.id);

                return (
                  <div
                    key={signer.id}
                    className="bg-gray-700/50 rounded-lg overflow-hidden"
                  >
                    {/* Signer Header */}
                    <div
                      className="p-3 flex items-center gap-2 cursor-pointer hover:bg-gray-700/70"
                      onClick={() => toggleSignerExpanded(signer.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(signer.status)}
                          <span className="text-sm text-white truncate">
                            {signer.name || signer.email || "New Signer"}
                          </span>
                        </div>
                        {signer.email && signer.name && (
                          <p className="text-xs text-gray-400 truncate">
                            {signer.email}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-purple-400">
                        {assignedFields.length} field(s)
                      </span>
                    </div>

                    {/* Signer Details (Expanded) */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-600 space-y-3">
                        {/* Email */}
                        <div>
                          <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                            <Mail className="w-3 h-3" />
                            Email
                          </label>
                          <input
                            type="email"
                            value={signer.email}
                            onChange={(e) =>
                              updateSigner(signer.id, { email: e.target.value })
                            }
                            placeholder="signer@example.com"
                            className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        {/* Name */}
                        <div>
                          <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                            <User className="w-3 h-3" />
                            Name
                          </label>
                          <input
                            type="text"
                            value={signer.name}
                            onChange={(e) =>
                              updateSigner(signer.id, { name: e.target.value })
                            }
                            placeholder="Full Name"
                            className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        {/* Field Assignment */}
                        {signatureFields.length > 0 && (
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">
                              Assigned Fields
                            </label>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {signatureFields.map((field) => {
                                const isAssigned =
                                  fieldAssignments[field.id] === signer.id;
                                return (
                                  <label
                                    key={field.id}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-600 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={(e) =>
                                        onFieldAssignmentChange(
                                          field.id,
                                          e.target.checked ? signer.id : ""
                                        )
                                      }
                                      className="w-3.5 h-3.5 rounded border-gray-400 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-xs text-gray-300 flex-1">
                                      {field.label}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${getFieldTypeColor(
                                        field.fieldType
                                      )}`}
                                    >
                                      {field.fieldType}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Remove Button */}
                        <button
                          onClick={() => removeSigner(signer.id)}
                          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove Signer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Send Button */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onSendRequest}
          disabled={!canSend || isSending}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
            canSend && !isSending
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send for Signature
            </>
          )}
        </button>
        {!canSend && (
          <p className="text-xs text-gray-500 text-center mt-2">
            {signatureFields.length === 0
              ? "Add signature fields first"
              : "Add at least one valid signer"}
          </p>
        )}
      </div>
    </div>
  );
}

