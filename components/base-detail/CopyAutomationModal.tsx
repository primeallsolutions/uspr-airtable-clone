import { useState, useEffect } from "react";
import { X, Copy, AlertCircle } from "lucide-react";
import type { Automation, TableRow, FieldRow } from "@/lib/types/base-detail";

interface CopyAutomationModalProps {
  automation: Automation;
  tables: TableRow[];
  fields: FieldRow[];
  baseId: string; // Added baseId prop for base-level automations
  onClose: () => void;
  onCopy: (automation: Omit<Automation, 'id' | 'created_at'>, fieldMappings: Array<{ source_field_id: string; target_field_id: string }>) => void;
}

export const CopyAutomationModal = ({
  automation,
  tables,
  fields,
  baseId,
  onClose,
  onCopy
}: CopyAutomationModalProps) => {
  // Find source table by name from trigger.table_name, or use first table if not specified
  const initialSourceTable = automation.trigger.table_name
    ? tables.find(t => t.name === automation.trigger.table_name)
    : tables[0];
  const [selectedSourceTableId, setSelectedSourceTableId] = useState(initialSourceTable?.id || '');
  const [selectedTargetTableId, setSelectedTargetTableId] = useState('');
  const [fieldMappings, setFieldMappings] = useState<Array<{ source_field_id: string; target_field_id: string; mapped: boolean }>>([]);
  const [newName, setNewName] = useState(`${automation.name} (Copy)`);

  // Compute source and target fields based on selected tables
  const sourceFields = fields.filter(f => f.table_id === selectedSourceTableId);
  const targetFields = fields.filter(f => f.table_id === selectedTargetTableId);

  // Auto-map fields when source or target table is selected
  useEffect(() => {
    if (selectedSourceTableId && selectedTargetTableId && automation.action.field_mappings.length > 0) {
      // Compute source and target fields inside the effect to avoid dependency issues
      const sourceFields = fields.filter(f => f.table_id === selectedSourceTableId);
      const targetFields = fields.filter(f => f.table_id === selectedTargetTableId);
      
      const mappings: Array<{ source_field_id: string; target_field_id: string; mapped: boolean }> = [];
      
      for (const originalMapping of automation.action.field_mappings) {
        const originalSourceField = fields.find(f => f.id === originalMapping.source_field_id);
        const originalTargetField = fields.find(f => f.id === originalMapping.target_field_id);
        
        if (originalSourceField) {
          // Try to find the source field in the new source table (by name and type)
          const newSourceField = sourceFields.find(
            f => f.name === originalSourceField.name && f.type === originalSourceField.type
          );
          
          if (newSourceField) {
            // Try to find a field in the new target table
            // First, try matching by the original target field name/type
            let mappedTargetField = originalTargetField
              ? targetFields.find(
                  f => f.name === originalTargetField.name && f.type === originalTargetField.type
                )
              : null;
            
            // If not found, try matching by the source field name (common pattern)
            if (!mappedTargetField) {
              mappedTargetField = targetFields.find(
                f => f.name === originalSourceField.name && f.type === originalSourceField.type
              );
            }
            
            mappings.push({
              source_field_id: newSourceField.id,
              target_field_id: mappedTargetField?.id || '',
              mapped: !!mappedTargetField
            });
          }
        }
      }
      
      setFieldMappings(mappings);
    } else {
      setFieldMappings([]);
    }
  }, [selectedSourceTableId, selectedTargetTableId, fields, automation.action.field_mappings]);

  const handleCopy = () => {
    const validMappings = fieldMappings
      .filter(m => m.source_field_id && m.target_field_id)
      .map(m => ({ source_field_id: m.source_field_id, target_field_id: m.target_field_id }));

    if (validMappings.length === 0) {
      alert('Please ensure all field mappings are complete before copying the automation.');
      return;
    }

    if (!selectedSourceTableId || !selectedTargetTableId) {
      alert('Please select both source and target tables.');
      return;
    }

    // Get table names for the selected tables
    const sourceTable = tables.find(t => t.id === selectedSourceTableId);
    const targetTable = tables.find(t => t.id === selectedTargetTableId);
    
    if (!sourceTable || !targetTable) {
      alert('Invalid table selection. Please try again.');
      return;
    }

    const copiedAutomation: Omit<Automation, 'id' | 'created_at'> = {
      name: newName,
      base_id: baseId, // Changed from table_id to base_id for base-level automations
      enabled: false, // Start disabled so user can review
      trigger: {
        ...automation.trigger,
        table_name: sourceTable.name, // Changed from table_id to table_name (optional)
        // Reset field_id if the original field doesn't exist in new source table
        field_id: (() => {
          if (!automation.trigger.field_id) return undefined;
          const originalTriggerField = fields.find(f => f.id === automation.trigger.field_id);
          if (!originalTriggerField) return undefined;
          // Check if a field with the same name and type exists in the new source table
          const matchingField = sourceFields.find(
            f => f.name === originalTriggerField.name && f.type === originalTriggerField.type
          );
          return matchingField?.id || undefined;
        })()
      },
      action: {
        ...automation.action,
        target_table_name: targetTable.name, // Changed from target_table_id to target_table_name
        field_mappings: validMappings
      }
    };

    onCopy(copiedAutomation, validMappings);
  };

  const unmappedCount = fieldMappings.filter(m => !m.mapped).length;
  const canCopy = selectedSourceTableId && selectedTargetTableId && fieldMappings.length > 0 && unmappedCount === 0;

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-500/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Copy size={20} className="text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Copy Automation
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Automation Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Automation Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter automation name"
            />
          </div>

          {/* Source Table Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Table *
            </label>
            <select
              value={selectedSourceTableId}
              onChange={(e) => setSelectedSourceTableId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select source table</option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>{table.name}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              The table where this automation will trigger
            </p>
          </div>

          {/* Target Table Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Table *
            </label>
            <select
              value={selectedTargetTableId}
              onChange={(e) => setSelectedTargetTableId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select target table</option>
              {tables
                .filter(table => table.id !== selectedSourceTableId)
                .map(table => (
                  <option key={table.id} value={table.id}>{table.name}</option>
                ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              The table where data will be copied/moved to
            </p>
          </div>

          {/* Field Mappings */}
          {selectedTargetTableId && fieldMappings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Field Mappings
                </label>
                {unmappedCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertCircle size={16} />
                    <span>{unmappedCount} field(s) need mapping</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {fieldMappings.map((mapping, index) => {
                  const sourceField = sourceFields.find(f => f.id === mapping.source_field_id);
                  
                  return (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">
                          {sourceField?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">{sourceField?.type || ''}</div>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div className="flex-1">
                        <select
                          value={mapping.target_field_id}
                          onChange={(e) => {
                            setFieldMappings(prev => 
                              prev.map((m, i) => 
                                i === index 
                                  ? { ...m, target_field_id: e.target.value, mapped: !!e.target.value }
                                  : m
                              )
                            );
                          }}
                          className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            !mapping.mapped ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select target field</option>
                          {targetFields
                            .filter(f => f.type === sourceField?.type)
                            .map(field => (
                              <option key={field.id} value={field.id}>
                                {field.name} ({field.type})
                              </option>
                            ))}
                          {targetFields
                            .filter(f => f.type !== sourceField?.type)
                            .map(field => (
                              <option key={field.id} value={field.id}>
                                {field.name} ({field.type}) - Type mismatch
                              </option>
                            ))}
                        </select>
                      </div>
                      {mapping.mapped && (
                        <div className="text-green-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {unmappedCount === 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ All fields are mapped
                </p>
              )}
            </div>
          )}

          {/* Warning if source table changes and trigger field doesn't exist */}
          {selectedSourceTableId && 
           automation.trigger.type === 'field_change' && 
           automation.trigger.field_id && (() => {
             const originalTriggerField = fields.find(f => f.id === automation.trigger.field_id);
             if (!originalTriggerField) return false;
             const matchingField = sourceFields.find(
               f => f.name === originalTriggerField.name && f.type === originalTriggerField.type
             );
             return !matchingField;
           })() && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-600 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-amber-900 mb-1">
                    Trigger Field Not Found
                  </h5>
                  <p className="text-sm text-amber-700">
                    The original trigger field doesn&apos;t exist in the selected source table. 
                    The automation will be created with the trigger field reset. 
                    You can edit it after creation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Copy size={20} className="text-blue-600 mt-0.5" />
              <div>
                <h5 className="text-sm font-medium text-blue-900 mb-1">
                  Original Automation
                </h5>
                <p className="text-sm text-blue-700 mb-2">
                  <strong>Name:</strong> {automation.name}
                </p>
                <p className="text-sm text-blue-700 mb-2">
                  <strong>Action:</strong> {automation.action.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                <p className="text-sm text-blue-700">
                  <strong>Field Mappings:</strong> {automation.action.field_mappings.length} field(s)
                </p>
              </div>
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
              type="button"
              onClick={handleCopy}
              disabled={!canCopy || !newName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Copy size={16} />
              Copy Automation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

