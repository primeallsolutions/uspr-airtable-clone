"use client";

/**
 * StatusColumnConfig Component
 * 
 * Configures automatic status updates when a signature request is completed or declined.
 * Allows selecting a field to update and the values to set.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, Database } from "lucide-react";

export type StatusColumnConfigProps = {
  recordId?: string | null;
  availableFields: Array<{
    id: string;
    name: string;
    type: string;
    options?: Record<string, { name?: string; label?: string }>;
  }>;
  selectedStatusFieldId: string;
  onStatusFieldChange: (fieldId: string) => void;
  statusValueOnComplete: string;
  onStatusValueOnCompleteChange: (value: string) => void;
  statusValueOnDecline: string;
  onStatusValueOnDeclineChange: (value: string) => void;
  defaultExpanded?: boolean;
};

export function StatusColumnConfig({
  recordId,
  availableFields,
  selectedStatusFieldId,
  onStatusFieldChange,
  statusValueOnComplete,
  onStatusValueOnCompleteChange,
  statusValueOnDecline,
  onStatusValueOnDeclineChange,
  defaultExpanded = false,
}: StatusColumnConfigProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Don't render if no record or no fields
  if (!recordId || availableFields.length === 0) {
    return null;
  }

  // Filter to only show single_select and text fields
  const statusFields = availableFields.filter(
    f => f.type === "single_select" || f.type === "text"
  );

  // Get the selected field for options display
  const selectedField = statusFields.find(f => f.id === selectedStatusFieldId);
  const fieldOptions = selectedField?.options 
    ? Object.entries(selectedField.options).map(([key, val]) => ({
        value: key,
        label: val.label || val.name || key,
      }))
    : [];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Auto-Update Record Status
          </span>
          {isExpanded && selectedStatusFieldId && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Enabled
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-gray-200 bg-white space-y-4">
          <p className="text-xs text-gray-500">
            Automatically update a field in the linked record when this signature 
            request is completed or declined.
          </p>
          
          {/* Status Field Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Field to Update
            </label>
            <select
              value={selectedStatusFieldId}
              onChange={(e) => onStatusFieldChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a field...</option>
              {statusFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} ({field.type === "single_select" ? "Single Select" : "Text"})
                </option>
              ))}
            </select>
          </div>
          
          {/* Status Values Configuration */}
          {selectedStatusFieldId && (
            <div className="grid grid-cols-2 gap-4">
              {/* Value on Complete */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Value when Completed
                </label>
                {selectedField?.type === "single_select" && fieldOptions.length > 0 ? (
                  <select
                    value={statusValueOnComplete}
                    onChange={(e) => onStatusValueOnCompleteChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {fieldOptions.map((opt) => (
                      <option key={opt.value} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={statusValueOnComplete}
                    onChange={(e) => onStatusValueOnCompleteChange(e.target.value)}
                    placeholder="Signed"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Set when all signers complete
                </p>
              </div>
              
              {/* Value on Decline */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Value when Declined
                </label>
                {selectedField?.type === "single_select" && fieldOptions.length > 0 ? (
                  <select
                    value={statusValueOnDecline}
                    onChange={(e) => onStatusValueOnDeclineChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {fieldOptions.map((opt) => (
                      <option key={opt.value} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={statusValueOnDecline}
                    onChange={(e) => onStatusValueOnDeclineChange(e.target.value)}
                    placeholder="Declined"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Set when any signer declines
                </p>
              </div>
            </div>
          )}
          
          {/* Preview */}
          {selectedStatusFieldId && selectedField && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-600 mb-2">Preview</p>
              <div className="space-y-1 text-xs text-gray-500">
                <p>
                  When completed: <span className="font-medium text-green-600">{selectedField.name}</span> → 
                  <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                    {statusValueOnComplete}
                  </span>
                </p>
                <p>
                  When declined: <span className="font-medium text-red-600">{selectedField.name}</span> → 
                  <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                    {statusValueOnDecline}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StatusColumnConfig;

