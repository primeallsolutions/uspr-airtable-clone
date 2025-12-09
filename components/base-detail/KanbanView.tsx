import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, X, Edit2, Trash2 } from "lucide-react";
import type { RecordRow, FieldRow, TableRow } from "@/lib/types/base-detail";

interface KanbanViewProps {
  records: RecordRow[];
  fields: FieldRow[];
  tables: TableRow[];
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => Promise<void> | void;
  onDeleteRow: (recordId: string) => Promise<void> | void;
  onAddRow: (values?: Record<string, unknown>) => void | Promise<void>;
  onAddStackValue?: (fieldId: string, label: string) => void | Promise<void>;
  savingCell: { recordId: string; fieldId: string } | null;
  canDeleteRow?: boolean;
  onFieldContextMenu?: (e: React.MouseEvent, field: FieldRow) => void;
}

type StackOption = {
  key: string;
  label: string;
  color?: string;
};

type KanbanColumn = {
  id: string;
  label: string;
  color: string;
  persistValue: string | null;
  isUncategorized?: boolean;
};

const colorPalette = [
  "#2563eb",
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#6366f1",
  "#10b981",
  "#14b8a6",
  "#f43f5e",
  "#8b5cf6",
  "#64748b"
];

const pickColor = (seed: string) => {
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colorPalette[Math.abs(hash) % colorPalette.length];
};

const normalizeStackOptions = (field?: FieldRow | null): StackOption[] => {
  if (!field || field.type !== "single_select" || !field.options) return [];

  const options = field.options;

  if (typeof options === "object" && !Array.isArray(options)) {
    const entries = Object.entries(options);
    const hasLabelObjects = entries.some(([, val]) => val && typeof val === "object" && "label" in (val as Record<string, unknown>));

    if (hasLabelObjects) {
      return entries.map(([key, option]) => {
        const opt = option as { label: string; color?: string };
        return { key, label: opt.label, color: opt.color };
      });
    }

    const choices = (options as { choices?: string[] }).choices;
    if (Array.isArray(choices)) {
      return choices.map(choice => ({ key: choice, label: choice }));
    }

    return entries.map(([key, val]) => ({
      key,
      label: typeof val === "string" ? val : key
    }));
  }

  return [];
};

