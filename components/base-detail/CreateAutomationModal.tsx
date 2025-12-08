import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { Automation, TableRow, FieldRow, FieldType, AutomationTrigger, AutomationAction } from "@/lib/types/base-detail";
import { BaseDetailService } from "@/lib/services/base-detail-service";

interface CreateAutomationModalProps {
  tables: TableRow[];
  fields: FieldRow[];
  baseId: string; // Changed from activeTableId to baseId for base-level automations
  automation?: Automation;
  onClose: () => void;
  onSave: (automation: Omit<Automation, 'id' | 'created_at'>) => void;
  onFieldCreated?: () => void;
}

export const CreateAutomationModal = ({
  tables,
  fields,
  baseId,
  automation,
  onClose,
  onSave,
  onFieldCreated
}: CreateAutomationModalProps) => {
  // Initialize form data - if automation has field_id but not field_name, populate field_name
  const getInitialFieldName = () => {
    if (automation?.trigger.field_name) {
      return automation.trigger.field_name;
    }
    // If only field_id exists, find the field and get its name
    if (automation?.trigger.field_id) {
      const field = fields.find(f => f.id === automation.trigger.field_id);
      return field?.name || undefined;
    }
    return undefined;
  };

  const [formData, setFormData] = useState({
    name: automation?.name || '',
    base_id: automation?.base_id || baseId,
    enabled: automation?.enabled ?? true,
    trigger: {
      type: automation?.trigger.type || 'field_change' as const,
      table_name: automation?.trigger.table_name || '', // Optional: if empty, applies to all tables
      field_id: automation?.trigger.field_id || undefined, // Keep for backward compatibility
      field_name: getInitialFieldName(), // Field name for cross-table support
      condition: automation?.trigger.condition || {
        operator: 'equals' as const,
        value: ''
      }
    },
    action: {
      type: automation?.action.type || 'copy_to_table' as const,
      target_table_name: automation?.action.target_table_name || '', // Changed to table_name
      field_mappings: automation?.action.field_mappings || [],
      preserve_original: automation?.action.preserve_original ?? (automation?.action.type === 'move_to_table' ? false : true),
      sync_mode: automation?.action.sync_mode || 'one_way' as const,
      duplicate_handling: automation?.action.duplicate_handling || 'skip' as const
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreateFieldModal, setShowCreateFieldModal] = useState(false);
  const [createFieldForMapping, setCreateFieldForMapping] = useState<number | null>(null);
  const [newFieldData, setNewFieldData] = useState<{
    name: string;
    type: FieldType;
    order_index: number;
  }>({
    name: '',
    type: 'text',
    order_index: 0
  });
  const [isMappingAllFields, setIsMappingAllFields] = useState(false);

  // Stable ordering helpers (prefer masterlist order, then table/order index)
  const sortByOrderIndex = (a: FieldRow, b: FieldRow) => (a.order_index ?? 0) - (b.order_index ?? 0);
  const masterTable = tables.find(t => t.is_master_list);
  const masterFields = masterTable
    ? fields.filter(f => f.table_id === masterTable.id).sort(sortByOrderIndex)
    : [];
  const masterOrderMap = new Map<string, number>();
  masterFields.forEach((field, index) => {
    masterOrderMap.set(field.name.toLowerCase(), index);
  });
  const tableOrderMap = new Map<string, number>(tables.map(t => [t.id, t.order_index ?? 0]));
  const sortByMasterOrder = (a: FieldRow, b: FieldRow) => {
    const aKey = a.name.toLowerCase();
    const bKey = b.name.toLowerCase();
    const aMasterIndex = masterOrderMap.get(aKey);
    const bMasterIndex = masterOrderMap.get(bKey);

    if (aMasterIndex !== undefined && bMasterIndex !== undefined) {
      return aMasterIndex - bMasterIndex;
    }
    if (aMasterIndex !== undefined) return -1;
    if (bMasterIndex !== undefined) return 1;

    const tableCompare = (tableOrderMap.get(a.table_id) ?? 0) - (tableOrderMap.get(b.table_id) ?? 0);
    if (tableCompare !== 0) return tableCompare;

    const orderCompare = sortByOrderIndex(a, b);
    if (orderCompare !== 0) return orderCompare;

    return a.name.localeCompare(b.name);
  };

  // Ensure preserve_original defaults sensibly when switching action types
  useEffect(() => {
    if (formData.action.type === 'move_to_table' && formData.action.preserve_original !== false) {
      setFormData(prev => ({
        ...prev,
        action: { ...prev.action, preserve_original: false }
      }));
      return;
    }

    if (formData.action.type === 'copy_to_table' && formData.action.preserve_original === false) {
      setFormData(prev => ({
        ...prev,
        action: { ...prev.action, preserve_original: true }
      }));
    }
  }, [formData.action.preserve_original, formData.action.type]);

  // Get unique field names across all tables for field selection
  // Prefer the masterlist version of each field (keeps stable IDs/order when new target fields are created)
  const uniqueFieldNames = new Set<string>();
  const fieldsByName = new Map<string, FieldRow>(); // Store first occurrence of each field name (case-insensitive)
  const allFieldsOrdered = [...fields].sort(sortByMasterOrder);
  
  for (const field of allFieldsOrdered) {
    const key = field.name.toLowerCase();
    if (!uniqueFieldNames.has(key)) {
      uniqueFieldNames.add(key);
      fieldsByName.set(key, field);
    }
  }
  
  // Get source fields - prefer selected table; fall back to unique field names only if no table is set
  const sourceTable = formData.trigger.table_name 
    ? tables.find(t => t.name === formData.trigger.table_name)
    : null;
  
  // When a source table is selected, use its actual fields so IDs stay consistent in the dropdowns/mappings.
  // When no table is selected, use the unique-by-name list so base-wide automations still work.
  const sourceFields = sourceTable 
    ? fields.filter(f => f.table_id === sourceTable.id).sort(sortByMasterOrder)
    : Array.from(fieldsByName.values());
  
  // Field mappings should use the same list as the source selector to avoid missing options when IDs differ across tables
  const globalSourceFields = sourceFields;

  // Reset trigger field when source table changes
  useEffect(() => {
    // If field_name is set, find the field and update field_id for backward compatibility
    if (formData.trigger.field_name) {
      const matchingField = sourceFields.find(f => f.name === formData.trigger.field_name);
      if (matchingField && matchingField.id !== formData.trigger.field_id) {
        setFormData(prev => ({
          ...prev,
          trigger: { 
            ...prev.trigger, 
            field_id: matchingField.id // Update field_id for backward compatibility
          }
        }));
      }
    } else if (formData.trigger.table_name && formData.trigger.field_id) {
      // Legacy: Reset field_id if table changes and field doesn't exist
      const sourceTable = tables.find(t => t.name === formData.trigger.table_name);
      if (sourceTable) {
        const tableFields = fields.filter(f => f.table_id === sourceTable.id);
        const fieldExists = tableFields.find(f => f.id === formData.trigger.field_id);
        if (!fieldExists) {
          setFormData(prev => ({
            ...prev,
            trigger: { ...prev.trigger, field_id: undefined }
          }));
        }
      }
    }
  }, [formData.trigger.table_name, formData.trigger.field_name, formData.trigger.field_id, fields, tables, sourceFields]);

  // Get target fields - filter by target table name
  const targetTable = formData.action.target_table_name
    ? tables.find(t => t.name === formData.action.target_table_name)
    : null;
  const targetFields = targetTable
    ? fields.filter(f => f.table_id === targetTable.id).sort(sortByMasterOrder)
    : [];
  
  // Get the selected field to determine appropriate operators
  // Support both field_id (backward compatibility) and field_name (new way)
  const selectedField = formData.trigger.field_name
    ? sourceFields.find(f => f.name === formData.trigger.field_name)
    : sourceFields.find(f => f.id === formData.trigger.field_id);
  const isNumericField = selectedField?.type === 'number';
  const isTextField = selectedField?.type === 'text' || selectedField?.type === 'email';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Automation name is required';
    }

    if (!formData.action.target_table_name) {
      newErrors.target_table_name = 'Target table is required';
    }

    if (formData.trigger.type === 'field_change' && !formData.trigger.field_name && !formData.trigger.field_id) {
      newErrors.trigger_field = 'Field is required for field change trigger';
    }

    if (formData.action.field_mappings.length === 0) {
      newErrors.field_mappings = 'At least one field mapping is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const automationData: Omit<Automation, 'id' | 'created_at'> = {
      name: formData.name,
      base_id: formData.base_id,
      enabled: formData.enabled,
      trigger: {
        type: formData.trigger.type,
        table_name: formData.trigger.table_name || undefined,
        field_id: formData.trigger.field_id || undefined, // Keep for backward compatibility
        field_name: formData.trigger.field_name || undefined, // Field name for cross-table support
        condition: formData.trigger.condition.operator && formData.trigger.condition.value 
          ? formData.trigger.condition 
          : undefined
      },
      action: {
        type: formData.action.type,
        target_table_name: formData.action.target_table_name,
        field_mappings: formData.action.field_mappings,
        preserve_original: formData.action.preserve_original,
        sync_mode: formData.action.sync_mode,
        duplicate_handling: formData.action.duplicate_handling
      }
    };

    onSave(automationData);
  };

  const addFieldMapping = () => {
    setFormData(prev => ({
      ...prev,
      action: {
        ...prev.action,
        field_mappings: [
          ...prev.action.field_mappings,
          { source_field_id: '', target_field_id: '' }
        ]
      }
    }));
  };

  const removeFieldMapping = (index: number) => {
    setFormData(prev => ({
      ...prev,
      action: {
        ...prev.action,
        field_mappings: prev.action.field_mappings.filter((_, i) => i !== index)
      }
    }));
  };

  const updateFieldMapping = (index: number, field: 'source_field_id' | 'target_field_id', value: string) => {
    setFormData(prev => ({
      ...prev,
      action: {
        ...prev.action,
        field_mappings: prev.action.field_mappings.map((mapping, i) => 
          i === index ? { ...mapping, [field]: value } : mapping
        )
      }
    }));
  };

  const handleCreateField = async () => {
    if (!formData.action.target_table_name || !newFieldData.name.trim() || !targetTable) {
      return;
    }

    try {
      const newField = await BaseDetailService.createField({
        name: newFieldData.name,
        type: newFieldData.type,
        table_id: targetTable.id,
        order_index: targetFields.length
      });

      // Update the field mapping with the new field ID
      if (createFieldForMapping !== null) {
        updateFieldMapping(createFieldForMapping, 'target_field_id', newField.id);
      }

      // Reset the form
      setNewFieldData({ name: '', type: 'text', order_index: 0 });
      setShowCreateFieldModal(false);
      setCreateFieldForMapping(null);
      
      // Notify parent component to refresh fields
      if (onFieldCreated) {
        onFieldCreated();
      }
    } catch (error) {
      console.error('Error creating field:', error);
      setErrors({ field_creation: 'Failed to create field' });
    }
  };

  const openCreateFieldModal = (mappingIndex: number) => {
    setCreateFieldForMapping(mappingIndex);
    setShowCreateFieldModal(true);
  };

  const mapAllFields = async () => {
    if (!formData.action.target_table_name || !targetTable) {
      return;
    }

    setIsMappingAllFields(true);
    setErrors({});

    try {
      const newMappings: { source_field_id: string; target_field_id: string }[] = [];
      const fieldsToCreate: { name: string; type: FieldType; order_index: number; options?: Record<string, unknown> }[] = [];

      // Use source fields sorted by masterlist-first ordering so mappings are stable
      const allSourceFields = [...sourceFields].sort(sortByMasterOrder);
      let targetFieldsSnapshot = [...targetFields].sort(sortByMasterOrder);
      const targetByName = new Map<string, FieldRow>();
      targetFieldsSnapshot.forEach(f => targetByName.set(f.name.toLowerCase(), f));
      
      // Track unique field names to prevent duplicates when mapping from multiple tables
      const processedFieldNames = new Set<string>();
      
      for (const sourceField of allSourceFields) {
        // No need to skip masterlist fields here - sourceFields is already filtered correctly
        
        // Skip if we've already processed a field with this name (to avoid duplicates from multiple tables)
        const normalizedSourceName = sourceField.name.toLowerCase();
        if (processedFieldNames.has(normalizedSourceName)) {
          continue;
        }
        
        // Check if a target field with the same name already exists in the target table
        const targetField = targetByName.get(normalizedSourceName);
        
        // Only create field if it doesn't exist in target table
        if (!targetField) {
          // Create a new field in the target table
          // For single_select and multi_select fields, preserve the options from source field
          const fieldToCreate: { name: string; type: FieldType; order_index: number; options?: Record<string, unknown> } = {
            name: sourceField.name,
            type: sourceField.type,
            order_index: targetFieldsSnapshot.length + fieldsToCreate.length
          };
          
          // Preserve options for select fields (single_select, multi_select)
          if ((sourceField.type === 'single_select' || sourceField.type === 'multi_select') && sourceField.options) {
            fieldToCreate.options = sourceField.options;
          }
          
          fieldsToCreate.push(fieldToCreate);
        }
        
        // Mark this field name as processed
        processedFieldNames.add(normalizedSourceName);
      }

      // Create all new fields (masterlist is allowed, but we log for visibility)
      const createdFields: FieldRow[] = [];
      for (const fieldData of fieldsToCreate) {
        try {
          // Build field creation data, including options for select fields
          const createFieldData: {
            name: string;
            type: FieldType;
            table_id: string;
            order_index: number;
            options?: Record<string, unknown>;
          } = {
            name: fieldData.name,
            type: fieldData.type,
            table_id: targetTable.id,
            order_index: fieldData.order_index
          };
          
          // Include options if they exist (for single_select, multi_select fields)
          if (fieldData.options) {
            createFieldData.options = fieldData.options;
          }
          
          const newField = await BaseDetailService.createField(createFieldData);
          createdFields.push(newField);
          console.log('✅ Created field in target table:', { 
            name: newField.name, 
            type: newField.type,
            table_id: newField.table_id, 
            table_name: targetTable.name,
            hasOptions: !!newField.options
          });
        } catch (error) {
          console.error('Error creating field:', error);
          setErrors({ field_creation: 'Failed to create some fields' });
          setIsMappingAllFields(false);
          return;
        }
      }

      // Refresh target fields to include newly created ones (sorted)
      try {
        targetFieldsSnapshot = await BaseDetailService.getFields(targetTable.id);
        targetFieldsSnapshot = [...targetFieldsSnapshot].sort(sortByMasterOrder);
      } catch (err) {
        console.warn('Failed to refresh target fields; using snapshot', err);
      }
      targetByName.clear();
      targetFieldsSnapshot.forEach(f => targetByName.set(f.name.toLowerCase(), f));
      if (onFieldCreated) {
        onFieldCreated();
      }

      // Create mappings for all source fields
      // Use the same processedFieldNames to ensure we only map once per field name
      const mappedFieldNames = new Set<string>();
      
      for (const sourceField of allSourceFields) {
        // No need to skip masterlist fields here - sourceFields is already filtered correctly
        
        // Skip if we've already mapped a field with this name (to avoid duplicate mappings)
        const normalizedSourceName = sourceField.name.toLowerCase();
        if (mappedFieldNames.has(normalizedSourceName)) {
          continue;
        }
        
        // Find the corresponding target field (existing or newly created)
        const targetField =
          targetByName.get(normalizedSourceName) ||
          createdFields.find(f => f.name.toLowerCase() === normalizedSourceName);
        
        if (targetField) {
          newMappings.push({
            source_field_id: sourceField.id,
            target_field_id: targetField.id
          });
          // Mark this field name as mapped
          mappedFieldNames.add(normalizedSourceName);
        }
      }

      // Update the form with all mappings
      setFormData(prev => ({
        ...prev,
        action: {
          ...prev.action,
          field_mappings: newMappings
        }
      }));

      // Clear any previous errors
      setErrors({});
    } catch (error) {
      console.error('Error mapping all fields:', error);
      setErrors({ field_mapping: 'Failed to map all fields' });
    } finally {
      setIsMappingAllFields(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-500/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {automation ? 'Edit Automation' : 'Create Automation'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Automation Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter automation name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Table (optional)
              </label>
              <select
                value={formData.trigger.table_name || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ 
                    ...prev, 
                    trigger: { 
                      ...prev.trigger, 
                      table_name: value,
                      // Clear legacy field id when going base-wide to avoid mismatched IDs
                      field_id: value ? prev.trigger.field_id : undefined 
                    }
                  }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.table_name ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Any table (base-wide)</option>
                {tables.map(table => (
                  <option key={table.id} value={table.name}>{table.name}</option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Leave blank to trigger from any table in this base, or pick a table to scope the automation.
              </p>
              {errors.table_name && <p className="text-red-500 text-sm mt-1">{errors.table_name}</p>}
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-md font-medium text-gray-900">Trigger Configuration</h4>
              <p className="text-sm text-gray-600 mt-1">
                Set up when this automation should run. For status fields, you can use numeric comparisons to trigger based on values.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Type
                </label>
                <select
                  value={formData.trigger.type}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    trigger: { ...prev.trigger, type: e.target.value as AutomationTrigger['type'] }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="field_change">Field Change</option>
                  <option value="record_created">Record Created</option>
                  <option value="record_updated">Record Updated</option>
                </select>
              </div>

              {formData.trigger.type === 'field_change' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field * (required for field change)
                    </label>
                    <select
                      value={
                        formData.trigger.table_name
                          ? formData.trigger.field_id || ''
                          : formData.trigger.field_name || formData.trigger.field_id || ''
                      }
                      onChange={(e) => {
                        const selected = e.target.value;
                        const selectedField = sourceFields.find(f => f.id === selected || f.name === selected);
                        const nextFieldId = formData.trigger.table_name ? selectedField?.id || selected : selectedField?.id;
                        const nextFieldName = selectedField?.name || (!formData.trigger.table_name ? selected : undefined);

                        setFormData(prev => ({
                          ...prev,
                          trigger: {
                            ...prev.trigger,
                            field_name: nextFieldName,
                            field_id: nextFieldId
                          }
                        }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.trigger_field ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select field (required)</option>
                      {sourceFields.length === 0 ? (
                        <option value="" disabled>No fields available{formData.trigger.table_name ? ' for selected table' : ''}</option>
                      ) : (
                        sourceFields.map(field => {
                          return (
                            <option key={field.id} value={formData.trigger.table_name ? field.id : field.name}>
                              {field.name}
                            </option>
                          );
                        })
                      )}
                    </select>
                    {errors.trigger_field && <p className="text-red-500 text-sm mt-1">{errors.trigger_field}</p>}
                    {sourceFields.length === 0 && formData.trigger.table_name && (
                      <p className="text-yellow-600 text-sm mt-1">No fields found for the selected table</p>
                    )}
                  </div>

                  {/* Condition Configuration */}
                  {(formData.trigger.field_id || formData.trigger.field_name) && (
                    <div className="col-span-2 space-y-3">
                      <h5 className="text-sm font-medium text-gray-700">Trigger Condition</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Operator
                          </label>
                          <select
                            value={formData.trigger.condition.operator}
                            onChange={(e) => setFormData(prev => {
                              const currentCondition = prev.trigger.condition ?? { operator: 'equals' as const, value: '' };
                              return {
                                ...prev, 
                                trigger: { 
                                  ...prev.trigger, 
                                  condition: { 
                                    ...currentCondition, 
                                    operator: e.target.value as NonNullable<AutomationTrigger['condition']>['operator']
                                  }
                                }
                              };
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            {isTextField && <option value="contains">Contains</option>}
                            {isNumericField && (
                              <>
                                <option value="greater_than">Greater Than</option>
                                <option value="less_than">Less Than</option>
                                <option value="greater_than_or_equal">Greater Than or Equal</option>
                                <option value="less_than_or_equal">Less Than or Equal</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Value
                          </label>
                          <input
                            type={isNumericField ? "number" : "text"}
                            value={formData.trigger.condition.value}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              trigger: { 
                                ...prev.trigger, 
                                condition: { 
                                  ...prev.trigger.condition, 
                                  value: isNumericField ? parseFloat(e.target.value) || 0 : e.target.value 
                                }
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={isNumericField ? "Enter numeric value (e.g., 5)" : "Enter trigger value (e.g., 'buyer')"}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-md font-medium text-gray-900">Action Configuration</h4>
              <p className="text-sm text-gray-600 mt-1">
                Define what happens when the trigger condition is met. You can copy or move data between tables with field mappings.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Type
                </label>
                <select
                  value={formData.action.type}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    action: { ...prev.action, type: e.target.value as AutomationAction['type'] }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="copy_to_table">Copy to Table (creates new record)</option>
                  <option value="move_to_table">Move to Table (moves record)</option>
                  <option value="sync_to_table">Sync to Table (updates existing or creates new)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Table *
                </label>
                <select
                  value={formData.action.target_table_name}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    action: { ...prev.action, target_table_name: e.target.value }
                  }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.target_table_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select target table</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.name}>{table.name}</option>
                  ))}
                </select>
                {errors.target_table_name && <p className="text-red-500 text-sm mt-1">{errors.target_table_name}</p>}
              </div>
            </div>

            {/* Preserve Original Setting */}
            {formData.action.type === 'move_to_table' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-blue-900 mb-1">Move Operation</h5>
                    <p className="text-sm text-blue-700 mb-3">
                      This automation will move records from the source table to the target table. 
                      The original record will be removed from the source table.
                    </p>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.action.preserve_original}
                        disabled
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          action: { ...prev.action, preserve_original: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-blue-700">
                        Keep original record in source table (disabled for move operations)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Field Mappings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Field Mappings *
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Map fields from source to target table. You can create new fields in the target table if needed.
                  </p>
                </div>
                <div className="flex gap-2">
                  {formData.action.target_table_name && (
                    <button
                      type="button"
                      onClick={mapAllFields}
                      disabled={isMappingAllFields}
                      className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors border ${
                        isMappingAllFields 
                          ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed' 
                          : 'text-green-600 hover:bg-green-50 border-green-200'
                      }`}
                    >
                      {isMappingAllFields ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                          Mapping...
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Map All Fields
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addFieldMapping}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                    Add Mapping
                  </button>
                </div>
              </div>

              {formData.action.field_mappings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">No field mappings yet</p>
                  <p className="text-sm">
                    {formData.action.target_table_name 
                      ? 'Click "Map All Fields" to automatically map all source fields, or "Add Mapping" for manual mapping'
                      : 'Select target table, then click "Map All Fields" or "Add Mapping" to start mapping fields'
                    }
                  </p>
                </div>
              )}

              {formData.action.field_mappings.map((mapping, index) => {
                const selectedSourceField = globalSourceFields.find(f => f.id === mapping.source_field_id);
                const selectedTargetField = targetFields.find(f => f.id === mapping.target_field_id);
                
                return (
                <div key={index} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Source Field {selectedSourceField && `(${selectedSourceField.name})`}
                    </label>
                    <select
                      value={mapping.source_field_id}
                      onChange={(e) => updateFieldMapping(index, 'source_field_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select source field</option>
                      {globalSourceFields.map(field => {
                        return (
                          <option key={field.id} value={field.id}>
                            {field.name}
                          </option>
                        );
                      })}
                      {mapping.source_field_id && (
                        <option value="" style={{ color: '#ef4444' }}>✕ None (clear selection)</option>
                      )}
                    </select>
                  </div>
                  <span className="text-gray-500">→</span>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Target Field {selectedTargetField && `(${selectedTargetField.name})`}
                    </label>
                    <select
                      value={mapping.target_field_id}
                      onChange={(e) => {
                        if (e.target.value === '__create_field__') {
                          openCreateFieldModal(index);
                        } else {
                          updateFieldMapping(index, 'target_field_id', e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select target field</option>
                      {targetFields.map(field => (
                        <option key={field.id} value={field.id}>{field.name}</option>
                      ))}
                      <option value="__create_field__">+ Create new field</option>
                      {mapping.target_field_id && (
                        <option value="" style={{ color: '#ef4444' }}>✕ None (clear selection)</option>
                      )}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFieldMapping(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                );
              })}

              {errors.field_mappings && <p className="text-red-500 text-sm mt-1">{errors.field_mappings}</p>}
              {errors.field_mapping && <p className="text-red-500 text-sm mt-1">{errors.field_mapping}</p>}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 justify-end pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {automation ? 'Update Automation' : 'Create Automation'}
            </button>
          </div>
        </form>
      </div>

      {/* Create Field Modal */}
      {showCreateFieldModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-gray-500/20 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Create New Field
                </h3>
                <button
                  onClick={() => setShowCreateFieldModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Name *
                </label>
                <input
                  type="text"
                  value={newFieldData.name}
                  onChange={(e) => setNewFieldData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter field name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Type *
                </label>
                <select
                  value={newFieldData.type}
                  onChange={(e) => setNewFieldData(prev => ({ ...prev, type: e.target.value as FieldType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="datetime">Date Time</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="single_select">Single Select</option>
                  <option value="multi_select">Multi Select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="link">Link</option>
                </select>
              </div>

              {errors.field_creation && (
                <p className="text-red-500 text-sm">{errors.field_creation}</p>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateFieldModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateField}
                  disabled={!newFieldData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Field
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
