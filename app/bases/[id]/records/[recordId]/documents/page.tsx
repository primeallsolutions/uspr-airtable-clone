"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, FileText, File, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { BaseDetailService } from "@/lib/services/base-detail-service";
import type { RecordRow, TableRow } from "@/lib/types/base-detail";

// Import document view component
import { DocumentsView } from "@/components/base-detail/DocumentsView";

export default function RecordDocumentsPage() {
  const params = useParams<{ id: string; recordId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const baseId = params?.id; // Use 'id' to match the parent route [id]
  const recordId = params?.recordId;
  const tableId = searchParams?.get("tableId");

  const [record, setRecord] = useState<RecordRow | null>(null);
  const [table, setTable] = useState<TableRow | null>(null);
  const [baseName, setBaseName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<any[]>([]);
  const [selectedTitleFieldId, setSelectedTitleFieldId] = useState<string | null>(null);

  // Load record and table data
  useEffect(() => {
    if (!baseId || !recordId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load base info
        const baseData = await BaseDetailService.getBase(baseId);
        setBaseName(baseData.name);

        // Load table info if tableId is provided
        if (tableId) {
          const tables = await BaseDetailService.getTables(baseId);
          const foundTable = tables.find((t) => t.id === tableId);
          if (foundTable) {
            setTable(foundTable);

            // Load fields for this table
            const tableFields = await BaseDetailService.getFields(tableId);
            const sortedFields = tableFields.sort((a, b) => a.order_index - b.order_index);
            setFields(sortedFields);

            // Load records from table to find our specific record
            const records = await BaseDetailService.getRecords(tableId);
            const foundRecord = records.find((r) => r.id === recordId);
            if (foundRecord) {
              setRecord(foundRecord);
              // Default to first field if not already set
              if (!selectedTitleFieldId && sortedFields.length > 0) {
                setSelectedTitleFieldId(sortedFields[0].id);
              }
            } else {
              toast.error("Record not found in table");
            }
          } else {
            toast.error("Table not found");
          }
        } else {
          // Try to find record across all tables
          const tables = await BaseDetailService.getTables(baseId);
          for (const tbl of tables) {
            const records = await BaseDetailService.getRecords(tbl.id);
            const foundRecord = records.find((r) => r.id === recordId);
            if (foundRecord) {
              setRecord(foundRecord);
              setTable(tbl);
              
              // Load fields for this table
              const tableFields = await BaseDetailService.getFields(tbl.id);
              const sortedFields = tableFields.sort((a, b) => a.order_index - b.order_index);
              setFields(sortedFields);
              
              // Default to first field if not already set
              if (!selectedTitleFieldId && sortedFields.length > 0) {
                setSelectedTitleFieldId(sortedFields[0].id);
              }
              break;
            }
          }
          
          if (!record) {
            toast.error("Record not found");
          }
        }
      } catch (err) {
        console.error("Failed to load record data:", err);
        toast.error("Failed to load record details");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record and selectedTitleFieldId are checked for initial state only
  }, [baseId, recordId, tableId]);

  // Get record name based on selected field (defaults to 1st column)
  const recordName = useMemo(() => {
    if (!record || fields.length === 0) return "Record";
    
    // Use selected field, or default to first field (by order_index)
    const fieldToUse = selectedTitleFieldId 
      ? fields.find(f => f.id === selectedTitleFieldId)
      : fields[0]; // Already sorted by order_index
    
    if (!fieldToUse) return `Record ${recordId.slice(0, 8)}`;
    
    const value = record.values[fieldToUse.id];
    if (value && String(value).trim().length > 0) {
      return String(value);
    }
    
    // Fallback to record ID if field is empty
    return `Record ${recordId.slice(0, 8)}`;
  }, [record, recordId, fields, selectedTitleFieldId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading record documents...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <File className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Record Not Found</h2>
          <p className="text-gray-600 mb-4">The record you&apos;re looking for doesn&apos;t exist.</p>
            <button
            onClick={() => {
              const params = new URLSearchParams();
              params.set("openRecord", recordId);
              if (tableId) params.set("tableId", tableId);
              router.push(`/bases/${baseId}?${params.toString()}`);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Base
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => {
                const params = new URLSearchParams();
                params.set("openRecord", recordId);
                if (tableId) params.set("tableId", tableId);
                router.push(`/bases/${baseId}?${params.toString()}`);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to base"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>

            {/* Title with Column Selector */}
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {recordName}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <span>{baseName}</span>
                  {table && (
                    <>
                      <span>•</span>
                      <span>{table.name}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>Documents & Files</span>
                </div>
              </div>

              {/* Column Selector Dropdown */}
              {fields.length > 0 && (
                <div className="relative group">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                    onClick={(e) => {
                      e.currentTarget.nextElementSibling?.classList.toggle('hidden');
                    }}
                    title="Change which field is displayed as the title"
                  >
                    <span>Title: {fields.find(f => f.id === selectedTitleFieldId)?.name || fields[0]?.name}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] z-10">
                    {fields.map((field, index) => (
                      <button
                        key={field.id}
                        onClick={() => {
                          setSelectedTitleFieldId(field.id);
                          // Close dropdown
                          document.querySelector('.group > div:not(.hidden)')?.classList.add('hidden');
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                          selectedTitleFieldId === field.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <span>
                          {index === 0 && '(Default) '}{field.name}
                        </span>
                        {selectedTitleFieldId === field.id && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content - Full Width */}
      <div className="flex-1 flex flex-col">
        {/* Use DocumentsView with record context - scoped to this specific record */}
        <DocumentsView
          baseId={baseId}
          baseName={baseName}
          selectedTable={table}
          recordId={recordId}
          recordName={recordName}
        />
      </div>
    </div>
  );
}
