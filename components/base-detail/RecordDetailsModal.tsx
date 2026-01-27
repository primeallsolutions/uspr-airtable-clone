"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { X, Save, Edit2, Loader2, Calendar, Hash, Mail, Phone, Link as LinkIcon, CheckSquare, FileText, Clock, Info, Paperclip, History } from "lucide-react";
import type { RecordRow, FieldRow, SavingCell, TableRow } from "@/lib/types/base-detail";
import type { AuditLogRow } from "@/lib/services/audit-log-service";
import { AuditLogService } from "@/lib/services/audit-log-service";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";
import { RecordDocuments } from "./documents/RecordDocuments";
import { RecordDocumentsService } from "@/lib/services/record-documents-service";
import { getFieldTypeLabel } from "@/lib/utils/field-type-helpers";

interface RecordDetailsModalProps {
  isOpen: boolean;
  record: RecordRow | null;
  fields: FieldRow[];
  tables: TableRow[];
  selectedTableId: string | null;
  baseId: string;
  savingCell: SavingCell;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onClose: () => void;
}

export const RecordDetailsModal = ({
  isOpen,
  record,
  fields,
  tables,
  selectedTableId,
  baseId,
  savingCell,
  onUpdateCell,
  onClose,
}: RecordDetailsModalProps) => {
  const { timezone } = useTimezone();
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<unknown>("");
  const [localNameValue, setLocalNameValue] = useState<string>("");
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"fields" | "documents">("fields");
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    if (!record) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const logs = await AuditLogService.getRecordLogs(record.id);
      setAuditLogs(logs);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setAuditLoading(false);
    }
  }, [record]);

  useEffect(() => {
    if (isAuditOpen && record) {
      loadAudit();
    }
  }, [isAuditOpen, record, loadAudit]);

  // Find the "Name" field
  const nameField = useMemo(() => {
    return fields.find((f) => f.name.toLowerCase() === "name");
  }, [fields]);

  // Get the name value from the record
  const nameValue = useMemo(() => {
    if (!record || !nameField) return "";
    return (record.values[nameField.id] as string) || "";
  }, [record, nameField]);

  // Sync local name value with record value whenever record changes
  useEffect(() => {
    setLocalNameValue(nameValue);
  }, [nameValue, record?.id]); // Add record.id to ensure sync on record change

  // Fields to display (exclude Name field if it exists, as it's shown in title)
  // Sort by order_index to match table column order
  const displayFields = useMemo(() => {
    let filtered = fields;
    if (nameField) {
      filtered = fields.filter((f) => f.id !== nameField.id);
    }
    // Sort by order_index to match the table column order
    return [...filtered].sort((a, b) => a.order_index - b.order_index);
  }, [fields, nameField]);

  // Calculate field statistics
  const fieldStats = useMemo(() => {
    const total = displayFields.length;
    const filled = displayFields.filter((f) => {
      const value = record?.values[f.id];
      return value !== null && value !== undefined && String(value).trim() !== "";
    }).length;
    const empty = total - filled;
    return { total, filled, empty, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [displayFields, record]);

  // Get field type icon
  const getFieldIcon = (type: string) => {
    switch (type) {
      case "date":
      case "datetime":
        return <Calendar className="w-4 h-4" />;
      case "number":
        return <Hash className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "phone":
        return <Phone className="w-4 h-4" />;
      case "link":
        return <LinkIcon className="w-4 h-4" />;
      case "checkbox":
        return <CheckSquare className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Format value based on field type
  const formatFieldValue = (field: FieldRow, value: unknown): string => {
    if (value === null || value === undefined) return "";
    
    switch (field.type) {
      case "date":
      case "datetime":
        if (typeof value === "string") {
          try {
            return formatInTimezone(value, timezone, {
              year: "numeric",
              month: "short",
              day: "numeric",
              ...(field.type === "datetime" && { hour: "numeric", minute: "2-digit" }),
            });
          } catch {
            return String(value);
          }
        }
        return String(value);
      case "number":
        if (typeof value === "number") {
          return new Intl.NumberFormat().format(value);
        }
        return String(value);
      case "email":
        return String(value);
      case "phone":
        return String(value);
      case "link":
        return String(value);
      case "checkbox":
        return value ? "Yes" : "No";
      case "single_select":
      case "multi_select":
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        return String(value);
      default:
        return String(value);
    }
  };

  // Get option label for select fields (converts option ID to display label)
  const getOptionLabel = (field: FieldRow, value: unknown): string => {
    if (!value || typeof value !== "string") return String(value || "");
    
    if (!field.options || typeof field.options !== "object") {
      return String(value);
    }
    
    // Check if value is an option ID (like "option_1")
    if (value in field.options) {
      const optionData = field.options[value];
      if (optionData && typeof optionData === "object") {
        const opt = optionData as { name?: string; label?: string };
        return opt.name || opt.label || String(value);
      }
      if (typeof optionData === "string") {
        return optionData;
      }
    }
    
    // Value might already be the label itself
    return String(value);
  };

  // Get field options for select fields (returns { id, label } objects)
  const getFieldOptions = (field: FieldRow): Array<{ id: string; label: string }> => {
    if (!field.options || typeof field.options !== "object") {
      return [];
    }
    
    // Format 1: { "choices": ["Option1", "Option2"] }
    if ("choices" in field.options && Array.isArray(field.options.choices)) {
      return (field.options.choices as string[]).map(choice => ({
        id: choice,
        label: choice
      }));
    }
    
    // Format 2: { "option_1": { "name": "Active", "color": "#..." }, ... }
    // Extract option IDs and labels from object entries
    const entries = Object.entries(field.options);
    if (entries.length > 0) {
      return entries.map(([key, value]) => {
        if (typeof value === "string") {
          return { id: key, label: value };
        }
        if (value && typeof value === "object") {
          const opt = value as { name?: string; label?: string; value?: string };
          return { 
            id: key, 
            label: opt.name || opt.label || opt.value || key 
          };
        }
        return { id: key, label: key };
      });
    }
    
    return [];
  };

  // Handle inline editing
  const handleFieldClick = (field: FieldRow) => {
    if (!record) return;
    setEditingFieldId(field.id);
    
    // Initialize edit value based on field type
    const currentValue = record.values[field.id];
    
    if (field.type === "checkbox") {
      setEditValue(!!currentValue); // Convert to boolean
    } else if (field.type === "date" && currentValue) {
      // Convert date to YYYY-MM-DD format
      const date = new Date(currentValue as string);
      setEditValue(date.toISOString().split('T')[0]);
    } else if (field.type === "datetime" && currentValue) {
      // Convert datetime to YYYY-MM-DDTHH:mm format
      const date = new Date(currentValue as string);
      setEditValue(date.toISOString().slice(0, 16));
    } else if (field.type === "multi_select" && currentValue) {
      // Convert to array if it's a string
      if (typeof currentValue === "string") {
        setEditValue(currentValue.split(",").map(v => v.trim()).filter(Boolean));
      } else if (Array.isArray(currentValue)) {
        setEditValue(currentValue);
      } else {
        setEditValue([]);
      }
    } else {
      setEditValue(currentValue || "");
    }
  };

  const handleFieldBlur = async (field: FieldRow, newValue?: unknown) => {
    if (!record || editingFieldId !== field.id) return;
    
    // Use passed value if provided, otherwise use editValue state
    const valueToSave = newValue !== undefined ? newValue : editValue;
    
    // Only update if value changed
    const currentValue = record.values[field.id];
    if (currentValue !== valueToSave) {
      await onUpdateCell(record.id, field.id, valueToSave);
    }
    
    setEditingFieldId(null);
    setEditValue("");
  };

  const handleNameChange = (newValue: string) => {
    // Update local state immediately for responsive typing
    setLocalNameValue(newValue);
  };

  const handleNameBlur = async () => {
    if (!record || !nameField) return;
    // Only update if value changed
    if (localNameValue !== nameValue) {
      await onUpdateCell(record.id, nameField.id, localNameValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: FieldRow) => {
    if (e.key === "Enter") {
      handleFieldBlur(field);
    } else if (e.key === "Escape") {
      setEditingFieldId(null);
      setEditValue("");
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      nameFieldRef.current?.blur();
    } else if (e.key === "Escape") {
      // Reset to original value on escape
      setLocalNameValue(nameValue);
      nameFieldRef.current?.blur();
    }
  };

  // Reset editing state when modal closes or record changes
  useEffect(() => {
    if (!isOpen) {
      setEditingFieldId(null);
      setEditValue("");
      setLocalNameValue("");
      setActiveTab("fields");
    } else if (record) {
      // If modal is open and record changes, clear editing state
      setEditingFieldId(null);
      setEditValue("");
    }
  }, [isOpen, record, record?.id, record?.values]); // React to record changes

  // Load document count whenever record changes
  useEffect(() => {
    if (record?.id) {
      RecordDocumentsService.getDocumentCount(record.id).then(setDocumentCount).catch(() => {});
    } else {
      setDocumentCount(0);
    }
  }, [record?.id, record?.values]); // Reload count if record updates

  if (!isOpen || !record) return null;

  const isSaving = savingCell?.recordId === record.id && savingCell?.fieldId !== null;
  const isNameSaving = isSaving && savingCell?.fieldId === nameField?.id;

  const summarizeValue = (val: unknown): string => {
    if (val === null || val === undefined || val === "") return "empty";
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const renderAuditSummary = (log: AuditLogRow): string => {
    const meta = (log.metadata || {}) as Record<string, unknown>;
    
    // Handle GHL sync entries
    if (meta["source"] === "ghl") {
      const contactName = meta["contact_name"] as string;
      if (log.action === "create") {
        return contactName 
          ? `Record created from GoHighLevel sync (${contactName})`
          : "Record created from GoHighLevel sync";
      }
      if (log.action === "update") {
        return contactName
          ? `Record updated from GoHighLevel sync (${contactName})`
          : "Record updated from GoHighLevel sync";
      }
    }

    // Handle record creation
    if (log.action === "create") {
      return "Record created";
    }

    // Handle record deletion
    if (log.action === "delete") {
      return "Record deleted";
    }

    // Handle field changes (update action)
    const fieldLabel = (meta["field_name"] as string) || (meta["field_id"] as string) || "field";
    const prevVal = meta["previous_value"];
    const newVal = meta["new_value"];
    return `Changed ${fieldLabel} from ${summarizeValue(prevVal)} to ${summarizeValue(newVal)}`;
  };

  const renderActor = (log: AuditLogRow): string => {
    // GHL sync is system-initiated (no actor)
    if (!log.actor_id) {
      const meta = (log.metadata || {}) as Record<string, unknown>;
      if (meta["source"] === "ghl") {
        return "GoHighLevel Sync";
      }
      return "System";
    }
    return log.actor?.full_name || log.actor?.email || "Someone";
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200/50 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-between shadow-sm">
          <div className="flex-1 min-w-0 mr-4">
            {nameField ? (
              <div className="flex items-center gap-3">
                <input
                  ref={nameFieldRef}
                  type="text"
                  value={localNameValue}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={handleNameKeyDown}
                  className="text-4xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg px-3 -mx-3 transition-all min-w-[200px]"
                  style={{
                    width: `${Math.max(200, Math.min(localNameValue.length * 24, 600))}px`,
                    maxWidth: "calc(100% - 60px)",
                  }}
                  placeholder="Untitled"
                  disabled={isNameSaving}
                />
                {isNameSaving && (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                )}
              </div>
            ) : (
              <h2 className="text-4xl font-bold text-gray-900">Record Details</h2>
            )}
            <div className="flex items-center gap-4 mt-2">
              <p className="text-sm text-gray-500">
                {tables.find((t) => t.id === selectedTableId)?.name || "Record"}
              </p>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Created {formatInTimezone(record.created_at, timezone, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/80 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-sm"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Summary Section */}
        <div className="px-8 py-5 bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Fields</div>
                <div className="text-lg font-bold text-gray-900">{fieldStats.total}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Filled</div>
                <div className="text-lg font-bold text-gray-900">{fieldStats.filled}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Empty</div>
                <div className="text-lg font-bold text-gray-900">{fieldStats.empty}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Hash className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Completion</div>
                <div className="text-lg font-bold text-gray-900">{fieldStats.percentage}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab("fields")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "fields"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Field Details
              </span>
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "documents"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Documents
                {documentCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                    {documentCount}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          {activeTab === "fields" ? (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Field Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {displayFields.map((field) => {
              const value = record.values[field.id];
              const isEditing = editingFieldId === field.id;
              const isFieldSaving = isSaving && savingCell?.fieldId === field.id;

              return (
                <div
                  key={field.id}
                  className="group border-2 border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-lg transition-all duration-200 cursor-pointer bg-white"
                  onClick={() => !isEditing && handleFieldClick(field)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="text-gray-400">
                        {getFieldIcon(field.type)}
                      </div>
                      <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        {field.name}
                      </label>
                    </div>
                    {!isEditing && (
                      <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      {/* Type-specific input controls */}
                      {field.type === "number" ? (
                        <input
                          type="number"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                        />
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                        />
                      ) : field.type === "datetime" ? (
                        <input
                          type="datetime-local"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                        />
                      ) : field.type === "email" ? (
                        <input
                          type="email"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                          placeholder="example@email.com"
                        />
                      ) : field.type === "phone" ? (
                        <input
                          type="tel"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                          placeholder="+1 (555) 000-0000"
                        />
                      ) : field.type === "link" ? (
                        <input
                          type="url"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                          placeholder="https://example.com"
                        />
                      ) : field.type === "checkbox" ? (
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => {
                              const newVal = !editValue;
                              setEditValue(newVal);
                              // Pass value directly to avoid stale closure
                              handleFieldBlur(field, newVal);
                            }}
                            className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                              editValue ? "bg-blue-600 border-blue-600" : "border-gray-300 hover:border-blue-400"
                            }`}
                          >
                            {(editValue as boolean) && <CheckSquare className="w-6 h-6 text-white" />}
                          </button>
                          <span className="text-sm text-gray-600">
                            {editValue ? "Checked" : "Unchecked"} - Click to toggle
                          </span>
                        </div>
                      ) : field.type === "single_select" && getFieldOptions(field).length > 0 ? (
                        <select
                          value={editValue as string}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setEditValue(newVal);
                            // Pass value directly to avoid stale closure
                            handleFieldBlur(field, newVal);
                          }}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                        >
                          <option value="">-- Select option --</option>
                          {getFieldOptions(field).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "multi_select" && getFieldOptions(field).length > 0 ? (
                        <div className="space-y-2">
                          <div className="max-h-48 overflow-y-auto border-2 border-blue-500 rounded-lg p-3 space-y-1">
                            {getFieldOptions(field).map((option) => {
                              const currentValues = Array.isArray(editValue) 
                                ? editValue 
                                : (editValue as string)?.split(",").map(v => v.trim()).filter(Boolean) || [];
                              const isSelected = currentValues.includes(option.id) || currentValues.includes(option.label);
                              
                              return (
                                <label
                                  key={option.id}
                                  className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const newValues = e.target.checked
                                        ? [...currentValues, option.id]
                                        : currentValues.filter(v => v !== option.id && v !== option.label);
                                      setEditValue(newValues);
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">{option.label}</span>
                                </label>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => handleFieldBlur(field)}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Save Selection
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={editValue as string}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleFieldBlur(field)}
                          onKeyDown={(e) => handleKeyDown(e, field)}
                          className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-900 font-medium transition-all"
                          autoFocus
                        />
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                          {field.type === "checkbox" || field.type === "single_select" 
                            ? "Changes save automatically" 
                            : "Press Enter to save, Esc to cancel"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-900 min-h-[44px] flex items-center">
                      {isFieldSaving ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="italic">Saving...</span>
                        </div>
                      ) : value !== null && value !== undefined && String(value).trim() !== "" ? (
                        <div className="w-full">
                          {/* Type-specific display */}
                          {field.type === "link" && typeof value === "string" ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 text-base font-medium break-words"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <LinkIcon className="w-4 h-4" />
                              {value}
                            </a>
                          ) : field.type === "email" && typeof value === "string" ? (
                            <a
                              href={`mailto:${value}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 text-base font-medium break-words"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="w-4 h-4" />
                              {value}
                            </a>
                          ) : field.type === "phone" && typeof value === "string" ? (
                            <a
                              href={`tel:${value}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 text-base font-medium break-words"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-4 h-4" />
                              {value}
                            </a>
                          ) : field.type === "checkbox" ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                value ? "bg-blue-600 border-blue-600" : "border-gray-300"
                              }`}>
                                {value && <CheckSquare className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-base font-medium">{value ? "Yes" : "No"}</span>
                            </div>
                          ) : field.type === "date" || field.type === "datetime" ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-base font-medium">
                                {formatFieldValue(field, value)}
                              </span>
                            </div>
                          ) : field.type === "number" ? (
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4 text-gray-400" />
                              <span className="text-base font-medium">
                                {formatFieldValue(field, value)}
                              </span>
                            </div>
                          ) : field.type === "single_select" ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                              <span>{getOptionLabel(field, value)}</span>
                            </div>
                          ) : field.type === "multi_select" ? (
                            <div className="flex flex-wrap gap-2">
                              {(Array.isArray(value) ? value : String(value).split(",").map(v => v.trim())).map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                                >
                                  {getOptionLabel(field, item)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-base font-medium break-words">
                              {formatFieldValue(field, value)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">No data</span>
                      )}
                  </div>
                )}
                  <div className="mt-3 flex items-center justify-between">
                    {field.type && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md">
                        {getFieldIcon(field.type)}
                        {getFieldTypeLabel(field.type)}
                      </span>
                    )}
                    {(field.type === "single_select" || field.type === "multi_select") && getFieldOptions(field).length > 0 && (
                      <div className="text-xs text-gray-500">
                        {getFieldOptions(field).length} option{getFieldOptions(field).length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
              </div>
              {displayFields.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">No additional fields to display</p>
                </div>
              )}
            </>
          ) : (
            <RecordDocuments
              recordId={record.id}
              baseId={baseId}
              tableId={record.table_id}
              recordName={nameValue || "Record"}
              recordValues={record.values}
              fields={fields}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <div>
              <span className="font-medium text-gray-700">Record ID:</span>{" "}
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{record.id.slice(0, 8)}...</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Table ID:</span>{" "}
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{record.table_id.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Created {formatInTimezone(record.created_at, timezone, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Audit Log Modal */}
      {isAuditOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsAuditOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-700" />
                <h3 className="text-base font-semibold text-gray-900">Audit Log</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadAudit()}
                  disabled={auditLoading}
                  className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setIsAuditOpen(false)}
                  className="p-2 rounded-md hover:bg-gray-200 text-gray-600"
                  aria-label="Close audit log"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {auditLoading && (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading audit trail…
                </div>
              )}
              {auditError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{auditError}</div>
              )}
              {!auditLoading && !auditError && auditLogs.length === 0 && (
                <div className="text-sm text-gray-500">No changes logged yet.</div>
              )}
              {!auditLoading && !auditError && auditLogs.length > 0 && (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">
                        {renderActor(log)} — {renderAuditSummary(log)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatInTimezone(log.created_at, timezone, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setIsAuditOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
