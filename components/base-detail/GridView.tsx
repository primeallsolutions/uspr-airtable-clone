import { useMemo, useState, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import type { RecordRow, FieldRow, SavingCell, TableRow as TableRowType } from "@/lib/types/base-detail";

interface GridViewProps {
  records: RecordRow[];
  fields: FieldRow[];
  allFields?: FieldRow[]; // All fields from all tables (for masterlist matching)
  tables: TableRowType[];
  selectedTableId: string | null;
  sortFieldId: string | null;
  sortDirection: 'asc' | 'desc';
  savingCell: SavingCell;
  onSort: (fieldId: string) => void;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onDeleteRow: (recordId: string) => void;
  onBulkDelete: (recordIds: string[]) => void;
  onAddRow: (values?: Record<string, unknown>) => void | Promise<void>;
  onAddField: () => void;
  onFieldContextMenu: (e: React.MouseEvent, field: FieldRow) => void;
  onRowContextMenu: (e: React.MouseEvent, record: RecordRow) => void;
  onReorderFields?: (reorderedFields: FieldRow[]) => void;
  canDeleteRow?: boolean;
  groupFieldIds?: string[];
  colorFieldId?: string | null;
  colorAssignments?: Record<string, string>;
}

export const GridView = ({
  records,
  fields,
  allFields,
  tables,
  selectedTableId,
  sortFieldId,
  sortDirection,
  savingCell,
  onSort,
  onUpdateCell,
  onDeleteRow,
  onBulkDelete,
  onAddRow,
  onAddField,
  onFieldContextMenu,
  onRowContextMenu,
  onReorderFields,
  canDeleteRow = true,
  groupFieldIds,
  colorFieldId,
  colorAssignments = {}
}: GridViewProps) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const initialOrderRef = useRef<string[] | null>(null);

  // Preserve stable row ordering based on initial load to prevent reordering on updates
  const displayRecords = useMemo(() => {
    // On first render or when records change significantly, capture the initial order
    if (initialOrderRef.current === null || initialOrderRef.current.length === 0) {
      initialOrderRef.current = records.map(r => r.id);
      return records;
    }

    // Build a map of current record IDs for quick lookup
    const recordsById = new Map(records.map(r => [r.id, r]));
    
    // Maintain the initial order, filtering out deleted records
    const orderedRecords = initialOrderRef.current
      .map(id => recordsById.get(id))
      .filter((r): r is RecordRow => r !== undefined);
    
    // Add any new records that weren't in the initial order (append to end)
    const existingIds = new Set(initialOrderRef.current);
    const newRecords = records.filter(r => !existingIds.has(r.id));
    
    if (newRecords.length > 0) {
      // Update the initial order ref to include new records
      initialOrderRef.current = [...initialOrderRef.current.filter(id => recordsById.has(id)), ...newRecords.map(r => r.id)];
      return [...orderedRecords, ...newRecords];
    }
    
    return orderedRecords;
  }, [records]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(displayRecords.map(r => r.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (recordId: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(recordId);
    } else {
      newSelected.delete(recordId);
    }
    setSelectedRows(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    
    const count = selectedRows.size;
    if (confirm(`Are you sure you want to delete ${count} ${count === 1 ? 'record' : 'records'}? This action cannot be undone.`)) {
      onBulkDelete(Array.from(selectedRows));
      setSelectedRows(new Set());
    }
  };

  const allSelected = displayRecords.length > 0 && selectedRows.size === displayRecords.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < displayRecords.length;

  type GroupSection = {
    id: string;
    label: string;
    field: FieldRow;
    depth: number;
    count: number;
    records: RecordRow[];
    children: GroupSection[];
  };

  const groupedSections = useMemo(() => {
    if (!groupFieldIds || groupFieldIds.length === 0) return null;
    // Use allFields if available (for masterlist), otherwise fall back to fields
    const fieldsToUse = allFields || fields;
    const validIds = groupFieldIds.filter(id => fieldsToUse.some(field => field.id === id));
    if (validIds.length === 0) return null;

    const buildSections = (data: RecordRow[], ids: string[], depth = 0): GroupSection[] => {
      if (ids.length === 0) {
        return [];
      }
      const [currentId, ...rest] = ids;
      const groupField = fieldsToUse.find(field => field.id === currentId);
      if (!groupField) {
        return rest.length ? buildSections(data, rest, depth) : [];
      }

      const buckets = new Map<string, RecordRow[]>();
      data.forEach(record => {
        const rawValue = record.values?.[currentId];
        const label = rawValue === null || rawValue === undefined || rawValue === '' ? 'No value' : String(rawValue);
        if (!buckets.has(label)) {
          buckets.set(label, []);
        }
        buckets.get(label)!.push(record);
      });

      return Array.from(buckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
        .map(([label, bucketRecords], index) => ({
          id: `${currentId}-${label}-${depth}-${index}`,
          label,
          field: groupField,
          depth,
          count: bucketRecords.length,
          records: rest.length ? [] : bucketRecords,
          children: rest.length ? buildSections(bucketRecords, rest, depth + 1) : []
        }));
    };

    return buildSections(displayRecords, validIds);
  }, [displayRecords, groupFieldIds, allFields, fields]);

  let rowCounter = 0;

  const renderGroupSections = (sections: GroupSection[]) =>
    sections.map(section => (
      <div key={section.id}>
        <div
          className="px-4 py-2 bg-gray-100 border-t border-b border-gray-200 flex items-center justify-between"
          style={{ paddingLeft: `${section.depth * 24 + 12}px` }}
        >
          <div>
            <div className="text-sm font-semibold text-gray-700">
              {section.field.name}: {section.label}
            </div>
            <div className="text-xs text-gray-500">
              {section.count} {section.count === 1 ? 'record' : 'records'}
            </div>
          </div>
        </div>
        {section.children.length > 0
          ? renderGroupSections(section.children)
          : section.records.map(record => {
              const currentIndex = rowCounter;
              rowCounter += 1;
              return (
                <TableRow
                  key={record.id}
                  record={record}
                  fields={fields}
                  tables={tables}
                  selectedTableId={selectedTableId}
                  rowIndex={currentIndex}
                  savingCell={savingCell}
                  isSelected={selectedRows.has(record.id)}
                  onUpdateCell={onUpdateCell}
                  onDeleteRow={onDeleteRow}
                  onRowContextMenu={onRowContextMenu}
                  onSelectRow={handleSelectRow}
                  canDeleteRow={canDeleteRow}
                  colorFieldId={colorFieldId}
                  colorAssignments={colorAssignments}
                />
              );
            })}
      </div>
    ));

  const rowContent = groupedSections
    ? renderGroupSections(groupedSections)
    : displayRecords.map((record, index) => (
        <TableRow
          key={record.id}
          record={record}
          fields={fields}
          allFields={allFields} // Pass all fields for masterlist field matching
          tables={tables}
          selectedTableId={selectedTableId}
          rowIndex={index}
          savingCell={savingCell}
          isSelected={selectedRows.has(record.id)}
          onUpdateCell={onUpdateCell}
          onDeleteRow={onDeleteRow}
          onRowContextMenu={onRowContextMenu}
          onSelectRow={handleSelectRow}
          canDeleteRow={canDeleteRow}
          colorFieldId={colorFieldId}
          colorAssignments={colorAssignments}
        />
      ));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-200 flex-shrink-0">
          <span className="text-sm font-medium text-blue-900">
            {selectedRows.size} {selectedRows.size === 1 ? 'row' : 'rows'} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
        </div>
      )}

      {/* Single Scrollable Container for Table */}
      <div className="flex-1 min-h-0 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
        <div className="min-w-max">
          {/* Sticky Table Header */}
          <div className="sticky top-0 z-10 bg-gray-50">
            <TableHeader
              fields={fields}
              sortFieldId={sortFieldId}
              sortDirection={sortDirection}
              allSelected={allSelected}
              someSelected={someSelected}
              onSort={onSort}
              onAddField={onAddField}
              onFieldContextMenu={onFieldContextMenu}
              onSelectAll={handleSelectAll}
              onReorderFields={onReorderFields}
            />
          </div>
          
          {/* Table Body */}
          {records.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No records yet</h3>
                <p className="text-gray-500 mb-4">Get started by adding your first record</p>
                <button
                  onClick={() => onAddRow()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} />
                  Add Row
                </button>
              </div>
            </div>
          ) : (
            <>
              {rowContent}
              
              {/* Add Row button spanning entire row */}
              <div className="flex border-b border-gray-200 hover:bg-gray-50">
                {/* Checkbox column */}
                <div className="w-10 flex-shrink-0 border-r border-gray-200"></div>
                
                <div className="w-12 flex-shrink-0 border-r border-gray-200 bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-500">+</span>
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onAddRow()}
                    className="w-full h-12 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={16} />
                    <span>Add Row</span>
                  </button>
                </div>
                <div className="w-32 flex-shrink-0"></div>
              </div>
              
              {/* Footer with record count */}
              <div className="flex items-center justify-end px-6 py-3 bg-gray-50 border-t border-gray-200">
                <span className="text-sm text-gray-500">{records.length} {records.length === 1 ? 'record' : 'records'}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