export const KanbanView = ({ 
  records, 
  fields, 
  tables,
  onUpdateCell, 
  onDeleteRow, 
  onAddRow, 
  savingCell,
  onAddStackValue,
  canDeleteRow = true,
  onFieldContextMenu 
}: KanbanViewProps) => {
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedStackFieldId, setSelectedStackFieldId] = useState<string | null>(null);
  const [isFieldDropdownOpen, setIsFieldDropdownOpen] = useState(false);
  const [pendingMoveId, setPendingMoveId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldId: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Get all single_select fields for stacking options
  const singleSelectFields = useMemo(
    () => fields.filter(f => f.type === "single_select"),
    [fields]
  );

  // Use selected field or default to first single_select field (Airtable-style "stacked by")
  const stackField = useMemo(() => {
    if (selectedStackFieldId) {
      const found = fields.find(f => f.id === selectedStackFieldId);
      if (found) return found;
    }
    return singleSelectFields[0];
  }, [fields, selectedStackFieldId, singleSelectFields]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFieldDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const stackOptions = useMemo(() => normalizeStackOptions(stackField), [stackField]);

  // Build Kanban columns purely from single-select field options (Airtable-style)
  const { columns, columnLookup, uncategorizedColumn } = useMemo(() => {
    // Build columns from single-select field options
    const baseColumns: KanbanColumn[] = stackOptions.map((option, index) => ({
      id: `option-${option.key}`,
      label: option.label,
      color: option.color || pickColor(option.label),
      persistValue: option.key
    }));

    const uncategorized: KanbanColumn = {
      id: "uncategorized",
      label: "No Status",
      color: "#9ca3af",
      persistValue: null,
      isUncategorized: true
    };

    const finalColumns = [uncategorized, ...baseColumns];

    const lookup = new Map<string, string>();
    finalColumns.forEach(col => {
      lookup.set(col.label, col.id);
      lookup.set(col.label.toLowerCase(), col.id);
      if (col.persistValue !== null) {
        lookup.set(String(col.persistValue), col.id);
        lookup.set(String(col.persistValue).toLowerCase(), col.id);
      }
    });

    return { columns: finalColumns, columnLookup: lookup, uncategorizedColumn: uncategorized };
  }, [stackOptions]);

  // Group records by the selected stack field value
  const groupedRecords = useMemo(() => {
    const groups = new Map<string, RecordRow[]>();
    columns.forEach(col => groups.set(col.id, []));

    const fallbackColumnId = uncategorizedColumn?.id || columns[0]?.id || "default";

    records.forEach(record => {
      if (!stackField) {
        groups.get(fallbackColumnId)?.push(record);
        return;
      }

      const rawValue = record.values?.[stackField.id];
      
      // Handle empty/null values
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        groups.get(fallbackColumnId)?.push(record);
        return;
      }

      // Find matching column by the persisted value
      const valueString = String(rawValue);
      const normalized = valueString.toLowerCase();
      
      let matchedColumnId = columnLookup.get(valueString) || columnLookup.get(normalized);
      
      // If no direct match, try finding by label
      if (!matchedColumnId) {
        const matchingOption = stackOptions.find(opt => 
          opt.key === valueString || 
          opt.label === valueString || 
          opt.label.toLowerCase() === normalized
        );
        if (matchingOption) {
          matchedColumnId = columnLookup.get(matchingOption.key);
        }
      }

      const groupId = matchedColumnId || fallbackColumnId;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)?.push(record);
    });

    return groups;
  }, [columnLookup, columns, records, stackField, uncategorizedColumn, stackOptions]);

  // Determine primary / secondary fields for card display
  const primaryDisplayField = useMemo(
    () =>
      fields.find(f => f.id !== stackField?.id && f.type === "text") ||
      fields.find(f => f.id !== stackField?.id && f.type === "single_select") ||
      fields.find(f => f.id !== stackField?.id),
    [fields, stackField?.id]
  );

  const secondaryDisplayFields = useMemo(
    () =>
      fields
        .filter(f => f.id !== stackField?.id && f.id !== primaryDisplayField?.id)
        .slice(0, 2),
    [fields, stackField?.id, primaryDisplayField?.id]
  );

  const getSingleSelectLabel = (field: FieldRow | undefined, value: unknown) => {
    if (!field || field.type !== "single_select") return null;
    const opts = normalizeStackOptions(field);
    const stringVal = value === null || value === undefined ? null : String(value);
    if (!stringVal) return null;
    const match = opts.find(o => o.key === stringVal || o.label === stringVal);
    return match?.label || stringVal;
  };

  const formatValue = (field: FieldRow | undefined, value: unknown) => {
    if (value === null || value === undefined || value === "") return "Empty";
    if (field?.type === "single_select") {
      return getSingleSelectLabel(field, value) ?? "Empty";
    }
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  if (!stackField) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Kanban View Needs Single Select Field</h3>
          <p className="text-gray-500 mb-4">Add a single select field to organize records in columns</p>
        </div>
      </div>
    );
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, recordId: string) => {
    setDraggedCard(recordId);
    setSelectedRecord(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', recordId);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverColumn(null);
    setPendingMoveId(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    const recordId = draggedCard || e.dataTransfer.getData("text/plain");
    if (!recordId || !stackField) return;

    const valueToSet = column.persistValue;
    const hasOption = stackOptions.some(opt => {
      const normalizedLabel = opt.label.toLowerCase();
      return opt.key === valueToSet || normalizedLabel === column.label.toLowerCase();
    });
    setPendingMoveId(recordId);

    try {
      if (!hasOption && onAddStackValue && valueToSet !== null) {
        await onAddStackValue(stackField.id, column.label);
      }
      await onUpdateCell(recordId, stackField.id, valueToSet);
    } catch (err) {
      console.error("Failed to move card", err);
    } finally {
      setPendingMoveId(null);
      setDraggedCard(null);
      setDragOverColumn(null);
    }
  };

  const handleCreateCard = async (column: KanbanColumn) => {
    if (!stackField) return;
    const defaultValues = column.persistValue !== null ? { [stackField.id]: column.persistValue } : {};

    try {
      await onAddRow(defaultValues);
    } catch (err) {
      console.error("Failed to add card", err);
    }
  };

  const handleStartEdit = (recordId: string, fieldId: string, currentValue: unknown) => {
    setEditingCell({ recordId, fieldId });
    setEditingValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
    // Focus the input after a brief delay to allow rendering
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 50);
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    
    try {
      await onUpdateCell(editingCell.recordId, editingCell.fieldId, editingValue);
    } catch (err) {
      console.error("Failed to update cell", err);
    } finally {
      setEditingCell(null);
      setEditingValue("");
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Field Selection Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Stacked by</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => singleSelectFields.length > 1 && setIsFieldDropdownOpen(!isFieldDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span>{stackField?.name || "Select field"}</span>
                {singleSelectFields.length > 1 && (
                  <ChevronDown size={16} className={`transition-transform ${isFieldDropdownOpen ? "rotate-180" : ""}`} />
                )}
              </button>
              
              {isFieldDropdownOpen && singleSelectFields.length > 1 && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {singleSelectFields.map((field) => (
                    <button
                      key={field.id}
                      onClick={() => {
                        setSelectedStackFieldId(field.id);
                        setIsFieldDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        stackField?.id === field.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
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
            {records.length} records
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-max h-full items-start">
          {columns.map((column) => {
            const recordsForColumn = groupedRecords.get(column.id) ?? [];
            return (
              <div key={column.id} className="flex-shrink-0 w-80">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <h3 className="font-semibold text-gray-900">{column.label}</h3>
                  </div>
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    {recordsForColumn.length}
                  </span>
                </div>

                {/* Column Content */}
                <div 
                  className={`min-h-[220px] p-3 rounded-xl border transition-colors ${
                    dragOverColumn === column.id 
                      ? "border-blue-400 bg-blue-50" 
                      : "border-gray-200 bg-white/60 hover:border-gray-300"
                  }`}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column)}
                >
                  {recordsForColumn.map((record) => {
                    const isDragging = draggedCard === record.id;
                    const isSaving = pendingMoveId === record.id || (savingCell?.recordId === record.id && savingCell.fieldId === stackField?.id);
                    const titleValue = primaryDisplayField ? record.values?.[primaryDisplayField.id] : record.id;

                    return (
                      <div
                        key={record.id}
                        draggable={!editingCell}
                        onDragStart={(e) => handleDragStart(e, record.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white rounded-lg border border-gray-200 p-3 mb-3 shadow-sm hover:shadow-md transition-all ${
                          isDragging ? "opacity-60 cursor-move" : "cursor-grab"
                        } ${editingCell ? "cursor-default" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          {editingCell?.recordId === record.id && editingCell?.fieldId === primaryDisplayField?.id ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              onBlur={handleSaveEdit}
                              className="flex-1 text-sm font-semibold text-gray-900 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="flex-1 text-sm font-semibold text-gray-900 truncate cursor-text hover:bg-gray-50 px-2 py-1 rounded"
                              onClick={() => primaryDisplayField && handleStartEdit(record.id, primaryDisplayField.id, titleValue)}
                            >
                              {formatValue(primaryDisplayField, titleValue)}
                            </div>
                          )}
                          {isSaving && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                        </div>

                        {secondaryDisplayFields.map((field) => {
                          const value = record.values?.[field.id];
                          const isEditing = editingCell?.recordId === record.id && editingCell?.fieldId === field.id;
                          
                          return (
                            <div key={field.id} className="mt-2">
                              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{field.name}</div>
                              {isEditing ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  onBlur={handleSaveEdit}
                                  className="w-full text-sm text-gray-800 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <div 
                                  className="text-sm text-gray-800 truncate cursor-text hover:bg-gray-50 px-2 py-1 rounded"
                                  onClick={() => handleStartEdit(record.id, field.id, value)}
                                >
                                  {formatValue(field, value)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        <div className="flex justify-between items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => !draggedCard && setSelectedRecord(record)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            View all
                          </button>
                          {canDeleteRow && (
                            <button
                              onClick={() => onDeleteRow(record.id)}
                              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Add new record button */}
                  <button
                    onClick={() => handleCreateCard(column)}
                    className="w-full mt-1 p-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add card
                  </button>
                  
                  {recordsForColumn.length === 0 && (
                    <div className="mt-2 p-2 text-xs text-gray-400 text-center">
                      Drag records here to set as {column.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {selectedRecord && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Record Details</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatValue(
                    primaryDisplayField,
                    primaryDisplayField ? selectedRecord.values?.[primaryDisplayField.id] : selectedRecord.id
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh] divide-y divide-gray-100">
              {fields.map((field) => {
                const value = selectedRecord.values?.[field.id];
                const isEditing = editingCell?.recordId === selectedRecord.id && editingCell?.fieldId === field.id;
                const isSaving = savingCell?.recordId === selectedRecord.id && savingCell?.fieldId === field.id;
                
                return (
                  <div key={field.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">{field.name}</div>
                      {isSaving && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                    </div>
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveEdit}
                        className="w-full text-sm text-gray-900 px-2 py-1.5 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div 
                        className="text-sm text-gray-900 break-words cursor-text hover:bg-gray-100 px-2 py-1.5 rounded transition-colors"
                        onClick={() => handleStartEdit(selectedRecord.id, field.id, value)}
                      >
                        {formatValue(field, value)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
