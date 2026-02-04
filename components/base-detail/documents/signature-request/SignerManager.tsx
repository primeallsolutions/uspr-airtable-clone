"use client";

/**
 * SignerManager Component
 * 
 * Manages the list of signers for a signature request.
 * Handles add, remove, and edit operations for signers.
 */

import { Plus, Trash2, User } from "lucide-react";
import type { RecordRow } from "@/lib/types/base-detail";

export type Signer = {
  email: string;
  name: string;
  role: "signer" | "viewer" | "approver";
  sign_order: number;
};

export type SignerManagerProps = {
  signers: Signer[];
  onSignersChange: (signers: Signer[]) => void;
  // For auto-fill functionality
  records?: RecordRow[];
  selectedRecordId?: string | null;
  availableFields?: Array<{ id: string; name: string; type: string }>;
  // Template fields for assignment
  templateFields?: Array<{
    id?: string;
    field_key?: string;
    field_name?: string;
    field_type?: string;
    page_number?: number;
    is_required?: boolean;
  }>;
  fieldSignerAssignments?: Record<string, string>;
  onFieldAssignmentChange?: (assignments: Record<string, string>) => void;
  mode?: "template" | "document";
  // Document mode fields
  documentSignatureFields?: Array<{
    id: string;
    pageIndex: number;
    label: string;
  }>;
};

