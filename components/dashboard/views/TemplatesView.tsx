"use client";
import { useState, useEffect, useCallback } from 'react';
import { Search, Building2, Kanban, Package, Calendar, FileText, Sparkles } from 'lucide-react';
import type { Template, TemplateCategory, CategoryInfo } from '@/lib/types/templates';
import { TemplateService } from '@/lib/services/dashboard-template-service';
import { toast } from 'sonner';
import type { CollectionView } from "@/lib/types/dashboard";
import { ViewToggle } from '../ViewToggle';

interface TemplatesViewProps {
  onUseTemplate: (template: Template) => void;
  onPreviewTemplate: (template: Template) => void;
  onEditTemplate?: (template: Template) => void;
  onDeleteTemplate?: (template: Template) => void;
  userId?: string;
  collectionView: CollectionView;
  onCollectionViewChange: (view: CollectionView) => void;
  searchQuery: string;
}

const CATEGORY_INFO: Record<TemplateCategory | 'all', CategoryInfo | { id: 'all'; label: string; icon: string; description: string }> = {
  all: {
    id: 'all',
    label: 'All Templates',
    icon: 'Sparkles',
    description: 'Browse all available templates'
  },
  crm: {
    id: 'crm',
    label: 'CRM',
    icon: 'Building2',
    description: 'Customer relationship management templates'
  },
  project_management: {
    id: 'project_management',
    label: 'Project Management',
    icon: 'Kanban',
    description: 'Project tracking and task management'
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    icon: 'Package',
    description: 'Stock and inventory management'
  },
  event_planning: {
    id: 'event_planning',
    label: 'Event Planning',
    icon: 'Calendar',
    description: 'Event coordination and management'
  },
  content_calendar: {
    id: 'content_calendar',
    label: 'Content Calendar',
    icon: 'FileText',
    description: 'Content planning and scheduling'
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    icon: 'Sparkles',
    description: 'Your custom templates'
  }
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Kanban,
  Package,
  Calendar,
  FileText,
  Sparkles
};

export const TemplatesView = ({
  onUseTemplate,
  onPreviewTemplate,
  onEditTemplate,
  onDeleteTemplate,
  userId,
  collectionView,
  onCollectionViewChange,
  searchQuery
}: TemplatesViewProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await TemplateService.getTemplates(userId);
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load templates', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group templates by type
  const globalTemplates = filteredTemplates.filter(t => t.is_global);
  const userTemplates = filteredTemplates.filter(t => !t.is_global);

  const renderTemplateCard = (template: Template) => {
    const stats = TemplateService.getTemplateStats(template);
    const IconComponent = template.icon ? ICON_MAP[template.icon] : Sparkles;
    const isUserTemplate = !template.is_global;

    if (collectionView === 'list') {
      return (
        <div
          key={template.id}
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => onPreviewTemplate(template)}
        >
          <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            {IconComponent && <IconComponent className="w-6 h-6 text-blue-600" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
              {isUserTemplate && (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                  Custom
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-1">{template.description || 'No description'}</p>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>{stats.tableCount} tables</span>
            <span>{stats.fieldCount} fields</span>
            {stats.recordCount > 0 && <span>{stats.recordCount} records</span>}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseTemplate(template);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Use Template
          </button>
          
          {isUserTemplate && onEditTemplate && onDeleteTemplate && (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTemplate(template);
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTemplate(template);
                }}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={template.id}
        className="group p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
        onClick={() => onPreviewTemplate(template)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            {IconComponent && <IconComponent className="w-6 h-6 text-blue-600" />}
          </div>
          {isUserTemplate && (
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
              Custom
            </span>
          )}
        </div>
        
        <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
          {template.description || 'No description available'}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
          <span>{stats.tableCount} tables</span>
          <span>{stats.fieldCount} fields</span>
          {stats.recordCount > 0 && <span>{stats.recordCount} records</span>}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseTemplate(template);
            }}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Use Template
          </button>
          
          {isUserTemplate && onEditTemplate && onDeleteTemplate && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTemplate(template);
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTemplate(template);
                }}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600 mt-1">Create bases from pre-built templates or your custom designs</p>
        </div>

        <ViewToggle
          collectionView={collectionView}
          setCollectionView={onCollectionViewChange}
        />
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.values(CATEGORY_INFO).map((category) => {
          const IconComponent = ICON_MAP[category.icon] || Sparkles;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id as TemplateCategory | 'all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              {category.label}
            </button>
          );
        })}
      </div>

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600">
            {searchQuery
              ? 'Try adjusting your search or filters'
              : 'Create your first custom template from an existing base'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Global Templates */}
          {globalTemplates.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pre-built Templates</h2>
              <div className={collectionView === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-3'
              }>
                {globalTemplates.map(renderTemplateCard)}
              </div>
            </div>
          )}

          {/* User Templates */}
          {userTemplates.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Templates</h2>
              <div className={collectionView === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-3'
              }>
                {userTemplates.map(renderTemplateCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

