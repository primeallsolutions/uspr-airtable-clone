"use client";
import { useState, useEffect } from 'react';
import { X, Building2, Kanban, Package, Calendar, FileText, Sparkles } from 'lucide-react';
import type { Template } from '@/lib/types/templates';
import type { WorkspaceRecord } from '@/lib/types/dashboard';
import { TemplateService } from '@/lib/services/template-service';
import { getFieldTypeLabel } from '@/lib/utils/field-type-helpers';
import type { FieldType } from '@/lib/types/base-detail';

interface TemplatePreviewModalProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (templateId: string, workspaceId: string, baseName?: string) => Promise<void>;
  workspaces: WorkspaceRecord[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Kanban,
  Package,
  Calendar,
  FileText,
  Sparkles
};

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  project_management: 'Project Management',
  inventory: 'Inventory',
  event_planning: 'Event Planning',
  content_calendar: 'Content Calendar',
  custom: 'Custom'
};

export const TemplatePreviewModal = ({
  template,
  isOpen,
  onClose,
  onUseTemplate,
  workspaces
}: TemplatePreviewModalProps) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [baseName, setBaseName] = useState('');
  const [loading, setLoading] = useState(false);

  // Set default workspace when modal opens or workspaces change
  useEffect(() => {
    if (isOpen && workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [isOpen, workspaces, selectedWorkspaceId]);

  if (!isOpen || !template) return null;

  const stats = TemplateService.getTemplateStats(template);
  const IconComponent = template.icon ? ICON_MAP[template.icon] : Sparkles;
  const templateData = template.template_data;

  const handleUseTemplate = async () => {
    if (workspaces.length === 0) {
      alert('No workspaces available. Please create a workspace first.');
      return;
    }

    if (!selectedWorkspaceId && workspaces.length > 0) {
      alert('Please select a workspace');
      return;
    }

    setLoading(true);
    try {
      const workspaceId = selectedWorkspaceId || workspaces[0]?.id;
      await onUseTemplate(template.id, workspaceId, baseName || undefined);
      onClose();
    } catch (error) {
      console.error('Error using template:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              {IconComponent && <IconComponent className="w-5 h-5 text-blue-600" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
              <span className="text-sm text-gray-500">{CATEGORY_LABELS[template.category] || template.category}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Description */}
          {template.description && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-gray-600">{template.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.tableCount}</div>
              <div className="text-sm text-gray-600">Tables</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.fieldCount}</div>
              <div className="text-sm text-gray-600">Fields</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.recordCount}</div>
              <div className="text-sm text-gray-600">Sample Records</div>
            </div>
          </div>

          {/* Tables Preview */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Tables Included</h4>
            <div className="space-y-3">
              {templateData.tables.map((table, idx) => {
                const tableFields = templateData.fields.filter(f => f.table_name === table.name);
                return (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-medium text-gray-900">{table.name}</h5>
                      {table.is_master_list && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                          Master
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tableFields.map((field, fieldIdx) => (
                        <span
                          key={fieldIdx}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                        >
                          {field.name} ({getFieldTypeLabel(field.type as FieldType)})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-medium text-gray-900 mb-4">Create Base from Template</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace
                </label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || workspaces.length <= 1}
                  required
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Name (optional)
                </label>
                <input
                  type="text"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder={`Leave empty to use "${template.name}"`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If left empty, the template name will be used
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUseTemplate}
            disabled={loading || workspaces.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Use Template'}
          </button>
        </div>
      </div>
    </div>
  );
};

