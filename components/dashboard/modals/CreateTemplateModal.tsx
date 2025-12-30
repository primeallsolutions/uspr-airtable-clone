"use client";
import { useState } from 'react';
import { X, Building2, Kanban, Package, Calendar, FileText, Sparkles, Check } from 'lucide-react';
import type { TemplateCategory } from '@/lib/types/templates';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    category: TemplateCategory;
    icon: string;
    includeRecords: boolean;
  }) => Promise<void>;
  baseId: string;
  baseName?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Kanban,
  Package,
  Calendar,
  FileText,
  Sparkles
};

const CATEGORIES: Array<{ id: TemplateCategory; label: string; icon: string; description: string }> = [
  { id: 'crm', label: 'CRM', icon: 'Building2', description: 'Customer relationship management' },
  { id: 'project_management', label: 'Project Management', icon: 'Kanban', description: 'Project tracking' },
  { id: 'inventory', label: 'Inventory', icon: 'Package', description: 'Stock management' },
  { id: 'event_planning', label: 'Event Planning', icon: 'Calendar', description: 'Event coordination' },
  { id: 'content_calendar', label: 'Content Calendar', icon: 'FileText', description: 'Content scheduling' },
  { id: 'custom', label: 'Custom', icon: 'Sparkles', description: 'Other use cases' }
];

const AVAILABLE_ICONS = ['Building2', 'Kanban', 'Package', 'Calendar', 'FileText', 'Sparkles'];

export const CreateTemplateModal = ({
  isOpen,
  onClose,
  onCreate,
  baseId,
  baseName
}: CreateTemplateModalProps) => {
  const [name, setName] = useState(baseName || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [selectedIcon, setSelectedIcon] = useState('Sparkles');
  const [includeRecords, setIncludeRecords] = useState(true);
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please provide a template name');
      return;
    }

    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        category,
        icon: selectedIcon,
        includeRecords
      });
      
      // Reset form
      setName('');
      setDescription('');
      setCategory('custom');
      setSelectedIcon('Sparkles');
      setIncludeRecords(true);
      
      onClose();
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={creating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My CRM Template"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this template is for..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={creating}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Category *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const IconComponent = ICON_MAP[cat.icon];
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={creating}
                    >
                      <div className="flex items-start gap-3">
                        {IconComponent && (
                          <IconComponent className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{cat.label}</div>
                          <div className="text-xs text-gray-500">{cat.description}</div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Icon
              </label>
              <div className="flex gap-2 flex-wrap">
                {AVAILABLE_ICONS.map((iconName) => {
                  const IconComponent = ICON_MAP[iconName];
                  const isSelected = selectedIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      className={`p-3 border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={creating}
                    >
                      {IconComponent && (
                        <IconComponent className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Include Records */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="includeRecords"
                checked={includeRecords}
                onChange={(e) => setIncludeRecords(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={creating}
              />
              <div className="flex-1">
                <label htmlFor="includeRecords" className="font-medium text-gray-900 text-sm cursor-pointer">
                  Include sample data
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  Include existing records as sample data in the template. Recommended for showcasing the template structure.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will save the current base structure (tables, fields, automations) 
                {includeRecords ? ' and records' : ''} as a reusable template. You can use this template to create new bases in any workspace.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

