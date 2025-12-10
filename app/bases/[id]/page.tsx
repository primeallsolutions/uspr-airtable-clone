"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ContextMenu, useContextMenu } from "@/components/ui/context-menu";
import { RenameModal } from "@/components/ui/rename-modal";

// Hooks
import { useAuth } from "@/lib/hooks/useAuth";
import { useBaseDetail } from "@/lib/hooks/useBaseDetail";
import { useRole } from "@/lib/hooks/useRole";
import { useBaseDetailState } from "@/lib/hooks/useBaseDetailState";

// Components
import { TopNavigation } from "@/components/base-detail/TopNavigation";
import { Sidebar } from "@/components/base-detail/Sidebar";
import { TableControls } from "@/components/base-detail/TableControls";
import type { ViewControlPanel } from "@/components/base-detail/TableControls";
import { GridView } from "@/components/base-detail/GridView";
import { KanbanView } from "@/components/base-detail/KanbanView";
import { AutomationsView } from "@/components/base-detail/AutomationsView";
import { ImportCsvModal } from "@/components/base-detail/ImportCsvModal";
import { CreateFieldModal } from "@/components/base-detail/CreateFieldModal";
import { EditFieldModal } from "@/components/base-detail/EditFieldModal";
import { CreateTableModal } from "@/components/base-detail/CreateTableModal";
import { RenameTableModal } from "@/components/base-detail/RenameTableModal";
import { DeleteTableModal } from "@/components/base-detail/DeleteTableModal";
import { RoleTagsManager } from "@/components/base-detail/RoleTagsManager";
import { InterfacesView } from "@/components/base-detail/InterfacesView";
import { DeleteBaseModal } from "@/components/base-detail/DeleteBaseModal";
import { DeleteFieldModal } from "@/components/base-detail/DeleteFieldModal";
import { DeleteAllFieldsModal } from "@/components/base-detail/DeleteAllFieldsModal";
import { ExportBaseModal } from "@/components/base-detail/ExportBaseModal";
import {
  HideFieldsPanel,
  FilterPanel,
  GroupPanel,
  SortPanel,
  ColorPanel,
  ShareViewPanel,
  type FilterState,
  type SortRule
} from "@/components/base-detail/ViewControlModals";

const generateClientId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createDefaultFilterState = (): FilterState => ({
  match: 'all',
  conditions: [
    {
      id: generateClientId(),
      fieldId: null,
      operator: 'contains',
      value: ''
    }
  ]
});

// Types
import type { FieldRow, RecordRow, FieldType } from "@/lib/types/base-detail";

