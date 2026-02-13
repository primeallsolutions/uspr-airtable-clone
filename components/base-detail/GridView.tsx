import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { RecordDetailsModal } from "./RecordDetailsModal";
import { tableLayout } from "./tableLayout";
import type { RecordRow, FieldRow, SavingCell, TableRow as TableRowType } from "@/lib/types/base-detail";

interface GridViewProps {
  records: RecordRow[];
  fields: FieldRow[];
  allFields?: FieldRow[]; // All fields from all tables (for masterlist matching)
  tables: TableRowType[];
  selectedTableId: string | null;
  baseId: string;
  sortFieldId: string | null;
  sortDirection: 'asc' | 'desc';
  savingCell: SavingCell;
  onSort: (fieldId: string) => void;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onBulkDelete: (recordIds: string[]) => void;
  onAddRow: (values?: Record<string, unknown>) => void | Promise<void>;
  addingRow?: boolean;
  onAddField: () => void;
  onFieldContextMenu: (e: React.MouseEvent, field: FieldRow) => void;
  onRowContextMenu: (e: React.MouseEvent, record: RecordRow) => void;
  onReorderFields?: (reorderedFields: FieldRow[]) => void;
  groupFieldIds?: string[];
  colorFieldId?: string | null;
  colorAssignments?: Record<string, string>;
  showCreatedAt?: boolean;
  scrollContainerRef?: React.Ref<HTMLDivElement>;
}

