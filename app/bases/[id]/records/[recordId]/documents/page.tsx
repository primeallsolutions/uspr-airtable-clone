"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, FileText, File } from "lucide-react";
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

            // Load records from table to find our specific record
            const records = await BaseDetailService.getRecords(tableId);
            const foundRecord = records.find((r) => r.id === recordId);
            if (foundRecord) {
              setRecord(foundRecord);
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
  }, [baseId, recordId, tableId]);

  // Get record name (look for "Name" field)
  const recordName = useMemo(() => {
    if (!record) return "Record";
    
    // Try to find a value that looks like a name
    const nameValue = Object.values(record.values).find((value) => {
      return typeof value === "string" && value.trim().length > 0;
    });

    return (nameValue as string) || `Record ${recordId.slice(0, 8)}`;
  }, [record, recordId]);

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
          <p className="text-gray-600 mb-4">The record you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push(`/bases/${baseId}`)}
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
              onClick={() => router.push(`/bases/${baseId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to base"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>

            {/* Title */}
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
          </div>
        </div>
      </div>

      {/* Content - Full Width */}
      <div className="flex-1 flex flex-col">
        {/* Use DocumentsView with table context - takes full height */}
        <DocumentsView
          baseId={baseId}
          baseName={baseName}
          selectedTable={table}
        />
      </div>
    </div>
  );
}
