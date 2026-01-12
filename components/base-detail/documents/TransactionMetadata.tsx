"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, User, Home, Tag, FileText, Calendar, Mail, Phone, Info, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type TransactionMetadataProps = {
  baseId: string;
  tableId?: string | null;
  documentPath: string;
  recordId?: string | null;
};

type FieldMetadata = {
  id: string;
  name: string;
  type: string;
  value: unknown;
  options?: Record<string, { name?: string; label?: string; color?: string }>;
};

// Icons for different field types
const getFieldIcon = (type: string, name: string) => {
  const nameLower = name.toLowerCase();
  
  // Check name patterns first
  if (nameLower.includes("email")) return <Mail className="w-4 h-4 text-blue-500" />;
  if (nameLower.includes("phone")) return <Phone className="w-4 h-4 text-green-500" />;
  if (nameLower.includes("address") || nameLower.includes("property")) return <Home className="w-4 h-4 text-amber-500" />;
  if (nameLower.includes("name") || nameLower.includes("client") || nameLower.includes("buyer") || nameLower.includes("seller")) 
    return <User className="w-4 h-4 text-purple-500" />;
  if (nameLower.includes("date") || nameLower.includes("closing")) return <Calendar className="w-4 h-4 text-red-500" />;
  if (nameLower.includes("status") || nameLower.includes("stage")) return <Tag className="w-4 h-4 text-indigo-500" />;
  
  // Fall back to type
  switch (type) {
    case "email": return <Mail className="w-4 h-4 text-blue-500" />;
    case "phone": return <Phone className="w-4 h-4 text-green-500" />;
    case "date":
    case "datetime": return <Calendar className="w-4 h-4 text-red-500" />;
    case "single_select":
    case "multi_select": return <Tag className="w-4 h-4 text-indigo-500" />;
    default: return <FileText className="w-4 h-4 text-gray-400" />;
  }
};

// Format field value for display
const formatFieldValue = (field: FieldMetadata): string => {
  const { value, type, options } = field;
  
  if (value === null || value === undefined || value === "") return "—";
  
  switch (type) {
    case "date":
      try {
        return new Date(value as string).toLocaleDateString();
      } catch {
        return String(value);
      }
    case "datetime":
      try {
        return new Date(value as string).toLocaleString();
      } catch {
        return String(value);
      }
    case "checkbox":
      return value ? "Yes" : "No";
    case "single_select":
      if (options && typeof value === "string" && value.startsWith("option_")) {
        return options[value]?.name || options[value]?.label || value;
      }
      return String(value);
    case "multi_select":
      if (Array.isArray(value) && options) {
        return value
          .map(v => {
            if (typeof v === "string" && v.startsWith("option_")) {
              return options[v]?.name || options[v]?.label || v;
            }
            return v;
          })
          .join(", ");
      }
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "number":
      if (typeof value === "number") {
        return value.toLocaleString();
      }
      return String(value);
    case "link":
      return String(value);
    default:
      return String(value);
  }
};

// Priority order for displaying fields (high priority fields show first)
const getFieldPriority = (name: string): number => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("property") || nameLower.includes("address")) return 0;
  if (nameLower.includes("buyer") || nameLower.includes("seller") || nameLower.includes("client")) return 1;
  if (nameLower.includes("status") || nameLower.includes("stage")) return 2;
  if (nameLower.includes("closing") || nameLower.includes("date")) return 3;
  if (nameLower.includes("email") || nameLower.includes("phone")) return 4;
  if (nameLower.includes("name")) return 5;
  return 10;
};

export const TransactionMetadata = ({
  baseId,
  tableId,
  documentPath,
  recordId,
}: TransactionMetadataProps) => {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<FieldMetadata[]>([]);
  const [recordName, setRecordName] = useState<string>("");

  // Load record metadata
  const loadMetadata = useCallback(async () => {
    if (!recordId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get record with values
      const { data: record, error: recordError } = await supabase
        .from("records")
        .select("id, table_id, values")
        .eq("id", recordId)
        .single();

      if (recordError || !record) {
        console.log("No linked record found");
        setLoading(false);
        return;
      }

      // Get fields for the table
      const { data: fields, error: fieldsError } = await supabase
        .from("fields")
        .select("id, name, type, options")
        .eq("table_id", record.table_id)
        .order("order_index");

      if (fieldsError || !fields) {
        console.error("Failed to load fields:", fieldsError);
        setLoading(false);
        return;
      }

      // Build metadata array
      const metadataArr: FieldMetadata[] = [];
      const recordValues = record.values || {};

      for (const field of fields) {
        const value = recordValues[field.id];
        // Only include fields with values
        if (value !== null && value !== undefined && value !== "") {
          metadataArr.push({
            id: field.id,
            name: field.name,
            type: field.type,
            value,
            options: field.options as Record<string, { name?: string; label?: string; color?: string }>,
          });
        }
      }

      // Sort by priority
      metadataArr.sort((a, b) => getFieldPriority(a.name) - getFieldPriority(b.name));

      setMetadata(metadataArr);

      // Try to get a sensible record name from common field names
      const nameField = fields.find(f => 
        f.name.toLowerCase().includes("name") || 
        f.name.toLowerCase().includes("property") ||
        f.name.toLowerCase().includes("address") ||
        f.name.toLowerCase().includes("title")
      );
      if (nameField && recordValues[nameField.id]) {
        setRecordName(String(recordValues[nameField.id]));
      } else {
        // Use first text field value as fallback
        const firstTextField = metadataArr.find(f => f.type === "text");
        if (firstTextField) {
          setRecordName(String(firstTextField.value).substring(0, 50));
        }
      }
    } catch (err) {
      console.error("Failed to load transaction metadata:", err);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Don't render if no record or no metadata
  if (!recordId || (metadata.length === 0 && !loading)) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">Transaction Details</span>
          {recordName && !expanded && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              — {recordName}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-indigo-100 bg-white/50">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          ) : metadata.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No transaction data available</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {metadata.slice(0, 8).map((field) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {getFieldIcon(field.type, field.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-500">{field.name}</div>
                    <div className="text-sm text-gray-900 truncate" title={formatFieldValue(field)}>
                      {formatFieldValue(field)}
                    </div>
                  </div>
                </div>
              ))}
              {metadata.length > 8 && (
                <div className="col-span-2 text-xs text-gray-500 text-center pt-1">
                  +{metadata.length - 8} more fields
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
