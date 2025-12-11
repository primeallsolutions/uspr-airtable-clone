import { MoreVertical, Trash2 } from "lucide-react";
import CellEditor from "../../app/bases/[id]/CellEditor";
import type { RecordRow, FieldRow, SavingCell, TableRow as TableRowType } from "@/lib/types/base-detail";

interface TableRowProps {
  record: RecordRow;
  fields: FieldRow[];
  allFields?: FieldRow[]; // All fields from all tables (for masterlist matching)
  tables: TableRowType[];
  selectedTableId: string | null;
  rowIndex: number;
  savingCell: SavingCell;
  isSelected: boolean;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onDeleteRow: (recordId: string) => void;
  onRowContextMenu: (e: React.MouseEvent, record: RecordRow) => void;
  onSelectRow: (recordId: string, checked: boolean) => void;
  canDeleteRow?: boolean;
  colorFieldId?: string | null;
  colorAssignments?: Record<string, string>;
}

export const TableRow = ({
  record,
  fields,
  allFields = fields, // Default to fields if allFields not provided
  tables,
  selectedTableId,
  rowIndex,
  savingCell,
  isSelected,
  onUpdateCell,
  onDeleteRow,
  onRowContextMenu,
  canDeleteRow = true,
  onSelectRow,
  colorFieldId,
  colorAssignments
}: TableRowProps) => {
  const isSaving = savingCell?.recordId === record.id;
  
  // Determine if we're viewing the masterlist
  const selectedTable = selectedTableId ? tables.find(t => t.id === selectedTableId) : null;
  const isMasterListView = selectedTable?.is_master_list ?? false;
  
  const colorValue = colorFieldId ? record.values?.[colorFieldId] : null;
  const colorKey = colorFieldId
    ? (colorValue === null || colorValue === undefined || colorValue === '' ? '__empty' : String(colorValue))
    : null;
  const rowColor = colorKey && colorAssignments ? colorAssignments[colorKey] : undefined;

  return (
    <div
      className={`flex border-b border-gray-200 hover:bg-gray-50 group ${isSelected ? 'bg-blue-50' : ''}`}
      style={{ borderLeftColor: rowColor || 'transparent' }}
    >
      {/* Checkbox column */}
      <div className="w-10 flex-shrink-0 border-r border-gray-200 flex items-center justify-start pl-3 sticky left-0 z-30 bg-white">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectRow(record.id, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      
      {/* Row number and table indicator */}
      <div className="w-12 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col items-center justify-center py-1 sticky left-10 z-30">
        <span className="text-xs text-gray-500">{rowIndex + 1}</span>
        
      </div>
      
      {/* Field cells */}
      {fields.map((field, idx) => {
        // When viewing masterlist, we need to find the value for this field name
        // Records have values keyed by field IDs from their own table
        // But deduplicated fields might have IDs from different tables
        let value: unknown = undefined;
        let actualFieldId = field.id; // Track which field ID we're actually using for the value
        
        if (isMasterListView) {
          // Find all fields with the same name from ALL tables (not just deduplicated fields)
          const fieldsWithSameName = allFields.filter(f => f.name === field.name);
          
          // First, try the exact field ID match
          if (record.values?.[field.id] !== undefined) {
            value = record.values[field.id];
            actualFieldId = field.id;
          } else {
            // If no exact match, try to find a field with the same name that belongs to the record's table
            // This ensures we find the correct field ID even if deduplication kept a different table's field
            for (const matchingField of fieldsWithSameName) {
              if (matchingField.table_id === record.table_id) {
                const matchingValue = record.values?.[matchingField.id];
                if (matchingValue !== undefined && matchingValue !== null && matchingValue !== '') {
                  value = matchingValue;
                  actualFieldId = matchingField.id;
                  break; // Use the first matching field from the record's table with data
                }
              }
            }
          }
        } else {
          // For non-masterlist views, use direct field ID lookup
          value = record.values?.[field.id];
          actualFieldId = field.id;
        }
        
        const isCellSaving = savingCell?.recordId === record.id && savingCell?.fieldId === actualFieldId;
        
        const renderCellContent = () => {
          return (
            <CellEditor
              field={field}
              value={value}
              onUpdate={(newValue) => onUpdateCell(record.id, actualFieldId, newValue)}
              isSaving={isCellSaving}
            />
          );
        };
        
        const isSticky = idx === 0; // keep first data column visible
        const leftOffset = idx === 0 ? '5.5rem' : undefined; // checkbox + row number widths
        // Check if this cell might have multi-line content (text with newlines)
        const hasMultiLineContent = typeof value === 'string' && value.includes('\n');
        return (
          <div
            key={field.id}
            className={`flex-1 min-w-[150px] max-w-[300px] border-r border-gray-200 relative p-2 ${hasMultiLineContent ? 'items-start' : 'flex items-center'} ${isSticky ? 'sticky z-20 bg-white shadow-[4px_0_6px_-4px_rgba(0,0,0,0.08)]' : ''}`}
            style={isSticky ? { left: leftOffset } : undefined}
          >
            {renderCellContent()}
          </div>
        );
      })}
      
      {/* Row actions */}
      <div className="w-32 flex-shrink-0 flex items-center justify-center">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => onRowContextMenu(e, record)}
            className="p-1 hover:bg-gray-200 rounded"
            title="Row options"
          >
            <MoreVertical size={14} />
          </button>
          {canDeleteRow && (
            <button
              onClick={() => onDeleteRow(record.id)}
              className="p-1 hover:bg-red-100 text-red-600 hover:text-red-800 rounded"
              title="Delete row"
              disabled={isSaving}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