export const GridView = ({
  records,
  fields,
  allFields,
  tables,
  selectedTableId,
  baseId,
  sortFieldId,
  sortDirection,
  savingCell,
  onSort,
  onUpdateCell,
  onBulkDelete,
  onAddRow,
  addingRow = false,
  onAddField,
  onFieldContextMenu,
  onRowContextMenu,
  onReorderFields,
  groupFieldIds,
  colorFieldId,
  colorAssignments = {},
  showCreatedAt = false,
  scrollContainerRef
}: GridViewProps) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const initialOrderRef = useRef<string[] | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // Default 50 records per page
  const pageSizeOptions = [25, 50, 100];

  // Reset to page 1 when records change significantly
  useEffect(() => {
    setCurrentPage(1);
    // Reset order ref when records count changes significantly (more than 10% difference)
    if (initialOrderRef.current && records.length > 0) {
      const currentLength = initialOrderRef.current.length;
      const newLength = records.length;
      const diff = Math.abs(currentLength - newLength);
      // If change is significant (>10% or absolute change >100), reset
      if (diff > 100 || diff / Math.max(currentLength, newLength) > 0.1) {
        initialOrderRef.current = null;
      }
    }
  }, [records.length]);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const { selectWidth, actionsWidth, rowNumberWidth, addFieldWidth } = tableLayout;

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
    
    // Add any new records that weren't in the initial order (PREPEND to start - newest first)
    const existingIds = new Set(initialOrderRef.current);
    const newRecords = records.filter(r => !existingIds.has(r.id));
    
    if (newRecords.length > 0) {
      // Update the initial order ref to include new records at the BEGINNING
      initialOrderRef.current = [...newRecords.map(r => r.id), ...initialOrderRef.current.filter(id => recordsById.has(id))];
      return [...newRecords, ...orderedRecords];
    }
    
    // If the ordered records length doesn't match records length, there might be an inconsistency
    // In that case, fall back to using records directly to ensure accuracy
    if (orderedRecords.length !== records.length) {
      initialOrderRef.current = records.map(r => r.id);
      return records;
    }
    
    return orderedRecords;
  }, [records]);

  // Pagination calculations - use records.length for accurate total count
  // displayRecords preserves order but should match records.length
  const totalRecords = records.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  
  // Get paginated records for display
  const paginatedRecords = useMemo(() => {
    return displayRecords.slice(startIndex, endIndex);
  }, [displayRecords, startIndex, endIndex]);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => goToPage(1);
  const goToPrevPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);
  const goToLastPage = () => goToPage(totalPages);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    // Adjust current page to keep roughly the same records in view
    const firstVisibleRecord = startIndex;
    const newPage = Math.floor(firstVisibleRecord / newSize) + 1;
    setCurrentPage(Math.max(1, newPage));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select records on the current page
      setSelectedRows(new Set(paginatedRecords.map(r => r.id)));
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

  // Check if all records on current page are selected
  const allSelected = paginatedRecords.length > 0 && paginatedRecords.every(r => selectedRows.has(r.id));
  const someSelected = selectedRows.size > 0 && !allSelected;

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
        const label = rawValue === null || rawValue === undefined || rawValue === '' ? 'No data' : String(rawValue);
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

  const detailRecord = useMemo(
    () => (detailRecordId ? records.find(record => record.id === detailRecordId) || null : null),
    [detailRecordId, records]
  );

  const handleOpenDetails = (record: RecordRow) => {
    setDetailRecordId(record.id);
  };

  const handleCloseDetails = () => {
    setDetailRecordId(null);
  };

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
                  onRowContextMenu={onRowContextMenu}
                  onViewDetails={handleOpenDetails}
                  onSelectRow={handleSelectRow}
                  colorFieldId={colorFieldId}
                  colorAssignments={colorAssignments}
                />
              );
            })}
      </div>
    ));

  const rowContent = groupedSections
    ? renderGroupSections(groupedSections)
    : paginatedRecords.map((record, index) => (
        <TableRow
          key={record.id}
          record={record}
          fields={fields}
          allFields={allFields} // Pass all fields for masterlist field matching
          tables={tables}
          selectedTableId={selectedTableId}
          rowIndex={startIndex + index} // Use actual row index for display
          savingCell={savingCell}
          isSelected={selectedRows.has(record.id)}
          onUpdateCell={onUpdateCell}
          onRowContextMenu={onRowContextMenu}
          onViewDetails={handleOpenDetails}
          onSelectRow={handleSelectRow}
          colorFieldId={colorFieldId}
          colorAssignments={colorAssignments}
          showCreatedAt={showCreatedAt}
        />
      ));

  return (
    <>
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
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
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
              showCreatedAt={showCreatedAt}
            />
          </div>
          
          {/* Table Body */}
          {records.length === 0 ? (
            <div className="relative h-64">
              {/* When there are no records, lock the viewport to keep button centered even when the container scrolls. */}
              <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 text-center pointer-events-auto">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No records yet</h3>
                  <p className="text-gray-500 mb-4">Get started by adding your first record</p>
                  <button
                    onClick={() => onAddRow()}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
                      addingRow ? 'cursor-not-allowed opacity-70' : ''
                    }`}
                  >
                    {addingRow ? (
                      <div className="w-4 h-4 border-2 border-white-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Plus size={16} />
                    )}
                    Add Row
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {rowContent}
              
              {/* Floating Add Row button pinned to viewport, as opposed to a button on a row that scrolls out of view */}
              {totalPages == 1 && ( /* Handle separately when pagination is visible */
                <div className="pointer-events-none fixed bottom-2 right-6 z-20">
                  <button
                    onClick={() => onAddRow()}
                    className={`pointer-events-auto inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors ${
                      addingRow ? 'cursor-not-allowed opacity-70' : ''
                    }`}
                  >
                    {addingRow ? (
                      <div className="w-4 h-4 border-2 border-white-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Plus size={16} />
                    )}
                    <span>Add Row</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pagination controls - Fixed outside scrollable area */}
      <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 px-3 md:px-6 py-2 md:py-3 bg-gray-50 border-t border-gray-200">
        {/* Left side - Record count and page size selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="text-xs sm:text-sm text-gray-500">
            {totalRecords} {totalRecords === 1 ? 'record' : 'records'}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Show:</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">per page</span>
          </div>
        </div>

        {/* Right side - Pagination controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-600 order-2 sm:order-none">
              {startIndex + 1}-{endIndex} of {totalRecords}
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-between sm:justify-start">
              {/* Hide first page button on mobile to save space */}
              <button
                onClick={goToFirstPage}
                disabled={currentPage === 1}
                className="hidden sm:inline-flex p-2 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="First page"
              >
                <ChevronsLeft size={16} className="text-gray-600" />
              </button>
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              
              {/* Page number input - compact on mobile */}
              <div className="flex items-center gap-1 mx-1 sm:mx-2">
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap hidden sm:inline">Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value, 10);
                    if (!isNaN(page)) goToPage(page);
                  }}
                  className="w-12 sm:w-14 px-1.5 sm:px-2 py-1.5 text-xs sm:text-sm text-center border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">/{totalPages}</span>
              </div>

              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight size={16} className="text-gray-600" />
              </button>
              {/* Hide last page button on mobile to save space */}
              <button
                onClick={goToLastPage}
                disabled={currentPage === totalPages}
                className="hidden sm:inline-flex p-2 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Last page"
              >
                <ChevronsRight size={16} className="text-gray-600" />
              </button>
            </div>
              
            {/* Add Row button - full width on mobile */}
            <button
              onClick={() => onAddRow()}
              className={`pointer-events-auto inline-flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 w-full sm:w-auto bg-blue-600 text-white text-sm rounded-lg shadow-lg hover:bg-blue-700 transition-colors ${
                addingRow ? 'cursor-not-allowed opacity-70' : ''
              }`}
            >
              {addingRow ? (
                <div className="w-4 h-4 border-2 border-white-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Plus size={16} />
              )}
              <span>Add Row</span>
            </button>
          </div>
        )}
      </div>
    </div>
      <RecordDetailsModal
        isOpen={Boolean(detailRecord)}
        record={detailRecord}
        fields={allFields || fields}
        tables={tables}
        selectedTableId={selectedTableId}
        baseId={baseId}
        savingCell={savingCell}
        onUpdateCell={onUpdateCell}
        onClose={handleCloseDetails}
      />
    </>
  );
};
