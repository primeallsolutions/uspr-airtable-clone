import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronDown, GripVertical } from "lucide-react";
import type { RecordRow, FieldRow, TableRow, SavingCell } from "@/lib/types/base-detail";
import { RecordDetailsModal } from "./RecordDetailsModal";

interface KanbanViewProps {
  records: RecordRow[];
  fields: FieldRow[];
  tables: TableRow[];
  selectedTableId: string | null;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => Promise<void> | void;
  onDeleteRow: (recordId: string) => Promise<void> | void;
  onAddRow: (values?: Record<string, unknown>) => void | Promise<void>;
  savingCell: SavingCell;
  canDeleteRow?: boolean;
}

interface KanbanColumn {
  value: string | null; // The actual value to set when dropping (option id or raw value)
  label: string;        // Display label
  color: string;        // Column color
  records: RecordRow[]; // Records in this column
}

interface DropdownOption {
  key: string;
  label: string;
  color: string;
}

// Simple color palette for columns
const COLUMN_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"
];

const getColorForIndex = (index: number) => COLUMN_COLORS[index % COLUMN_COLORS.length];

// Extract dropdown options from a select field (supports single, multi, and radio select formats)
const getDropdownOptions = (field: FieldRow): DropdownOption[] => {
  if (!field.options) {
    console.log(`    ⚠️ Field "${field.name}" has no options`);
    return [];
  }
  
  if (field.type !== "single_select" && field.type !== "multi_select" && field.type !== "radio_select") {
    console.log(`    ⚠️ Field "${field.name}" is not select type: ${field.type}`);
    return [];
  }
  
  const options = field.options;
  console.log(`    🔎 Parsing options for "${field.name}":`, typeof options, options);
  
  // Format 1: { choices: ["Option1", "Option2", ...] }
  if (typeof options === "object" && "choices" in options && Array.isArray(options.choices)) {
    console.log(`    ✅ Format 1 detected (choices array):`, options.choices);
    return (options.choices as string[]).map((choice, index) => ({
      key: choice,
      label: choice,
      color: getColorForIndex(index)
    }));
  }
  
  // Format 2: { "key1": { label: "Option1", color: "..." }, "key2": { label: "Option2" }, ... }
  if (typeof options === "object" && !Array.isArray(options)) {
    console.log(`    🔎 Format 2 detected (object), entries:`, Object.keys(options));
    const result = Object.entries(options)
      .map(([key, value], index) => {
        // Handle string values: { "option_1": "Employed" }
        if (typeof value === "string") {
          return {
            key,
            label: value,
            color: getColorForIndex(index)
          };
        }
        
        // Handle object values
        if (value && typeof value === "object") {
          const opt = value as { 
            label?: string; 
            name?: string; 
            value?: string;
            color?: string 
          };
          
          // Try to extract label from various properties
          const label = opt.label || opt.name || opt.value || key;
          
          console.log(`    📝 Parsing entry "${key}":`, { opt, extractedLabel: label });
          
          return {
            key,
            label,
            color: opt.color ?? getColorForIndex(index)
          };
        }
        
        console.log(`    ⚠️ Skipping invalid entry:`, key, typeof value, value);
        return null;
      })
      .filter((opt): opt is DropdownOption => opt !== null);
    console.log(`    ✅ Format 2 parsed:`, result);
    return result;
  }
  
  console.log(`    ❌ Unknown options format for "${field.name}"`);
  return [];
};