// Services
import { BaseDetailService } from "@/lib/services/base-detail-service";

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
    automations,
    allFields,
    loading,
    loadingRecords,
    savingCell,
    error,
    setSelectedTableId,
    updateBase,
    deleteBase,
    createTable,
    updateTable,
    deleteTable,
    createField,
    updateField,
    deleteField,
    deleteAllFields,
    updateCell,
    deleteRecord,
    bulkDeleteRecords,
    createRecord,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    loadFields,
    loadRecords,
    loadAllFields
  } = useBaseDetail(baseId);
  
  const {
    viewMode,
    topTab,
    isRenameModalOpen,
    isCreateFieldModalOpen,
    isEditFieldModalOpen,
    isCreateTableModalOpen,
    isRenameTableModalOpen,
    isDeleteTableModalOpen,
    isImportModalOpen,
    setViewMode,
    setTopTab,
    openRenameModal,
    closeRenameModal,
    openCreateFieldModal,
    closeCreateFieldModal,
    openEditFieldModal,
    closeEditFieldModal,
    openCreateTableModal,
    closeCreateTableModal,
    openRenameTableModal,
    closeRenameTableModal,
    openDeleteTableModal,
    closeDeleteTableModal,
    openImportModal,
    closeImportModal
  } = useBaseDetailState();
  
  // Add state for delete base modal
  const [isDeleteBaseModalOpen, setIsDeleteBaseModalOpen] = useState(false);
  const openDeleteBaseModal = () => setIsDeleteBaseModalOpen(true);
  const closeDeleteBaseModal = () => setIsDeleteBaseModalOpen(false);

  // Add state for export base modal
  const [isExportBaseModalOpen, setIsExportBaseModalOpen] = useState(false);
  const openExportBaseModal = () => setIsExportBaseModalOpen(true);
  const closeExportBaseModal = () => setIsExportBaseModalOpen(false);

  // Add state for delete field modal
  const [isDeleteFieldModalOpen, setIsDeleteFieldModalOpen] = useState(false);
  const openDeleteFieldModal = () => setIsDeleteFieldModalOpen(true);
  const closeDeleteFieldModal = () => setIsDeleteFieldModalOpen(false);

  // Add state for delete all fields modal
  const [isDeleteAllFieldsModalOpen, setIsDeleteAllFieldsModalOpen] = useState(false);
  const openDeleteAllFieldsModal = () => setIsDeleteAllFieldsModalOpen(true);
  const closeDeleteAllFieldsModal = () => setIsDeleteAllFieldsModalOpen(false);
  
  const { contextMenu, setContextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const { role, can } = useRole({ baseId });
  // Removed base-level manage members; handled at workspace level only

  // State for editing field
  const [editingField, setEditingField] = useState<FieldRow | null>(null);

  // View control states
  const [hiddenFieldIds, setHiddenFieldIds] = useState<string[]>([]);
  const [activeViewPanel, setActiveViewPanel] = useState<ViewControlPanel | null>(null);
  const [groupFieldIds, setGroupFieldIds] = useState<string[]>([]);
  const [colorFieldId, setColorFieldId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<FilterState>(createDefaultFilterState());
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const viewControlsRef = useRef<HTMLDivElement | null>(null);
  const viewPanelRef = useRef<HTMLDivElement | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mark base as opened on mount/id change
  useEffect(() => {
    if (!baseId) return;
    BaseDetailService.markBaseOpened(baseId).catch((err) => {
      console.error('Failed to mark base as opened', err);
    });
  }, [baseId]);

  // Reset per-table view controls when switching tables
  useEffect(() => {
    setHiddenFieldIds([]);
    setGroupFieldIds([]);
    setColorFieldId(null);
    setFilterState(createDefaultFilterState());
    setSortRules([]);
    setSearchQuery('');
    setActiveViewPanel(null);
  }, [selectedTableId]);

  useEffect(() => {
    if (!activeViewPanel) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (viewPanelRef.current?.contains(target)) return;
      if (viewControlsRef.current?.contains(target)) return;
      setActiveViewPanel(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeViewPanel]);

  // Event handlers
  const handleRenameBase = async (newName: string) => {
    await updateBase({ name: newName });
  };

  const handleDeleteBaseClick = () => {
    openDeleteBaseModal();
    hideContextMenu();
  };

  const handleDeleteBaseConfirm = async () => {
    if (!base) return;
    await deleteBase();
  };

  const handleBaseContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e);
  };

  const handleFieldContextMenu = (e: React.MouseEvent, field: FieldRow) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, 'field', field);
  };

  const handleRowContextMenu = (e: React.MouseEvent, record: RecordRow) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, 'record', record);
  };

  const handleCreateTable = async (tableName: string) => {
    if (!baseId) return;
    
    try {
      // Get the current table count from the database to avoid using the potentially corrupted tables array
      let orderIndex = 0;
      
      try {
        const existingTables = await BaseDetailService.getTables(baseId);
        orderIndex = Array.isArray(existingTables) ? existingTables.length : 0;
      } catch (fetchError) {
        console.error('Error fetching tables for order index:', fetchError);
        // Fallback to 0 if we can't fetch the count
        orderIndex = 0;
      }
      
      // Create completely clean data
      const tableData = {
        name: String(tableName),
        base_id: String(baseId),
        order_index: orderIndex
      };
      
      await createTable(tableData);
    } catch (err) {
      console.error('Error creating table:', err);
    }
  };

  const handleToggleMasterList = async (tableId: string) => {
    try {
      // First, set all tables in this base to not be master list
      const currentMasterTables = tables.filter(t => t.is_master_list);
      for (const table of currentMasterTables) {
        await updateTable(table.id, { is_master_list: false });
      }
      
      // Then set the selected table as master list
      await updateTable(tableId, { is_master_list: true });
    } catch (err) {
      console.error('Error toggling master list:', err);
    }
  };

  const handleRenameTable = async (tableId: string) => {
    // Store the tableId for the modal to use
    setContextMenu(prev => ({ ...prev, tableId }));
    openRenameTableModal();
  };

  const handleDeleteTable = async (tableId: string) => {
    // Store the tableId for the modal to use
    setContextMenu(prev => ({ ...prev, tableId }));
    openDeleteTableModal();
  };

  const handleReorderTables = async (reorderedTableIds: string[]) => {
    try {
      // Update order_index for each table based on its new position
      const updatePromises = reorderedTableIds.map((tableId, index) => {
        const table = tables.find(t => t.id === tableId);
        if (table && table.order_index !== index) {
          return updateTable(tableId, { order_index: index });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
    } catch (err) {
      console.error('Error reordering tables:', err);
    }
  };

  const handleRenameTableConfirm = async (newName: string) => {
    if (!contextMenu?.tableId) return;
    
    try {
      await updateTable(contextMenu.tableId, { name: newName });
      closeRenameTableModal();
    } catch (err) {
      console.error('Error renaming table:', err);
    }
  };

  const handleDeleteTableConfirm = async () => {
    if (!contextMenu?.tableId) return;
    if (!can.delete) {
      alert('You do not have permission to delete tables.');
      return;
    }
    
    try {
      await deleteTable(contextMenu.tableId);
      closeDeleteTableModal();
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

  const getRandomKanbanColor = () => {
    const palette = [
      '#2563eb',
      '#0ea5e9',
      '#22c55e',
      '#eab308',
      '#f59e0b',
      '#f97316',
      '#ef4444',
      '#ec4899',
      '#a855f7',
      '#6366f1',
      '#10b981',
      '#14b8a6',
      '#f43f5e',
      '#8b5cf6',
      '#64748b'
    ];
    return palette[Math.floor(Math.random() * palette.length)];
  };

  const handleAddStackValue = async (fieldId: string, label: string) => {
    const targetField = fields.find(f => f.id === fieldId && f.type === 'single_select');
    if (!targetField) return;

    const existingOptions = targetField.options || {};
    let nextOptions: Record<string, unknown>;

    if (typeof existingOptions === 'object' && !Array.isArray(existingOptions)) {
      const entries = Object.entries(existingOptions);
      const hasLabelObjects = entries.some(([, val]) => val && typeof val === 'object' && 'label' in (val as Record<string, unknown>));

      if (hasLabelObjects || entries.length === 0) {
        const key = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
        nextOptions = {
          ...existingOptions,
          [key]: { label, color: getRandomKanbanColor() }
        };
      } else {
        const choices = (existingOptions as { choices?: string[] }).choices;
        if (Array.isArray(choices)) {
          nextOptions = { choices: [...choices, label] };
        } else {
          nextOptions = { ...existingOptions, [label]: label };
        }
      }
    } else {
      nextOptions = { choices: [label] };
    }

    try {
      await updateField(fieldId, { options: nextOptions });
    } catch (err) {
      console.error('Error adding kanban column:', err);
    }
  };

  const handleAddField = () => {
    openCreateFieldModal();
  };

  const handleCreateField = async (fieldData: { name: string; type: FieldType; options?: Record<string, unknown> }) => {
    if (!selectedTableId) return;
    
    try {
      await createField({
        name: fieldData.name,
        type: fieldData.type,
        table_id: selectedTableId,
        order_index: fields.length,
        options: fieldData.options
      });
    } catch (err) {
      console.error('Error creating field:', err);
    }
  };

  const handleEditField = async (fieldId: string, fieldData: { name: string; type: FieldType; options?: Record<string, unknown> }) => {
    try {
      await updateField(fieldId, {
        name: fieldData.name,
        type: fieldData.type,
        options: fieldData.options || null
      });
      setEditingField(null);
      closeEditFieldModal();
    } catch (err) {
      console.error('Error updating field:', err);
    }
  };

  const handleDeleteField = () => {
    if (!contextMenu?.data) return;
    openDeleteFieldModal();
    hideContextMenu();
  };

  const handleDeleteFieldConfirm = async () => {
    if (!contextMenu?.data || contextMenu.type !== 'field') return;
    const field = contextMenu.data as FieldRow;
    if (!field.id) return;
    
    try {
      await deleteField(field.id);
      closeDeleteFieldModal();
    } catch (err) {
      console.error('Error deleting field:', err);
    }
  };

  const handleToggleFieldVisibility = (fieldId: string) => {
    setHiddenFieldIds(prev =>
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleHideAllFields = () => {
    setHiddenFieldIds(fields.map(field => field.id));
  };

  const handleApplyFilterState = (config: FilterState) => {
    setFilterState(config);
  };

  const handleClearFilterState = () => {
    setFilterState(createDefaultFilterState());
  };

  const handleApplyGrouping = (fieldIds: string[]) => {
    setGroupFieldIds(fieldIds.slice(0, 3));
  };

  const handleApplySortRules = (rules: SortRule[]) => {
    setSortRules(rules.slice(0, 3));
  };

  const handleClearSortRules = () => {
    setSortRules([]);
  };

  const handleApplyColorConfig = (fieldId: string | null) => {
    setColorFieldId(fieldId);
  };

  const toggleViewPanel = (panel: ViewControlPanel, anchorEl: HTMLElement) => {
    if (activeViewPanel === panel) {
      setActiveViewPanel(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    setPanelPosition({
      x: rect.left,
      y: rect.bottom + 6
    });
    setActiveViewPanel(panel);
  };

  const handleColumnSort = (fieldId: string) => {
    setSortRules(prev => {
      const existing = prev.find(rule => rule.fieldId === fieldId);
      const nextDirection: SortRule['direction'] =
        existing && prev[0]?.fieldId === fieldId
          ? (existing.direction === 'asc' ? 'desc' : 'asc')
          : 'asc';
      const withoutField = prev.filter(rule => rule.fieldId !== fieldId);
      return [
        {
          id: generateClientId(),
          fieldId,
          direction: nextDirection
        },
        ...withoutField
      ].slice(0, 3);
    });
  };

  const handleDeleteAllFields = async () => {
    if (!selectedTableId) return;

    try {
      await deleteAllFields(selectedTableId);
      // The deleteAllFields function now handles reloading both fields and records
      closeDeleteAllFieldsModal();
    } catch (err) {
      console.error('Error deleting all fields:', err);
    }
  };

  const handleImportCsv = async (data: { 
    file: File; 
    fieldMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> 
  }) => {
    if (!selectedTableId) {
      throw new Error('No table selected');
    }

    console.log('Import CSV debug:', {
      fieldMappings: data.fieldMappings,
      selectedTableId
    });

    const csvText = await data.file.text();
    const result = await BaseDetailService.importCsvData(selectedTableId, csvText, data.fieldMappings);
    
    // Reload fields and records to show the imported data and any new fields
    if (selectedTableId) {
      await loadFields(selectedTableId);
      await loadRecords(selectedTableId);
    }
    
    if (result.errors.length > 0) {
      console.warn('Import completed with errors:', result.errors);
    }
    
    return result;
  };

  // === Masterlist Detection for Kanban ===
  const masterlistTable = useMemo(
    () => tables.find(t => t.is_master_list) || tables[0],
    [tables]
  );

  // When in Kanban view, always use masterlist table
  const activeTableIdForData = useMemo(() => {
    if (viewMode === 'kanban') {
      return masterlistTable?.id || selectedTableId;
    }
    return selectedTableId;
  }, [viewMode, masterlistTable, selectedTableId]);

  // Load masterlist data when switching to Kanban
  useEffect(() => {
    if (viewMode === 'kanban' && masterlistTable && masterlistTable.id !== selectedTableId) {
      setSelectedTableId(masterlistTable.id);
    }
  }, [viewMode, masterlistTable, selectedTableId, setSelectedTableId]);

  // === Shared Data Processing (applies to both Grid and Kanban) ===
  const processedRecords = useMemo(() => {
    console.log("🔄 processedRecords recomputing, raw records count:", records.length);
    let result = records;

    // 1. Apply filters
    const activeConditions = filterState.conditions.filter(condition => condition.fieldId && condition.value.trim());
    if (activeConditions.length > 0) {
      result = result.filter(record => {
        const evaluations = activeConditions.map(condition => {
          const field = fields.find(f => f.id === condition.fieldId);
          if (!field) return false;
          const rawValue = record.values?.[field.id];
          const value = rawValue === null || rawValue === undefined ? '' : String(rawValue).toLowerCase();
          const query = condition.value.toLowerCase();
          switch (condition.operator) {
            case 'equals':
              return value === query;
            case 'starts_with':
              return value.startsWith(query);
            case 'is_not':
              return value !== query;
            default:
              return value.includes(query);
          }
        });
        return filterState.match === 'all' ? evaluations.every(Boolean) : evaluations.some(Boolean);
      });
    }

    // 2. Apply search
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(record => {
        const values = Object.values(record.values || {});
        return values.some(value =>
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(query)
        );
      });
    }

    // 3. Apply sorts
    const validRules = sortRules.filter(rule => rule.fieldId);
    if (validRules.length > 0) {
      result = [...result].sort((a, b) => {
        for (const rule of validRules) {
          const fieldId = rule.fieldId!;
          const field = fields.find(f => f.id === fieldId);
          if (!field) continue;
          const aValue = a.values?.[fieldId];
          const bValue = b.values?.[fieldId];
          if (aValue == null && bValue == null) continue;
          if (aValue == null) return rule.direction === 'asc' ? 1 : -1;
          if (bValue == null) return rule.direction === 'asc' ? -1 : 1;

          let comparison = 0;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else if (field.type === 'date' || field.type === 'datetime') {
            comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
          } else {
            comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
          }

          if (comparison !== 0) {
            return rule.direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return result;
  }, [records, fields, filterState, searchQuery, sortRules]);

  // === Grid-Specific Configurations ===
  const visibleFields = useMemo(() => {
    if (hiddenFieldIds.length === 0) return fields;
    return fields.filter(field => !hiddenFieldIds.includes(field.id));
  }, [fields, hiddenFieldIds]);

  const colorAssignments = useMemo(() => {
    if (!colorFieldId) return {};
    const palette = ['#2563eb', '#16a34a', '#db2777', '#f97316', '#0ea5e9', '#a855f7', '#059669', '#be185d', '#d97706', '#2563eb33'];
    const assignments: Record<string, string> = {};
    let paletteIndex = 0;
    processedRecords.forEach(record => {
      const rawValue = record.values?.[colorFieldId];
      const key = rawValue === null || rawValue === undefined || rawValue === '' ? '__empty' : String(rawValue);
      if (!assignments[key]) {
        assignments[key] = palette[paletteIndex % palette.length];
        paletteIndex += 1;
      }
    });
    return assignments;
  }, [colorFieldId, processedRecords]);

  const hiddenFieldsCount = hiddenFieldIds.length;
  const activeFilterCount = filterState.conditions.filter(condition => condition.fieldId && condition.value.trim()).length;
  const filterDescription = activeFilterCount > 0 ? `${activeFilterCount} condition${activeFilterCount > 1 ? 's' : ''}` : null;
  const groupNames = groupFieldIds
    .map(id => fields.find(f => f.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const groupDescription = groupNames.length > 0
    ? groupNames.length === 1
      ? groupNames[0]
      : `${groupNames[0]}${groupNames.length > 1 ? ` +${groupNames.length - 1}` : ''}`
    : null;
  const sortNames = sortRules
    .map(rule => (rule.fieldId ? fields.find(f => f.id === rule.fieldId)?.name : null))
    .filter((name): name is string => Boolean(name));
  const sortDescription = sortNames.length > 0
    ? sortNames.length === 1
      ? sortNames[0]
      : `${sortNames[0]} +${sortNames.length - 1}`
    : null;
  const colorField = colorFieldId ? fields.find(f => f.id === colorFieldId) : null;
  const viewControlState = {
    hiddenFieldsCount,
    filterDescription,
    groupDescription,
    sortDescription,
    colorDescription: colorField?.name ?? null,
  };
  const primarySortRule = sortRules.find(rule => rule.fieldId) ?? null;
  const primarySortFieldId = primarySortRule?.fieldId ?? null;
  const primarySortDirection = primarySortRule?.direction ?? 'asc';

  // Context menu options
  const getContextMenuOptions = () => {
    if (!contextMenu.isVisible) return [];
    
    if (contextMenu.type === 'field') {
      return [
        {
          id: "edit_field",
          label: "Edit Field",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
          onClick: () => {
            if (contextMenu.data && contextMenu.type === 'field') {
              setEditingField(contextMenu.data as FieldRow);
              openEditFieldModal();
              hideContextMenu();
            }
          },
        },
        {
          id: "delete_field",
          label: "Delete Field",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ),
          onClick: handleDeleteField,
        },
      ];
    }
    
    if (contextMenu.type === 'record') {
      return [
        {
          id: "delete_record",
          label: "Delete Record",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ),
          onClick: () => {
            if (contextMenu.data && contextMenu.type === 'record') {
              const record = contextMenu.data as RecordRow;
              deleteRecord(record.id);
              hideContextMenu();
            }
          },
        },
      ];
    }
    
    // Default base context menu options
    const options = base ? [
      {
        id: "rename",
        label: "Rename Base",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        onClick: openRenameModal,
      },
      // Manage members moved to workspace level
      {
        id: "delete",
        label: "Delete Base",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        onClick: handleDeleteBaseClick,
        separator: true,
      },
    ] : [];

    // Hide delete if not allowed
    return options.filter(opt => !(opt.id === 'delete' && !can.delete));
  };

  const contextMenuOptions = getContextMenuOptions();

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
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCreateNew={openCreateTableModal}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
          <TopNavigation
          base={base}
          tables={tables}
          selectedTableId={selectedTableId}
          topTab={topTab}
          onTableSelect={setSelectedTableId}
          onTabChange={setTopTab}
          onBaseContextMenu={handleBaseContextMenu}
          onCreateTable={openCreateTableModal}
          onToggleMasterList={handleToggleMasterList}
          onRenameTable={handleRenameTable}
          onDeleteTable={handleDeleteTable}
          canDeleteTable={can.delete}
          onExportBase={openExportBaseModal}
          showInterfacesTab={false}
          showFormsTab={false}
        />

        {/* Table Controls */}
        {topTab === 'data' && (
          <div className="relative" ref={viewControlsRef}>
            <TableControls
              tables={tables}
              selectedTableId={selectedTableId}
              onTableSelect={setSelectedTableId}
              onAddRecord={handleAddRow}
              showTableTabs={viewMode === 'grid'}
              viewMode={viewMode}
              onImportCsv={openImportModal}
              onCreateTable={openCreateTableModal}
              onRenameTable={handleRenameTable}
              onDeleteTable={handleDeleteTable}
              onReorderTables={handleReorderTables}
              onHideFields={(el) => toggleViewPanel('hideFields', el)}
              onFilter={(el) => toggleViewPanel('filter', el)}
              onGroup={(el) => toggleViewPanel('group', el)}
              onSort={(el) => toggleViewPanel('sort', el)}
              onColor={(el) => toggleViewPanel('color', el)}
              onShare={(el) => toggleViewPanel('share', el)}
              onDeleteAllFields={openDeleteAllFieldsModal}
              canDeleteTable={can.delete}
              viewState={viewControlState}
              activePanel={activeViewPanel}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            {activeViewPanel && (
              <div
                ref={viewPanelRef}
                className="fixed z-30"
                style={{
                  left: panelPosition.x,
                  top: panelPosition.y
                }}
              >
                <HideFieldsPanel
                  isOpen={activeViewPanel === 'hideFields'}
                  fields={fields}
                  hiddenFieldIds={hiddenFieldIds}
                  onToggleField={handleToggleFieldVisibility}
                  onShowAll={() => setHiddenFieldIds([])}
                  onHideAll={handleHideAllFields}
                  onClose={() => setActiveViewPanel(null)}
                />
                <FilterPanel
                  isOpen={activeViewPanel === 'filter'}
                  fields={fields}
                  filter={filterState}
                  onApply={(config) => {
                    handleApplyFilterState(config);
                    setActiveViewPanel(null);
                  }}
                  onClear={() => {
                    handleClearFilterState();
                    setActiveViewPanel(null);
                  }}
                  onClose={() => setActiveViewPanel(null)}
                />
                <GroupPanel
                  isOpen={activeViewPanel === 'group'}
                  fields={fields}
                  groupFieldIds={groupFieldIds}
                  onApply={(ids) => {
                    handleApplyGrouping(ids);
                    setActiveViewPanel(null);
                  }}
                  onClose={() => setActiveViewPanel(null)}
                />
                <SortPanel
                  isOpen={activeViewPanel === 'sort'}
                  fields={fields}
                  sortRules={sortRules}
                  onApply={(rules) => {
                    handleApplySortRules(rules);
                    setActiveViewPanel(null);
                  }}
                  onClear={() => {
                    handleClearSortRules();
                    setActiveViewPanel(null);
                  }}
                  onClose={() => setActiveViewPanel(null)}
                />
                <ColorPanel
                  isOpen={activeViewPanel === 'color'}
                  fields={fields}
                  colorFieldId={colorFieldId}
                  onApply={(fieldId) => {
                    handleApplyColorConfig(fieldId);
                    setActiveViewPanel(null);
                  }}
                  onClose={() => setActiveViewPanel(null)}
                />
                <ShareViewPanel
                  isOpen={activeViewPanel === 'share'}
                  onClose={() => setActiveViewPanel(null)}
                  baseId={baseId ?? null}
                  baseName={base?.name || "Base"}
                />
              </div>
            )}
          </div>
        )}

        {/* Data View */}
        <div className="flex-1 flex flex-col min-h-0">
          {topTab === 'data' && selectedTableId && (
            <div className="flex-1 flex flex-col min-h-0">
              
              {viewMode === 'grid' ? (
                <GridView
                  records={processedRecords}
                  fields={visibleFields}
                  allFields={fields}
                  tables={tables}
                  selectedTableId={selectedTableId}
                  sortFieldId={primarySortFieldId}
                  sortDirection={primarySortDirection}
                  savingCell={savingCell}
                  onSort={handleColumnSort}
                  onUpdateCell={updateCell}
                  onDeleteRow={deleteRecord}
                  onBulkDelete={bulkDeleteRecords}
                  onAddRow={handleAddRow}
                  onAddField={handleAddField}
                  onFieldContextMenu={handleFieldContextMenu}
                  onRowContextMenu={handleRowContextMenu}
                  canDeleteRow={can.delete ?? true}
                  groupFieldIds={groupFieldIds}
                  colorFieldId={colorFieldId}
                  colorAssignments={colorAssignments}
                />
              ) : (
                <KanbanView
                  records={processedRecords}
                  fields={fields}
                  tables={tables}
                  onUpdateCell={updateCell}
                  onDeleteRow={deleteRecord}
                  onAddRow={handleAddRow}
                  savingCell={savingCell}
                  canDeleteRow={can.delete ?? true}
                />
              )}
            </div>
          )}

          {topTab === 'automations' && (
            <AutomationsView
              automations={automations}
              tables={tables}
              fields={allFields}
              baseId={baseId || ''}
              onCreateAutomation={createAutomation}
              onUpdateAutomation={updateAutomation}
              onDeleteAutomation={deleteAutomation}
              onToggleAutomation={toggleAutomation}
              onFieldCreated={async (tableId: string) => {
                // Refresh all fields to ensure the dropdown is updated
                console.log('🔄 Refreshing all fields after new field creation for table:', tableId);
                await loadAllFields();
                console.log('✅ Fields refreshed successfully');
              }}
            />
          )}

          {topTab === 'interfaces' && (
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
              {baseId && (role === 'owner' || role === 'admin') && (
                <div className="px-6 pt-6">
                  <RoleTagsManager scopeType="base" scopeId={baseId} />
                </div>
              )}

              <div className="flex-1 px-6 pb-6 min-h-0">
                <InterfacesView
                  base={base}
                  tables={tables}
                  fields={fields}
                  records={records}
                  selectedTableId={selectedTableId}
                  onSelectTable={setSelectedTableId}
                  loading={loading}
                  loadingRecords={loadingRecords}
                />
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
      </div>

      {/* Context Menu */}
      {contextMenuOptions.length > 0 && (
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

      {/* Create Field Modal */}
      <CreateFieldModal
        isOpen={isCreateFieldModalOpen}
        onClose={closeCreateFieldModal}
        onCreateField={handleCreateField}
      />

      {/* Edit Field Modal */}
      <EditFieldModal
        isOpen={isEditFieldModalOpen}
        onClose={closeEditFieldModal}
        onEditField={handleEditField}
        field={editingField}
      />

      {/* Import CSV Modal */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        fields={fields}
        tableName={tables.find(t => t.id === selectedTableId)?.name || ""}
        onImport={handleImportCsv}
      />

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={isCreateTableModalOpen}
        onClose={closeCreateTableModal}
        onCreateTable={handleCreateTable}
      />

      {/* Rename Table Modal */}
      <RenameTableModal
        isOpen={isRenameTableModalOpen}
        onClose={closeRenameTableModal}
        onRenameTable={handleRenameTableConfirm}
        currentName={tables.find(t => t.id === contextMenu?.tableId)?.name || ""}
      />

      {/* Delete Table Modal */}
      <DeleteTableModal
        isOpen={isDeleteTableModalOpen}
        onClose={closeDeleteTableModal}
        onDeleteTable={handleDeleteTableConfirm}
        tableName={tables.find(t => t.id === contextMenu?.tableId)?.name || ""}
      />

      {/* Delete Base Modal */}
      <DeleteBaseModal
        isOpen={isDeleteBaseModalOpen}
        onClose={closeDeleteBaseModal}
        onDeleteBase={handleDeleteBaseConfirm}
        baseName={base?.name || ""}
      />

      {/* Delete Field Modal */}
      <DeleteFieldModal
        isOpen={isDeleteFieldModalOpen}
        onClose={closeDeleteFieldModal}
        onDeleteField={handleDeleteFieldConfirm}
        field={contextMenu?.data && contextMenu.type === 'field' ? (contextMenu.data as FieldRow) : null}
      />

      {/* Delete All Fields Modal */}
      <DeleteAllFieldsModal
        isOpen={isDeleteAllFieldsModalOpen}
        onClose={closeDeleteAllFieldsModal}
        onDeleteAllFields={handleDeleteAllFields}
        fieldCount={fields.length}
        tableName={tables.find(t => t.id === selectedTableId)?.name || 'this table'}
      />

      {/* Export Base Modal */}
      <ExportBaseModal
        isOpen={isExportBaseModalOpen}
        onClose={closeExportBaseModal}
        baseId={baseId}
        baseName={base?.name || 'Base'}
      />
    </div>
  );
}
