import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BaseDetailService } from '../services/base-detail-service';
import type { 
  BaseRow, 
  TableRow, 
  FieldRow, 
  RecordRow, 
  Automation,
  CreateTableData,
  CreateFieldData,
  SavingCell
} from '../types/base-detail';

export const useBaseDetail = (baseId: string | null) => {
  const router = useRouter();
  
  // State
  const [base, setBase] = useState<BaseRow | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [allFields, setAllFields] = useState<FieldRow[]>([]);
  const fieldsCache = useRef<Map<string, FieldRow[]>>(new Map());
  const recordsCache = useRef<Map<string, RecordRow[]>>(new Map());
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [savingCell, setSavingCell] = useState<SavingCell>(null);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Load base data
  const loadBase = useCallback(async () => {
    if (!baseId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [baseData, tablesData] = await Promise.all([
        BaseDetailService.getBase(baseId),
        BaseDetailService.getTables(baseId)
      ]);
      
      setBase(baseData);
      setTables(tablesData);
      
      // Select first table if available and no table is currently selected
      if (tablesData.length > 0) {
        setSelectedTableId((current) => current ?? tablesData[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load base';
      setError(message);
      console.error('Error loading base:', err);
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  // Load fields for selected table
  const loadFields = useCallback(async (tableId: string) => {
    try {
      setError(null);
      // If cached, show immediately for snappy tab switch, then refresh from server
      const cached = fieldsCache.current.get(tableId);
      if (cached) {
        setFields(cached);
      }
      
      // Check if the selected table is a master list
      const selectedTable = tables.find(t => t.id === tableId);
      if (selectedTable?.is_master_list && baseId) {
        // If it's a master list, load all fields from all tables in the base
        const fieldsData = await BaseDetailService.getAllFields(baseId);
        const tableMetaMap = new Map(tables.map(t => [t.id, t]));
        const masterlistTableId = tables.find(t => t.is_master_list)?.id || null;
        
        // Load all records to check which fields have data
        const allRecords = await BaseDetailService.getAllRecordsFromBase(baseId);
        
        // Build a set of field IDs that have data in records
        const fieldsWithData = new Set<string>();
        for (const record of allRecords) {
          for (const fieldId of Object.keys(record.values)) {
            const value = record.values[fieldId];
            // Consider a field to have data if the value is not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== '') {
              fieldsWithData.add(fieldId);
            }
          }
        }
        
        // Deduplicate fields by name - prioritize fields that have data
        // When multiple tables have fields with the same name, prefer masterlist, then data, then order_index
        const fieldMapByName = new Map<string, FieldRow>();
        
        for (const field of fieldsData) {
          const normalizedName = field.name.toLowerCase();
          const existingField = fieldMapByName.get(normalizedName);
          const existingTableMeta = existingField ? tableMetaMap.get(existingField.table_id) : undefined;
          const currentTableMeta = tableMetaMap.get(field.table_id);
          const existingPriority = existingTableMeta?.is_master_list ? 0 : 1;
          const currentPriority = currentTableMeta?.is_master_list ? 0 : 1;
          
          if (!existingField) {
            // First occurrence - always keep it
            fieldMapByName.set(normalizedName, field);
          } else {
            // Duplicate field name - prefer masterlist, then data, then stable order_index/name
            const existingHasData = fieldsWithData.has(existingField.id);
            const currentHasData = fieldsWithData.has(field.id);
            
            if (currentPriority < existingPriority) {
              fieldMapByName.set(normalizedName, field);
            } else if (currentPriority === existingPriority) {
              if (currentHasData && !existingHasData) {
                fieldMapByName.set(normalizedName, field);
              } else if (currentHasData === existingHasData) {
                const existingOrder = typeof existingField.order_index === 'number' ? existingField.order_index : Number.MAX_SAFE_INTEGER;
                const currentOrder = typeof field.order_index === 'number' ? field.order_index : Number.MAX_SAFE_INTEGER;
                if (currentOrder < existingOrder) {
                  fieldMapByName.set(normalizedName, field);
                }
              }
              // otherwise keep existing
            }
            // If currentPriority > existingPriority, keep existing masterlist-first choice
          }
        }
        
        const deduplicatedFields = Array.from(fieldMapByName.values()).sort((a, b) => {
          const aMeta = tableMetaMap.get(a.table_id);
          const bMeta = tableMetaMap.get(b.table_id);
          const aPriority = aMeta?.is_master_list ? 0 : 1;
          const bPriority = bMeta?.is_master_list ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          const aOrder = typeof a.order_index === 'number' ? a.order_index : 0;
          const bOrder = typeof b.order_index === 'number' ? b.order_index : 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        });
        
        fieldsCache.current.set(tableId, deduplicatedFields);
        setFields(deduplicatedFields);
      } else {
        // Otherwise, load fields only from the selected table
        const fieldsData = await BaseDetailService.getFields(tableId);
        fieldsCache.current.set(tableId, fieldsData);
        setFields(fieldsData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fields';
      setError(message);
      console.error('Error loading fields:', err);
    }
  }, [tables, baseId]);

  // Load records for selected table
  const loadRecords = useCallback(async (tableId: string) => {
    try {
      setLoadingRecords(true);
      setError(null);
      const cached = recordsCache.current.get(tableId);
      if (cached) {
        setRecords(cached);
      }
      
      // Check if the selected table is a master list
      const selectedTable = tables.find(t => t.id === tableId);
      if (selectedTable?.is_master_list && baseId) {
        const recordsData = await BaseDetailService.getRecords(selectedTable.id);
        recordsCache.current.set(tableId, recordsData);
        setRecords(recordsData);
      } else {
        // Otherwise, load records only from the selected table
        const recordsData = await BaseDetailService.getRecords(tableId);
        recordsCache.current.set(tableId, recordsData);
        setRecords(recordsData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load records';
      setError(message);
      console.error('Error loading records:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, [tables, baseId]);

  // Load all fields for base (for automations)
  const loadAllFields = useCallback(async () => {
    if (!baseId) return;
    
    try {
      setError(null);
      const allFieldsData = await BaseDetailService.getAllFields(baseId);
      setAllFields(allFieldsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load all fields';
      setError(message);
      console.error('Error loading all fields:', err);
    }
  }, [baseId]);

  // Load automations (now base-level, not table-level)
  const loadAutomations = useCallback(async () => {
    if (!baseId) return;
    
    try {
      setError(null);
      const automationsData = await BaseDetailService.getAutomations(baseId);
      setAutomations(automationsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load automations';
      setError(message);
      console.error('Error loading automations:', err);
    }
  }, [baseId]);

  // Base operations
  const updateBase = useCallback(async (updates: Partial<BaseRow>) => {
    if (!base) return;
    
    try {
      setError(null);
      await BaseDetailService.updateBase(base.id, updates);
      setBase(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update base';
      setError(message);
      throw err;
    }
  }, [base]);

  const deleteBase = useCallback(async () => {
    if (!base) return;
    
    try {
      setError(null);
      await BaseDetailService.deleteBaseCascade(base.id);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete base';
      setError(message);
      throw err;
    }
  }, [base, router]);

  // Table operations
  const createTable = useCallback(async (tableData: CreateTableData) => {
    try {
      setError(null);
      const newTable = await BaseDetailService.createTable(tableData);
      setTables(prev => [...prev, newTable]);
      return newTable;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create table';
      setError(message);
      throw err;
    }
  }, []);

  const updateTable = useCallback(async (tableId: string, updates: Partial<TableRow>) => {
    try {
      setError(null);
      await BaseDetailService.updateTable(tableId, updates);
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, ...updates } : t));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update table';
      setError(message);
      throw err;
    }
  }, []);

  const deleteTable = useCallback(async (tableId: string) => {
    try {
      setError(null);
      await BaseDetailService.deleteTable(tableId);
      setTables(prev => prev.filter(t => t.id !== tableId));
      
      // If we deleted the selected table, select another one
      if (selectedTableId === tableId) {
        const remainingTables = tables.filter(t => t.id !== tableId);
        setSelectedTableId(remainingTables.length > 0 ? remainingTables[0].id : null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete table';
      setError(message);
      throw err;
    }
  }, [selectedTableId, tables]);

  // Field operations
  const createField = useCallback(async (fieldData: CreateFieldData) => {
    try {
      setError(null);
      const newField = await BaseDetailService.createField(fieldData);
      setFields(prev => {
        const next = [...prev, newField];
        fieldsCache.current.set(fieldData.table_id, next);
        return next;
      });
      return newField;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create field';
      setError(message);
      throw err;
    }
  }, []);

  const updateField = useCallback(async (fieldId: string, updates: Partial<FieldRow>) => {
    try {
      setError(null);
      await BaseDetailService.updateField(fieldId, updates);
      setFields(prev => {
        const next = prev.map(f => f.id === fieldId ? { ...f, ...updates } : f);
        if (next.length && next[0].table_id) {
          const tableId = next[0].table_id;
          fieldsCache.current.set(tableId, next);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update field';
      setError(message);
      throw err;
    }
  }, []);

  const deleteField = useCallback(async (fieldId: string) => {
    try {
      setError(null);
      await BaseDetailService.deleteField(fieldId);
      setFields(prev => {
        const next = prev.filter(f => f.id !== fieldId);
        if (next.length && next[0].table_id) {
          const tableId = next[0].table_id;
          fieldsCache.current.set(tableId, next);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete field';
      setError(message);
      throw err;
    }
  }, []);

  const deleteAllFields = useCallback(async (tableId: string) => {
    try {
      setError(null);
      await BaseDetailService.deleteAllFields(tableId);
      // After deletion, reload fields for the specific table only
      // This ensures we get the correct fields even if it's a masterlist
      const fieldsData = await BaseDetailService.getFields(tableId);
      fieldsCache.current.set(tableId, fieldsData);
      setFields(fieldsData);
      
      // Also reload records since their values have been cleared
      const recordsData = await BaseDetailService.getRecords(tableId);
      recordsCache.current.set(tableId, recordsData);
      setRecords(recordsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete all fields';
      setError(message);
      throw err;
    }
  }, []);

  // Record operations
  const createRecord = useCallback(async (values: Record<string, unknown> = {}) => {
    if (!selectedTableId) return;
    
    try {
      setError(null);
      const newRecord = await BaseDetailService.createRecord(selectedTableId, values);
      setRecords(prev => {
        const next = [...prev, newRecord];
        recordsCache.current.set(selectedTableId, next);
        return next;
      });
      return newRecord;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create record';
      setError(message);
      throw err;
    }
  }, [selectedTableId]);

  const updateRecord = useCallback(async (recordId: string, values: Record<string, unknown>) => {
    try {
      setError(null);
      await BaseDetailService.updateRecord(recordId, values);
      setRecords(prev => {
        const next = prev.map(r => r.id === recordId ? { ...r, values } : r);
        if (selectedTableId) {
          recordsCache.current.set(selectedTableId, next);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update record';
      setError(message);
      throw err;
    }
  }, [selectedTableId]);

  const deleteRecord = useCallback(async (recordId: string) => {
    try {
      setError(null);
      await BaseDetailService.deleteRecord(recordId);
      setRecords(prev => {
        const next = prev.filter(r => r.id !== recordId);
        if (selectedTableId) {
          recordsCache.current.set(selectedTableId, next);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete record';
      setError(message);
      throw err;
    }
  }, [selectedTableId]);

  const bulkDeleteRecords = useCallback(async (recordIds: string[]) => {
    try {
      setError(null);
      // Delete all records in parallel
      await Promise.all(recordIds.map(id => BaseDetailService.deleteRecord(id)));
      setRecords(prev => {
        const next = prev.filter(r => !recordIds.includes(r.id));
        if (selectedTableId) {
          recordsCache.current.set(selectedTableId, next);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete records';
      setError(message);
      throw err;
    }
  }, [selectedTableId]);

  const updateCell = useCallback(async (recordId: string, fieldId: string, value: unknown) => {
    try {
      setSavingCell({ recordId, fieldId });
      setError(null);
      
      console.log("🔄 useBaseDetail.updateCell:", {
        recordId,
        fieldId,
        value,
        valueType: typeof value,
        isArray: Array.isArray(value)
      });
      
      await BaseDetailService.updateCell(recordId, fieldId, value);
      
      // Update local state
      setRecords(prev => {
        const next = prev.map(record => 
          record.id === recordId 
            ? { ...record, values: { ...record.values, [fieldId]: value } }
            : record
        );
        
        console.log("✅ Records state updated:", {
          totalRecords: next.length,
          updatedRecord: next.find(r => r.id === recordId)?.values?.[fieldId]
        });
        
        if (selectedTableId) {
          recordsCache.current.set(selectedTableId, next);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update cell';
      setError(message);
      console.error("❌ updateCell error:", err);
      throw err;
    } finally {
      setSavingCell(null);
    }
  }, [selectedTableId]);

  // Automation operations
  const createAutomation = useCallback(async (automation: Omit<Automation, 'id' | 'created_at'>) => {
    try {
      setError(null);
      const newAutomation = await BaseDetailService.createAutomation(automation);
      setAutomations(prev => [...prev, newAutomation]);
      return newAutomation;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create automation';
      setError(message);
      throw err;
    }
  }, []);

  const updateAutomation = useCallback(async (automationId: string, updates: Partial<Automation>) => {
    try {
      setError(null);
      await BaseDetailService.updateAutomation(automationId, updates);
      setAutomations(prev => prev.map(a => a.id === automationId ? { ...a, ...updates } : a));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update automation';
      setError(message);
      throw err;
    }
  }, []);

  const deleteAutomation = useCallback(async (automationId: string) => {
    try {
      setError(null);
      await BaseDetailService.deleteAutomation(automationId);
      setAutomations(prev => prev.filter(a => a.id !== automationId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete automation';
      setError(message);
      throw err;
    }
  }, []);

  const toggleAutomation = useCallback(async (automationId: string) => {
    const automation = automations.find(a => a.id === automationId);
    if (!automation) return;
    
    try {
      await updateAutomation(automationId, { enabled: !automation.enabled });
    } catch (err) {
      console.error('Error toggling automation:', err);
    }
  }, [automations, updateAutomation]);

  // Initialize data
  useEffect(() => {
    if (baseId) {
      loadBase();
      loadAllFields();
    }
  }, [baseId, loadBase, loadAllFields]);

  // Load fields and records when table changes
  useEffect(() => {
    if (selectedTableId) {
      loadFields(selectedTableId);
      loadRecords(selectedTableId);
    }
  }, [selectedTableId, loadFields, loadRecords]);

  // Load automations when base loads (base-level, not table-level)
  useEffect(() => {
    if (baseId) {
      loadAutomations();
    }
  }, [baseId, loadAutomations]);

  return {
    // State
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
    
    // Setters
    setSelectedTableId,
    setError,
    
    // Operations
    updateBase,
    deleteBase,
    createTable,
    updateTable,
    deleteTable,
    createField,
    updateField,
    deleteField,
    deleteAllFields,
    createRecord,
    updateRecord,
    deleteRecord,
    bulkDeleteRecords,
    updateCell,
    
    // Refresh functions
    loadBase,
    loadFields,
    loadRecords,
    loadAllFields,
    loadAutomations,
    
    // Automation operations
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
  };
};
