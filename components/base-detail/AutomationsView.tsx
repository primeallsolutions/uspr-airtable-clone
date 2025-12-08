import { useState } from "react";
import { Plus, Play, Pause, Edit, Trash2, Copy, Move, RefreshCw } from "lucide-react";
import { CreateAutomationModal } from "./CreateAutomationModal";
import { CopyAutomationModal } from "./CopyAutomationModal";
import type { Automation, TableRow, FieldRow } from "@/lib/types/base-detail";

interface AutomationsViewProps {
  automations: Automation[];
  tables: TableRow[];
  fields: FieldRow[];
  baseId: string; // Changed from activeTableId to baseId for base-level automations
  onCreateAutomation: (automation: Omit<Automation, 'id' | 'created_at'>) => void;
  onUpdateAutomation: (id: string, updates: Partial<Automation>) => void;
  onDeleteAutomation: (id: string) => void;
  onToggleAutomation: (id: string) => void;
  onFieldCreated?: (tableId: string) => void;
}

export const AutomationsView = ({
  automations,
  tables,
  fields,
  baseId,
  onCreateAutomation,
  onUpdateAutomation,
  onDeleteAutomation,
  onToggleAutomation,
  onFieldCreated
}: AutomationsViewProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [copyingAutomation, setCopyingAutomation] = useState<Automation | null>(null);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'copy_fields':
      case 'copy_to_table':
        return <Copy size={16} className="text-blue-600" />;
      case 'move_to_table':
        return <Move size={16} className="text-orange-600" />;
      case 'sync_to_table':
        return <RefreshCw size={16} className="text-green-600" />;
      default:
        return <Play size={16} className="text-gray-600" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'copy_fields':
        return 'Copy Fields';
      case 'copy_to_table':
        return 'Copy to Table';
      case 'move_to_table':
        return 'Move to Table';
      case 'sync_to_table':
        return 'Sync to Table';
      case 'create_record':
        return 'Create Record';
      case 'update_record':
        return 'Update Record';
      case 'show_in_table':
        return 'Show in Table';
      default:
        return actionType;
    }
  };

  const getTriggerLabel = (trigger: Automation['trigger']) => {
    switch (trigger.type) {
      case 'field_change':
        return `When ${trigger.field_id ? 'field changes' : 'any field changes'}`;
      case 'record_created':
        return 'When record is created';
      case 'record_updated':
        return 'When record is updated';
      default:
        return trigger.type;
    }
  };

  const getTargetTableName = (tableName: string) => {
    // target_table_name is already a table name, not an ID
    return tableName || 'Unknown Table';
  };

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-hidden">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Automations</h2>
            <p className="text-gray-600 mt-1">
              Automate workflows by copying and moving data between tables
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Create Automation
          </button>
        </div>

        {/* Automations List */}
        {automations.length === 0 ? (
          <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Play size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No automations yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first automation to start copying and moving data between tables
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Create Automation
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid gap-4 pb-4">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getActionIcon(automation.action.type)}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {automation.name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            automation.enabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {automation.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Trigger:</span> {getTriggerLabel(automation.trigger)}
                        </p>
                        <p>
                          <span className="font-medium">Action:</span> {getActionLabel(automation.action.type)} → {getTargetTableName(automation.action.target_table_name)}
                        </p>
                        {automation.action.field_mappings.length > 0 && (
                          <p>
                            <span className="font-medium">Field Mappings:</span> {automation.action.field_mappings.length} field(s)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => onToggleAutomation(automation.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          automation.enabled
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={automation.enabled ? 'Disable' : 'Enable'}
                      >
                        {automation.enabled ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => setCopyingAutomation(automation)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy to another table"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => setEditingAutomation(automation)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteAutomation(automation.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isCreateModalOpen && (
        <CreateAutomationModal
          tables={tables}
          fields={fields}
          baseId={baseId}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(automation) => {
            onCreateAutomation(automation);
            setIsCreateModalOpen(false);
          }}
          onFieldCreated={onFieldCreated ? () => onFieldCreated('') : undefined}
        />
      )}

      {editingAutomation && (
        <CreateAutomationModal
          tables={tables}
          fields={fields}
          baseId={baseId}
          automation={editingAutomation}
          onClose={() => setEditingAutomation(null)}
          onSave={(automation) => {
            onUpdateAutomation(editingAutomation.id, automation);
            setEditingAutomation(null);
          }}
          onFieldCreated={onFieldCreated ? () => onFieldCreated('') : undefined}
        />
      )}

      {copyingAutomation && (
        <CopyAutomationModal
          automation={copyingAutomation}
          tables={tables}
          fields={fields}
          baseId={baseId}
          onClose={() => setCopyingAutomation(null)}
          onCopy={(automation, fieldMappings) => {
            void fieldMappings;
            onCreateAutomation(automation);
            setCopyingAutomation(null);
          }}
        />
      )}
    </div>
  );
};
