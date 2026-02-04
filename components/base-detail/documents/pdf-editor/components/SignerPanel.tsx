/**
 * Signer Panel
 * Integrated panel for managing signers and sending signature requests
 * directly from the PDF Editor
 * 
 * Features:
 * - Request metadata (title, message, expiry)
 * - Signer management with roles and sign order
 * - Field assignment with select all/deselect all
 * - Inline field label editing
 * - Status column configuration for auto-updates
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Trash2,
  Send,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mail,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  MessageSquare,
  Calendar,
  Database,
  Edit2,
  Check,
  X,
  ListOrdered,
  UserCheck,
} from "lucide-react";
import type { SignatureFieldAnnotation } from "../types";

export interface Signer {
  id: string;
  email: string;
  name: string;
  role: "signer" | "viewer" | "approver";
  signOrder: number;
  status?: "pending" | "sent" | "signed" | "declined";
}

export interface RequestMetadata {
  title: string;
  message: string;
  expiresAt: string;
}

export interface StatusConfig {
  fieldId: string;
  valueOnComplete: string;
  valueOnDecline: string;
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
  // New props for enhanced functionality
  onFieldLabelChange?: (fieldId: string, newLabel: string) => void;
  // Request metadata
  requestMetadata?: RequestMetadata;
  onRequestMetadataChange?: (metadata: RequestMetadata) => void;
  // Status column config
  recordId?: string | null;
  availableFields?: Array<{ 
    id: string; 
    name: string; 
    type: string;
    options?: Record<string, { name?: string; label?: string }>;
  }>;
  statusConfig?: StatusConfig;
  onStatusConfigChange?: (config: StatusConfig | null) => void;
  // Autofill support
  recordValues?: Record<string, unknown>;
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
  onFieldLabelChange,
  requestMetadata,
  onRequestMetadataChange,
  recordId,
  availableFields = [],
  statusConfig,
  onStatusConfigChange,
  recordValues,
}: SignerPanelProps) {
  // All signers start expanded
  const [expandedSigners, setExpandedSigners] = useState<Set<string>>(() => 
    new Set(signers.map(s => s.id))
  );
  
  // Editing state for field labels
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState("");
  
  // Status config expanded state
  const [showStatusConfig, setShowStatusConfig] = useState(false);
  
  // Request settings expanded state
  const [showRequestSettings, setShowRequestSettings] = useState(true);

  // Auto-expand new signers when they are added
  useEffect(() => {
    const newSignerIds = signers.map(s => s.id);
    setExpandedSigners(prev => {
      const next = new Set(prev);
      newSignerIds.forEach(id => next.add(id));
      return next;
    });
  }, [signers]);

  // Initialize request metadata with document name if not set
  useEffect(() => {
    if (documentName && onRequestMetadataChange && (!requestMetadata || !requestMetadata.title)) {
      const docNameWithoutExt = documentName.replace(/\.[^/.]+$/, "");
      onRequestMetadataChange({
        title: `Signature Request - ${docNameWithoutExt}`,
        message: "",
        expiresAt: "",
      });
    }
  }, [documentName, requestMetadata, onRequestMetadataChange]);

  const addSigner = () => {
    const newSigner: Signer = {
      id: `signer-${Date.now()}`,
      email: "",
      name: "",
      role: "signer",
      signOrder: signers.length, // Sequential by default
      status: "pending",
    };
    onSignersChange([...signers, newSigner]);
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

  // Select all fields for a signer
  const selectAllFieldsForSigner = (signerId: string) => {
    signatureFields.forEach((field) => {
      onFieldAssignmentChange(field.id, signerId);
    });
  };

  // Deselect all fields for a signer
  const deselectAllFieldsForSigner = (signerId: string) => {
    signatureFields.forEach((field) => {
      if (fieldAssignments[field.id] === signerId) {
        onFieldAssignmentChange(field.id, "");
      }
    });
  };

  // Start editing field label
  const startEditingField = (fieldId: string, currentLabel: string) => {
    setEditingFieldId(fieldId);
    setEditingFieldLabel(currentLabel);
  };

  // Save field label edit
  const saveFieldLabel = () => {
    if (editingFieldId && onFieldLabelChange && editingFieldLabel.trim()) {
      onFieldLabelChange(editingFieldId, editingFieldLabel.trim());
    }
    setEditingFieldId(null);
    setEditingFieldLabel("");
  };

  // Cancel field label edit
  const cancelFieldLabelEdit = () => {
    setEditingFieldId(null);
    setEditingFieldLabel("");
  };

  // Autofill signer from record values
  const autofillSigner = (signerId: string) => {
    if (!recordValues || !availableFields) return;
    
    // Find email field
    const emailField = availableFields.find(f => 
      f.type === "email" || 
      f.name.toLowerCase().includes("email")
    );
    
    // Find name field
    const nameField = availableFields.find(f => 
      f.name.toLowerCase().includes("name")
    );
    
    const email = emailField && recordValues[emailField.id] 
      ? String(recordValues[emailField.id]) 
      : "";
    const name = nameField && recordValues[nameField.id] 
      ? String(recordValues[nameField.id]) 
      : "";
    
    if (email || name) {
      updateSigner(signerId, { email, name });
    }
  };

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

  // Get status field options
  const statusFieldOptions = useMemo(() => {
    if (!statusConfig?.fieldId) return [];
    const field = availableFields.find(f => f.id === statusConfig.fieldId);
    if (!field?.options) return [];
    return Object.entries(field.options).map(([key, val]) => ({
      value: key,
      label: val.label || val.name || key,
    }));
  }, [statusConfig?.fieldId, availableFields]);

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
    <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-white font-medium">Signature Request</span>
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
          </div>
        )}

        {/* Request Settings Section */}
        {onRequestMetadataChange && (
          <div className="bg-gray-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRequestSettings(!showRequestSettings)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700/70"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-gray-300 uppercase">
                  Request Settings
                </span>
              </div>
              {showRequestSettings ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {showRequestSettings && (
              <div className="px-3 pb-3 space-y-3">
                {/* Request Title */}
                <div>
                  <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                    <FileText className="w-3 h-3" />
                    Title
                  </label>
                  <input
                    type="text"
                    value={requestMetadata?.title || ""}
                    onChange={(e) =>
                      onRequestMetadataChange({
                        ...(requestMetadata || { title: "", message: "", expiresAt: "" }),
                        title: e.target.value,
                      })
                    }
                    placeholder="Signature Request Title"
                    className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Message to Signers */}
                <div>
                  <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                    <MessageSquare className="w-3 h-3" />
                    Message (Optional)
                  </label>
                  <textarea
                    value={requestMetadata?.message || ""}
                    onChange={(e) =>
                      onRequestMetadataChange({
                        ...(requestMetadata || { title: "", message: "", expiresAt: "" }),
                        message: e.target.value,
                      })
                    }
                    placeholder="Add a message for signers..."
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                    <Calendar className="w-3 h-3" />
                    Expires (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={requestMetadata?.expiresAt || ""}
                    onChange={(e) =>
                      onRequestMetadataChange({
                        ...(requestMetadata || { title: "", message: "", expiresAt: "" }),
                        expiresAt: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signature Fields Section */}
        <div className="bg-gray-700/50 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">
            Signature Fields ({signatureFields.length})
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
                  {editingFieldId === field.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editingFieldLabel}
                        onChange={(e) => setEditingFieldLabel(e.target.value)}
                        className="flex-1 px-1 py-0.5 text-xs bg-white border border-gray-300 rounded text-gray-800 focus:outline-none focus:border-purple-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveFieldLabel();
                          if (e.key === "Escape") cancelFieldLabelEdit();
                        }}
                      />
                      <button
                        onClick={saveFieldLabel}
                        className="p-0.5 text-green-600 hover:bg-green-100 rounded"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={cancelFieldLabelEdit}
                        className="p-0.5 text-red-600 hover:bg-red-100 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span 
                        className="font-medium truncate flex-1 cursor-pointer hover:underline"
                        onClick={() => onFieldLabelChange && startEditingField(field.id, field.label)}
                        title={onFieldLabelChange ? "Click to edit" : field.label}
                      >
                        {field.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onFieldLabelChange && (
                          <button
                            onClick={() => startEditingField(field.id, field.label)}
                            className="p-0.5 opacity-50 hover:opacity-100"
                            title="Edit label"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-[10px] uppercase opacity-75">
                          Page {field.pageIndex + 1}
                        </span>
                      </div>
                    </>
                  )}
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
              Signers ({signers.length})
            </h3>
            <button
              onClick={addSigner}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Signer
            </button>
          </div>

          {signers.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add signers to send this document for signature.
            </p>
          ) : (
            <div className="space-y-2">
              {signers.map((signer, index) => {
                const isExpanded = expandedSigners.has(signer.id);
                const assignedFields = getFieldsAssignedToSigner(signer.id);
                const canAutofill = recordValues && availableFields.length > 0;

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
                            {signer.name || signer.email || `Signer ${index + 1}`}
                          </span>
                          {signer.role !== "signer" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600 text-gray-300 capitalize">
                              {signer.role}
                            </span>
                          )}
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
                            Email <span className="text-red-400">*</span>
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="email"
                              value={signer.email}
                              onChange={(e) =>
                                updateSigner(signer.id, { email: e.target.value })
                              }
                              placeholder="signer@example.com"
                              className="flex-1 px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                            />
                            {canAutofill && (
                              <button
                                onClick={() => autofillSigner(signer.id)}
                                className="px-2 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                                title="Autofill from record"
                              >
                                Fill
                              </button>
                            )}
                          </div>
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

                        {/* Role and Sign Order */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Role */}
                          <div>
                            <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                              <UserCheck className="w-3 h-3" />
                              Role
                            </label>
                            <select
                              value={signer.role}
                              onChange={(e) =>
                                updateSigner(signer.id, {
                                  role: e.target.value as Signer["role"],
                                })
                              }
                              className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:border-purple-500"
                            >
                              <option value="signer">Signer</option>
                              <option value="viewer">Viewer</option>
                              <option value="approver">Approver</option>
                            </select>
                          </div>

                          {/* Sign Order */}
                          <div>
                            <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                              <ListOrdered className="w-3 h-3" />
                              Order
                            </label>
                            <input
                              type="number"
                              value={signer.signOrder}
                              onChange={(e) =>
                                updateSigner(signer.id, {
                                  signOrder: parseInt(e.target.value) || 0,
                                })
                              }
                              min="0"
                              className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:border-purple-500"
                              title="0 = parallel, 1+ = sequential order"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 -mt-2">
                          Order 0 = all sign at once, 1+ = sign in order
                        </p>

                        {/* Field Assignment */}
                        {signatureFields.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-gray-400">
                                Assigned Fields
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => selectAllFieldsForSigner(signer.id)}
                                  className="text-[10px] text-purple-400 hover:text-purple-300"
                                >
                                  Select All
                                </button>
                                <button
                                  onClick={() => deselectAllFieldsForSigner(signer.id)}
                                  className="text-[10px] text-gray-400 hover:text-gray-300"
                                >
                                  Deselect All
                                </button>
                              </div>
                            </div>
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
                                    <span className="text-xs text-gray-300 flex-1 truncate">
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

        {/* Status Column Configuration */}
        {recordId && availableFields.length > 0 && onStatusConfigChange && (
          <div className="bg-gray-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowStatusConfig(!showStatusConfig)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700/70"
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-gray-300 uppercase">
                  Auto-Update Status
                </span>
                {statusConfig?.fieldId && (
                  <span className="text-[10px] bg-green-600/30 text-green-400 px-1.5 py-0.5 rounded">
                    Enabled
                  </span>
                )}
              </div>
              {showStatusConfig ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {showStatusConfig && (
              <div className="px-3 pb-3 space-y-3">
                <p className="text-[10px] text-gray-500">
                  Automatically update a record field when signing is complete or declined.
                </p>

                {/* Field Selection */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Field to Update
                  </label>
                  <select
                    value={statusConfig?.fieldId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        onStatusConfigChange({
                          fieldId: e.target.value,
                          valueOnComplete: statusConfig?.valueOnComplete || "Signed",
                          valueOnDecline: statusConfig?.valueOnDecline || "Declined",
                        });
                      } else {
                        onStatusConfigChange(null);
                      }
                    }}
                    className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Don&apos;t auto-update</option>
                    {availableFields
                      .filter((f) => f.type === "single_select" || f.type === "text")
                      .map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name} ({field.type === "single_select" ? "Select" : "Text"})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Status Values */}
                {statusConfig?.fieldId && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">
                        When Completed
                      </label>
                      {statusFieldOptions.length > 0 ? (
                        <select
                          value={statusConfig.valueOnComplete}
                          onChange={(e) =>
                            onStatusConfigChange({
                              ...statusConfig,
                              valueOnComplete: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:border-green-500"
                        >
                          {statusFieldOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={statusConfig.valueOnComplete}
                          onChange={(e) =>
                            onStatusConfigChange({
                              ...statusConfig,
                              valueOnComplete: e.target.value,
                            })
                          }
                          placeholder="Signed"
                          className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">
                        When Declined
                      </label>
                      {statusFieldOptions.length > 0 ? (
                        <select
                          value={statusConfig.valueOnDecline}
                          onChange={(e) =>
                            onStatusConfigChange({
                              ...statusConfig,
                              valueOnDecline: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:border-red-500"
                        >
                          {statusFieldOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={statusConfig.valueOnDecline}
                          onChange={(e) =>
                            onStatusConfigChange({
                              ...statusConfig,
                              valueOnDecline: e.target.value,
                            })
                          }
                          placeholder="Declined"
                          className="w-full px-2 py-1.5 text-sm bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