export const KanbanView = ({
  records,
  fields,
  tables,
  selectedTableId,
  onUpdateCell,
  onDeleteRow,
  onAddRow,
  savingCell,
  canDeleteRow = true
}: KanbanViewProps) => {
  console.log("🎬 KanbanView render:", {
    recordsCount: records.length,
    fieldsCount: fields.length,
    fieldNames: fields.map(f => f.name)
  });
  
  // State
  const [stackByFieldId, setStackByFieldId] = useState<string | null>(null);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [draggedRecordId, setDraggedRecordId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const expandedRecord = useMemo(
    () => (expandedRecordId ? records.find(r => r.id === expandedRecordId) || null : null),
    [expandedRecordId, records]
  );
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 1: Get all columns with dropdown/options (single_select, multi_select & radio_select fields)
  const dropdownFields = useMemo(
    () => {
      console.log("🔍 Detecting dropdown fields:", {
        totalFields: fields.length,
        fieldTypes: fields.map(f => ({ name: f.name, type: f.type, hasOptions: !!f.options }))
      });
      
      const result = fields.filter(field => {
        const isSelectType = field.type === "single_select" || field.type === "multi_select" || field.type === "radio_select";
        const options = getDropdownOptions(field);
        const hasOptions = options.length > 0;
        
        console.log(`  Field "${field.name}":`, {
          type: field.type,
          isSelectType,
          rawOptions: field.options,
          extractedOptions: options,
          hasOptions,
          included: isSelectType && hasOptions
        });
        
        if (!isSelectType) return false;
        return hasOptions;
      });
      
      console.log("✅ Dropdown fields found:", result.length, result.map(f => f.name));
      return result;
    },
    [fields]
  );

  // Step 2: Auto-select the first dropdown field for "Stacked by"
  useEffect(() => {
    if (dropdownFields.length === 0) {
      setStackByFieldId(null);
      return;
    }

    const currentIsValid = stackByFieldId && dropdownFields.some(field => field.id === stackByFieldId);
    if (!currentIsValid) {
      setStackByFieldId(dropdownFields[0].id);
    }
  }, [stackByFieldId, dropdownFields]);

  // Get the selected "Stacked by" field
  const stackedByField = useMemo(
    () => dropdownFields.find(f => f.id === stackByFieldId),
    [dropdownFields, stackByFieldId]
  );

  const stackedByOptions = useMemo(
    () => stackedByField ? getDropdownOptions(stackedByField) : [],
    [stackedByField]
  );

  // Step 3: Build Kanban columns based on the dropdown options of the selected field
  const columns = useMemo<KanbanColumn[]>(() => {
    if (!stackedByField) return [];

    // Get all options from the dropdown
    const dropdownOptions = stackedByOptions;
    const noValueColumn: KanbanColumn = {
      value: null,
      label: "No data",
      color: "#9ca3af",
      records: []
    };
    
    // Create a column for each option
    // IMPORTANT: The database stores the KEY (e.g., "option_2"), not the label
    // So we use the key as the value to match what Grid view saves
    const cols: KanbanColumn[] = dropdownOptions.map((option, index) => ({
      value: option.key,    // Use KEY to match what Grid view saves
      label: option.label,  // Display label to user
      color: option.color ?? getColorForIndex(index),
      records: []
    }));

    // Add "No Value" column as the FIRST column (leftmost)
    cols.unshift(noValueColumn);

    // Build a map for O(1) column lookups
    const columnsByValue = new Map<string, KanbanColumn>(
      cols.filter(col => col.value !== null).map(col => [String(col.value), col])
    );

    // Function to find which column a record belongs to
    const findColumnForValue = (rawValue: unknown): KanbanColumn => {
      // Handle empty values
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        return noValueColumn;
      }

      // Handle arrays (for multi_select fields) - take first value
      const valueToMatch = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      
      if (valueToMatch === null || valueToMatch === undefined || valueToMatch === '') {
        return noValueColumn;
      }

      // Try exact match first
      const valueString = String(valueToMatch);
      const exactMatch = columnsByValue.get(valueString);
      if (exactMatch) {
        return exactMatch;
      }

      // Case-insensitive fallback match
      const lowerValue = valueString.toLowerCase();
      for (const [colValue, column] of columnsByValue.entries()) {
        if (colValue.toLowerCase() === lowerValue) {
          return column;
        }
      }

      // No match found - goes to "No Value"
      console.warn("⚠️ Record value doesn't match any column:", valueString);
      return noValueColumn;
    };

    // Step 4: Distribute records into columns based on their field value
    records.forEach(record => {
      const recordValue = record.values?.[stackedByField.id];
      const matchingColumn = findColumnForValue(recordValue);
      matchingColumn.records.push(record);
    });

    console.log("📊 Kanban columns built:", {
      fieldName: stackedByField.name,
      totalRecords: records.length,
      columns: cols.map(col => ({
        label: col.label,
        value: col.value,
        recordCount: col.records.length
      }))
    });

    return cols;
  }, [stackedByField, stackedByOptions, records]);

  // Get primary field for card title display
  const primaryField = useMemo(
    () => fields.find(f => f.type === "text") || fields[0],
    [fields]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFieldSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Drag and Drop Handlers
  const handleDragStart = (recordId: string) => {
    setDraggedRecordId(recordId);
  };

  const handleDragEnd = () => {
    setDraggedRecordId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnValue: string | null) => {
    e.preventDefault();
    setDragOverColumn(columnValue);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const formatValueForField = (value: string | null) => {
    if (!stackedByField) return value;
    if (stackedByField.type === "multi_select") {
      return value ? [value] : null;
    }
    return value;
  };

  // Step 5: When card is dropped, update the record's field value
  const handleDrop = async (e: React.DragEvent, columnValue: string | null) => {
    e.preventDefault();
    
    if (!draggedRecordId || !stackedByField) return;

    const formattedValue = formatValueForField(columnValue);
    
    console.log("🎯 Kanban Drop:", {
      recordId: draggedRecordId,
      fieldId: stackedByField.id,
      fieldName: stackedByField.name,
      fieldType: stackedByField.type,
      columnValue: columnValue,
      formattedValue: formattedValue
    });

    try {
      // Update the record's field to match the column value
      await onUpdateCell(draggedRecordId, stackedByField.id, formattedValue);
      console.log("✅ Kanban update successful");
    } catch (error) {
      console.error("❌ Failed to update record:", error);
    } finally {
      setDraggedRecordId(null);
      setDragOverColumn(null);
    }
  };

  // Add new card/contact to a specific column
  const handleAddCard = async (columnValue: string | null) => {
    if (!stackedByField) return;

    const formattedValue = formatValueForField(columnValue);
    const initialValues = columnValue === null
      ? {}
      : { [stackedByField.id]: formattedValue };

    try {
      await onAddRow(initialValues);
    } catch (error) {
      console.error("Failed to add card:", error);
    }
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "No data";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Show message if no dropdown fields exist
  if (dropdownFields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Set up Kanban Board</h3>
          <p className="text-gray-600 mb-4">
            To use Kanban view, you need at least one <span className="font-medium">Single Select</span> column with dropdown options.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm">
            <p className="font-medium text-gray-900 mb-2">How to set up:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Create a Single Select field (e.g., &ldquo;Status&rdquo;)</li>
              <li>Add dropdown options (e.g., &ldquo;Buylist&rdquo;, &ldquo;Waiting For Documents&rdquo;, &ldquo;Pre Qualified&rdquo;)</li>
              <li>Each option will become a Kanban board column</li>
              <li>Drag cards between boards to update their status</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!stackedByField) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header - Stacked By Selector */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Stacked by:</span>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => dropdownFields.length > 1 && setShowFieldSelector(!showFieldSelector)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={dropdownFields.length === 1}
            >
              {stackedByField.name}
              {dropdownFields.length > 1 && (
                <ChevronDown className={`w-4 h-4 transition-transform ${showFieldSelector ? "rotate-180" : ""}`} />
              )}
            </button>

            {/* Dropdown to select different field */}
            {showFieldSelector && dropdownFields.length > 1 && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {dropdownFields.map(field => (
                  <button
                    key={field.id}
                    onClick={() => {
                      setStackByFieldId(field.id);
                      setShowFieldSelector(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      field.id === stackedByField.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                    }`}
                  >
                    {field.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {records.length} {records.length === 1 ? "contact" : "contacts"}
        </div>
      </div>

      {/* Kanban Board - Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full">
          {columns.map(column => (
            <div
              key={column.value ?? "__empty__"}
              className="flex-shrink-0 w-80 flex flex-col"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: column.color }}
                  />
                  <h3 className="font-semibold text-gray-900">{column.label}</h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {column.records.length}
                  </span>
                </div>
              </div>

              {/* Drop Zone for Cards */}
              <div
                onDragOver={e => handleDragOver(e, column.value)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, column.value)}
                className={`flex-1 overflow-y-auto rounded-lg p-3 transition-colors ${
                  dragOverColumn === column.value
                    ? "bg-blue-50"
                    : "bg-gray-50"
                }`}
              >
                {/* Contact Cards */}
                <div className="space-y-2.5">
                  {column.records.map(record => {
                    const isDragging = draggedRecordId === record.id;
                    const isSaving = savingCell?.recordId === record.id;
                    const displayTitle = primaryField 
                      ? formatValue(record.values?.[primaryField.id])
                      : `Record ${record.id.slice(0, 8)}`;

                    return (
                      <div
                        key={record.id}
                        draggable
                        onDragStart={() => handleDragStart(record.id)}
                        onDragEnd={handleDragEnd}
                        className={`group bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                          isDragging ? "opacity-40 scale-95" : ""
                        }`}
                      >
                        {/* Card Content */}
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 break-words mb-2">
                              {displayTitle}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <button
                                onClick={() => setExpandedRecordId(record.id)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                View details
                              </button>
                              {canDeleteRow && (
                                <>
                                  <span>•</span>
                                  <button
                                    onClick={() => {
                                      if (confirm("Delete this contact?")) {
                                        onDeleteRow(record.id);
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {isSaving && (
                            <div className="flex-shrink-0">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Card Button */}
                <button
                  onClick={() => handleAddCard(column.value)}
                  className="w-full mt-3 py-2 px-3 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 hover:shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add contact
                </button>

                {/* Empty State */}
                {column.records.length === 0 && (
                  <div className="mt-8 text-center text-xs text-gray-400">
                    <p>No contacts yet</p>
                    <p className="mt-1">Drag contacts here or click &ldquo;Add contact&rdquo;</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <RecordDetailsModal
        isOpen={Boolean(expandedRecord)}
        record={expandedRecord}
        fields={fields}
        tables={tables}
        selectedTableId={selectedTableId}
        savingCell={savingCell}
        onUpdateCell={onUpdateCell}
        onClose={() => setExpandedRecordId(null)}
      />
    </div>
  );
};
