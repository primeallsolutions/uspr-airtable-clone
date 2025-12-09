"use client";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ContextMenu, useContextMenu } from "@/components/ui/context-menu";
import { RenameModal } from "@/components/ui/rename-modal";

// Hooks
import { useAuth } from "@/lib/hooks/useAuth";
import { useBaseDetail } from "@/lib/hooks/useBaseDetail";
import { useBaseDetailState } from "@/lib/hooks/useBaseDetailState";

// Components
import { TopNavigation } from "@/components/base-detail/TopNavigation";
import { GridView } from "@/components/base-detail/GridView";
import { KanbanView } from "@/components/base-detail/KanbanView";

// Types
import type { FieldRow, RecordRow } from "@/lib/types/base-detail";

export default function BaseDetailPage() {
  const params = useParams<{ id: string }>();
  const baseId = useMemo(() => (Array.isArray(params?.id) ? params.id[0] : params?.id), [params]);
  
  // Custom hooks
  const { loading: userLoading } = useAuth();
  const {
    base,
    tables,
    selectedTableId,
    fields,
    records,
    loading,
    savingCell,
    error,
    setSelectedTableId,
    updateBase,
    deleteBase,
    createTable,
    updateTable,
    deleteTable,
    updateCell,
    deleteRecord,
    bulkDeleteRecords,
    createRecord
  } = useBaseDetail(baseId);
  
  const {
    viewMode,
    topTab,
    sortFieldId,
    sortDirection,
    isRenameModalOpen,
    setViewMode,
    setTopTab,
    toggleSort,
    openRenameModal,
    closeRenameModal
  } = useBaseDetailState();
  
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

  // Event handlers
  const handleRenameBase = async (newName: string) => {
    await updateBase({ name: newName });
  };

  const handleDeleteBase = async () => {
    if (!base) return;
    
    if (!confirm(`Are you sure you want to delete "${base.name}"? This action cannot be undone.`)) {
      return;
    }
    
    await deleteBase();
  };

  const handleBaseContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e);
  };

  const handleFieldContextMenu = (e: React.MouseEvent, field: FieldRow) => {
    void field;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e);
  };

  const handleRowContextMenu = (e: React.MouseEvent, record: RecordRow) => {
    void record;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e);
  };

  const handleCreateTable = async () => {
    if (!base) return;
    
    const tableName = prompt("Enter table name:");
    if (!tableName?.trim()) return;
    
    try {
      await createTable({
        name: tableName.trim(),
        base_id: base.id,
        order_index: tables.length
      });
    } catch (err) {
      console.error('Error creating table:', err);
    }
  };

  const handleToggleMasterList = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    
    try {
      await updateTable(tableId, { is_master_list: !table.is_master_list });
    } catch (err) {
      console.error('Error toggling master list:', err);
    }
  };

  const handleRenameTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    
    const newName = prompt("Enter new table name:", table.name);
    if (!newName?.trim() || newName === table.name) return;
    
    try {
      await updateTable(tableId, { name: newName.trim() });
    } catch (err) {
      console.error('Error renaming table:', err);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    
    if (!confirm(`Are you sure you want to delete "${table.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteTable(tableId);
    } catch (err) {
      console.error('Error deleting table:', err);
    }
  };

  const handleAddRow = async (initialValues: Record<string, unknown> = {}) => {
    try {
      await createRecord(initialValues);
    } catch (err) {
      console.error('Error creating record:', err);
    }
  };

  // Context menu options
  const contextMenuOptions = base ? [
    {
      id: "rename",
      label: "Rename",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: openRenameModal,
    },
    {
      id: "delete",
      label: "Delete",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: handleDeleteBase,
      separator: true,
    },
  ] : [];

  // Loading state
  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation
        base={base}
        tables={tables}
        selectedTableId={selectedTableId}
        topTab={topTab}
        onTableSelect={setSelectedTableId}
        onTabChange={setTopTab}
        onBaseContextMenu={handleBaseContextMenu}
        onCreateTable={handleCreateTable}
        onToggleMasterList={handleToggleMasterList}
        onRenameTable={handleRenameTable}
        onDeleteTable={handleDeleteTable}
        showInterfacesTab={false}
        showFormsTab={false}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {topTab === 'data' && selectedTableId && (
          <>
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'grid' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'kanban' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Kanban
                </button>
              </div>
            </div>

            {/* Data View */}
            <div className="flex-1 overflow-hidden">
              {viewMode === 'grid' ? (
                <GridView
                  records={records}
                  fields={fields}
                  allFields={fields}
                  tables={tables}
                  selectedTableId={selectedTableId}
                  sortFieldId={sortFieldId}
                  sortDirection={sortDirection}
                  savingCell={savingCell}
                  onSort={toggleSort}
                  onUpdateCell={updateCell}
                  onDeleteRow={deleteRecord}
                  onBulkDelete={bulkDeleteRecords}
                  onAddRow={handleAddRow}
                  onAddField={() => {}} // TODO: Implement field creation
                  onFieldContextMenu={handleFieldContextMenu}
                  onRowContextMenu={handleRowContextMenu}
                />
              ) : (
                <KanbanView
                  records={records}
                  fields={fields}
                  tables={tables}
                  onUpdateCell={updateCell}
                  onDeleteRow={deleteRecord}
                  onAddRow={handleAddRow}
                  savingCell={savingCell}
                />
              )}
            </div>
          </>
        )}

        {topTab === 'automations' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Automations</h3>
              <p className="text-gray-500">Automation features coming soon...</p>
            </div>
          </div>
        )}

        {topTab === 'interfaces' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Interfaces</h3>
              <p className="text-gray-500">Interface features coming soon...</p>
            </div>
          </div>
        )}

        {topTab === 'forms' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Forms</h3>
              <p className="text-gray-500">Form features coming soon...</p>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {base && (
        <ContextMenu
          options={contextMenuOptions}
          position={contextMenu.position}
          onClose={hideContextMenu}
          isVisible={contextMenu.isVisible}
        />
      )}

      {/* Rename Modal */}
      <RenameModal
        isOpen={isRenameModalOpen}
        currentName={base?.name || ""}
        onClose={closeRenameModal}
        onRename={handleRenameBase}
        title="Rename Base"
      />
    </div>
  );
}