export function SignerManager({
  signers,
  onSignersChange,
  records = [],
  selectedRecordId,
  availableFields = [],
  templateFields = [],
  fieldSignerAssignments = {},
  onFieldAssignmentChange,
  mode = "template",
  documentSignatureFields = [],
}: SignerManagerProps) {
  // Get email from selected record
  const getRecordEmail = (): string | null => {
    if (!selectedRecordId) return null;
    
    const selectedRecord = records.find(r => r.id === selectedRecordId);
    if (!selectedRecord?.values) return null;
    
    const emailField = availableFields.find(f => f.type === "email");
    if (!emailField) return null;
    
    const emailValue = selectedRecord.values[emailField.id];
    return emailValue ? String(emailValue) : null;
  };

  // Get name from selected record
  const getRecordName = (): string | null => {
    if (!selectedRecordId) return null;
    
    const selectedRecord = records.find(r => r.id === selectedRecordId);
    if (!selectedRecord?.values) return null;
    
    const nameField = availableFields.find(f => 
      f.name.toLowerCase().includes("name")
    );
    
    if (nameField && selectedRecord.values[nameField.id]) {
      return String(selectedRecord.values[nameField.id]);
    }
    
    const primaryFieldId = availableFields[0]?.id;
    if (primaryFieldId && selectedRecord.values[primaryFieldId]) {
      return String(selectedRecord.values[primaryFieldId]);
    }
    
    return null;
  };

  // Check if email is already in use
  const isEmailAlreadyUsed = (email: string | null, excludeIndex?: number): boolean => {
    if (!email) return false;
    return signers.some((signer, index) => 
      signer.email === email && (excludeIndex === undefined || index !== excludeIndex)
    );
  };

  const handleAddSigner = () => {
    onSignersChange([...signers, { 
      email: "", 
      name: "", 
      role: "signer", 
      sign_order: signers.length 
    }]);
  };

  const handleRemoveSigner = (index: number) => {
    onSignersChange(signers.filter((_, i) => i !== index));
  };

  const handleSignerChange = (index: number, field: keyof Signer, value: string) => {
    const updated = [...signers];
    if (field === "email" || field === "name") {
      updated[index] = { ...updated[index], [field]: value };
    } else if (field === "role") {
      updated[index] = { ...updated[index], role: value as "signer" | "viewer" | "approver" };
    } else if (field === "sign_order") {
      updated[index] = { ...updated[index], sign_order: parseInt(value) || 0 };
    }
    onSignersChange(updated);
  };

  const handleAutofill = (index: number) => {
    const email = getRecordEmail() || "";
    const name = getRecordName() || "";
    const updated = [...signers];
    updated[index] = { ...updated[index], email, name };
    onSignersChange(updated);
  };

  const handleFieldAssignment = (fieldKey: string, signerEmail: string) => {
    if (onFieldAssignmentChange) {
      onFieldAssignmentChange({
        ...fieldSignerAssignments,
        [fieldKey]: signerEmail,
      });
    }
  };

  const handleSelectAllFields = (signerEmail: string) => {
    if (!onFieldAssignmentChange) return;
    
    const newAssignments = { ...fieldSignerAssignments };
    if (mode === "template") {
      templateFields.forEach((field) => {
        const key = field.id || field.field_key;
        if (!key) return; // Skip fields without valid key
        newAssignments[key] = signerEmail;
      });
    } else {
      documentSignatureFields.forEach((field) => {
        if (!field.id) return; // Skip fields without valid id
        newAssignments[field.id] = signerEmail;
      });
    }
    onFieldAssignmentChange(newAssignments);
  };

  const handleDeselectAllFields = (signerEmail: string) => {
    if (!onFieldAssignmentChange) return;
    
    const newAssignments = { ...fieldSignerAssignments };
    if (mode === "template") {
      templateFields.forEach((field) => {
        const key = field.id || field.field_key;
        if (!key) return;
        if (newAssignments[key] === signerEmail) {
          newAssignments[key] = "";
        }
      });
    } else {
      documentSignatureFields.forEach((field) => {
        if (!field.id) return;
        if (newAssignments[field.id] === signerEmail) {
          newAssignments[field.id] = "";
        }
      });
    }
    onFieldAssignmentChange(newAssignments);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-700">
          Signers <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={handleAddSigner}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Signer
        </button>
      </div>
      
      <div className="space-y-3">
        {signers.map((signer, index) => (
          <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-2 gap-3">
                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={signer.email}
                    onChange={(e) => handleSignerChange(index, "email", e.target.value)}
                    placeholder="signer@example.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={signer.name}
                      onChange={(e) => handleSignerChange(index, "name", e.target.value)}
                      placeholder="Full Name"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {selectedRecordId && (getRecordName() || getRecordEmail()) && !isEmailAlreadyUsed(getRecordEmail(), index) && (
                      <button
                        type="button"
                        onClick={() => handleAutofill(index)}
                        className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 whitespace-nowrap"
                        title="Fill email and name from selected record"
                      >
                        Autofill
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Role
                  </label>
                  <select
                    value={signer.role}
                    onChange={(e) => handleSignerChange(index, "role", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="signer">Signer</option>
                    <option value="viewer">Viewer</option>
                    <option value="approver">Approver</option>
                  </select>
                </div>
                
                {/* Sign Order */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Sign Order (0 = parallel)
                  </label>
                  <input
                    type="number"
                    value={signer.sign_order}
                    onChange={(e) => handleSignerChange(index, "sign_order", e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* Remove Button */}
              {signers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSigner(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Field Assignment Section */}
            {((mode === "template" && templateFields.length > 0) || 
              (mode === "document" && documentSignatureFields.length > 0)) && 
              onFieldAssignmentChange && (
              <FieldAssignmentSection
                signer={signer}
                mode={mode}
                templateFields={templateFields}
                documentSignatureFields={documentSignatureFields}
                fieldSignerAssignments={fieldSignerAssignments}
                onFieldAssignment={handleFieldAssignment}
                onSelectAll={() => handleSelectAllFields(signer.email)}
                onDeselectAll={() => handleDeselectAllFields(signer.email)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Sub-component for field assignment
function FieldAssignmentSection({
  signer,
  mode,
  templateFields,
  documentSignatureFields,
  fieldSignerAssignments,
  onFieldAssignment,
  onSelectAll,
  onDeselectAll,
}: {
  signer: Signer;
  mode: "template" | "document";
  templateFields: SignerManagerProps["templateFields"];
  documentSignatureFields: SignerManagerProps["documentSignatureFields"];
  fieldSignerAssignments: Record<string, string>;
  onFieldAssignment: (fieldKey: string, email: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const fields = mode === "template" ? templateFields || [] : documentSignatureFields || [];
  const assignedCount = Object.entries(fieldSignerAssignments)
    .filter(([_, email]) => email === signer.email).length;

  return (
    <div className="mt-3 pt-3 border-t border-gray-300">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-700">
          {mode === "template" ? "Assign Fields to Signer" : "Assigned Signature Fields"}
          {signer.email ? ` (${signer.email})` : " (Enter email to assign)"}
        </label>
        <span className="text-xs text-gray-500">
          {assignedCount} / {fields.length} assigned
        </span>
      </div>
      
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {mode === "template" ? (
          <>
            {/* Signature Fields */}
            {(templateFields || []).filter(f => f.field_type === "signature").length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded mb-1">
                  Signature Fields
                </div>
                {(templateFields || [])
                  .filter(f => f.field_type === "signature")
                  .map((field) => (
                    <FieldCheckbox
                      key={field.id || field.field_key}
                      fieldKey={field.id || field.field_key || ""}
                      label={field.field_name || "Signature Field"}
                      pageNumber={field.page_number}
                      isRequired={field.is_required}
                      isAssigned={!!signer.email && fieldSignerAssignments[field.id || field.field_key || ""] === signer.email}
                      disabled={!signer.email}
                      onChange={(checked) => onFieldAssignment(
                        field.id || field.field_key || "",
                        checked ? signer.email : ""
                      )}
                    />
                  ))}
              </div>
            )}
            
            {/* Other Fields */}
            {(templateFields || []).filter(f => f.field_type !== "signature").length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded mb-1 mt-2">
                  Other Fields
                </div>
                {(templateFields || [])
                  .filter(f => f.field_type !== "signature")
                  .map((field) => (
                    <FieldCheckbox
                      key={field.id || field.field_key}
                      fieldKey={field.id || field.field_key || ""}
                      label={field.field_name || field.field_type || "Field"}
                      pageNumber={field.page_number}
                      isRequired={field.is_required}
                      fieldType={field.field_type}
                      isAssigned={!!signer.email && fieldSignerAssignments[field.id || field.field_key || ""] === signer.email}
                      disabled={!signer.email}
                      onChange={(checked) => onFieldAssignment(
                        field.id || field.field_key || "",
                        checked ? signer.email : ""
                      )}
                    />
                  ))}
              </div>
            )}
          </>
        ) : (
          // Document mode
          (documentSignatureFields || []).map((field) => (
            <FieldCheckbox
              key={field.id}
              fieldKey={field.id}
              label={field.label}
              pageNumber={field.pageIndex + 1}
              isAssigned={fieldSignerAssignments[field.id] === signer.email}
              disabled={false}
              onChange={(checked) => onFieldAssignment(field.id, checked ? signer.email : "")}
              colorClass="text-green-600 focus:ring-green-500"
            />
          ))
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onSelectAll}
          className={`text-xs ${mode === "document" ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"} hover:underline`}
        >
          Select All
        </button>
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
        >
          Deselect All
        </button>
      </div>
    </div>
  );
}

// Field checkbox component
function FieldCheckbox({
  fieldKey,
  label,
  pageNumber,
  isRequired,
  fieldType,
  isAssigned,
  disabled,
  onChange,
  colorClass = "text-blue-600 focus:ring-blue-500",
}: {
  fieldKey: string;
  label: string;
  pageNumber?: number;
  isRequired?: boolean;
  fieldType?: string;
  isAssigned: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  colorClass?: string;
}) {
  return (
    <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={isAssigned}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-4 h-4 ${colorClass} border-gray-300 rounded`}
      />
      <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700">
            {label}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
          </span>
          {fieldType && fieldType !== "signature" && (
            <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
              {fieldType}
            </span>
          )}
        </div>
        {pageNumber && (
          <span className="text-xs text-gray-500">
            Page {pageNumber}
          </span>
        )}
      </div>
    </label>
  );
}

export default SignerManager;

