import { useState, useEffect, useCallback, useRef } from "react";
import type { ActiveView, WorkspaceRecord, CreateBaseFormData } from "@/lib/types/dashboard";
import type { Template } from "@/lib/types/templates";
import { TemplateService } from "@/lib/services/template-service";
import { Building2, Kanban, Package, Calendar, FileText, Sparkles } from "lucide-react";

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateBaseFormData) => Promise<void>;
  onCreateFromTemplate?: (templateId: string, workspaceId: string, baseName?: string) => Promise<void>;
  activeView: ActiveView;
  selectedWorkspaceId: string | null;
  workspaces: WorkspaceRecord[];
  onImport?: () => void;
  userId?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Kanban,
  Package,
  Calendar,
  FileText,
  Sparkles
};

export const CreateBaseModal = ({ 
  isOpen, 
  onClose, 
  onCreate,
  onCreateFromTemplate,
  activeView, 
  selectedWorkspaceId, 
  workspaces,
  onImport,
  userId
}: CreateBaseModalProps) => {
  // Initialize with the selected workspace or the first available workspace
  const defaultWorkspaceId = selectedWorkspaceId || workspaces[0]?.id || "";
  
  const [activeTab, setActiveTab] = useState<'blank' | 'template'>('blank');
  const [baseName, setBaseName] = useState("");
  const [baseDescription, setBaseDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Template-related state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  
  // Form ref for submit
  const formRef = useRef<HTMLFormElement>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const data = await TemplateService.getTemplates(userId);
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, [userId]);

  // Update workspace ID when the modal opens or selected workspace changes
  useEffect(() => {
    if (isOpen) {
      const newDefaultWorkspaceId = selectedWorkspaceId || workspaces[0]?.id || "";
      setWorkspaceId(newDefaultWorkspaceId);
      setActiveTab('blank');
      setSelectedTemplate(null);
      loadTemplates();
    }
  }, [isOpen, selectedWorkspaceId, workspaces, loadTemplates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === 'template') {
      if (!selectedTemplate) {
        setErrorMessage("Please select a template.");
        return;
      }
      
      if (!workspaceId) {
        setErrorMessage("Please select a workspace.");
        return;
      }
      
      setErrorMessage(null);
      setCreating(true);

      try {
        if (onCreateFromTemplate) {
          await onCreateFromTemplate(selectedTemplate.id, workspaceId, baseName || undefined);
        }
        
        // Reset form
        setBaseName("");
        setBaseDescription("");
        setWorkspaceId(defaultWorkspaceId);
        setSelectedTemplate(null);
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong creating the database from template.";
        setErrorMessage(message);
      } finally {
        setCreating(false);
      }
    } else {
      if (!baseName.trim()) {
        setErrorMessage("Please provide a name.");
        return;
      }
      
      if (!workspaceId) {
        setErrorMessage("Please select a workspace.");
        return;
      }
      
      setErrorMessage(null);
      setCreating(true);

      try {
        await onCreate({
          name: baseName,
          description: baseDescription,
          workspaceId: workspaceId
        });
        
        // Reset form
        setBaseName("");
        setBaseDescription("");
        setWorkspaceId(defaultWorkspaceId);
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong creating the database.";
        setErrorMessage(message);
      } finally {
        setCreating(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => !creating && onClose()} />
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create database</h3>
          <p className="text-sm text-gray-600">Start from scratch or use a template</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('blank')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'blank'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            disabled={creating}
          >
            Create Blank
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'template'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            disabled={creating}
          >
            Use Template
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'blank' && (
            <>
              {activeView === 'home' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Workspace</label>
                  <select
                    value={workspaceId}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={creating || workspaces.length <= 1}
                    required
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {activeView === 'workspace' && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                    <span className="text-sm font-medium text-blue-900">
                      Creating in: {workspaces.find(w => w.id === selectedWorkspaceId)?.name}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder="e.g., Customer Data Management"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creating}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
                <textarea
                  value={baseDescription}
                  onChange={(e) => setBaseDescription(e.target.value)}
                  placeholder="Describe this database"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  disabled={creating}
                />
              </div>
            </>
          )}

          {activeTab === 'template' && (
            <>
              {activeView === 'home' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Workspace</label>
                  <select
                    value={workspaceId}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={creating || workspaces.length <= 1}
                    required
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {activeView === 'workspace' && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                    <span className="text-sm font-medium text-blue-900">
                      Creating in: {workspaces.find(w => w.id === selectedWorkspaceId)?.name}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Select Template</label>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">No templates available</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {templates.map((template) => {
                      const IconComponent = template.icon ? ICON_MAP[template.icon] : Sparkles;
                      const isSelected = selectedTemplate?.id === template.id;
                      const stats = TemplateService.getTemplateStats(template);
                      
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplate(template)}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          disabled={creating}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            {IconComponent && (
                              <IconComponent className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">{template.name}</div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                            {template.description || 'No description'}
                          </p>
                          <div className="flex gap-2 text-xs text-gray-500">
                            <span>{stats.tableCount} tables</span>
                            <span>{stats.fieldCount} fields</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Base Name (optional)</label>
                <input
                  type="text"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder={selectedTemplate ? `Leave empty to use "${selectedTemplate.name}"` : "Custom name for your base"}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creating}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If left empty, the template name will be used
                </p>
              </div>
            </>
          )}
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </form>

        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
          {onImport && selectedWorkspaceId && activeTab === 'blank' && (
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={() => {
                onClose();
                onImport();
              }}
              disabled={creating}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Base
            </button>
          )}
          <div className={`flex justify-end gap-3 ${onImport && selectedWorkspaceId && activeTab === 'blank' ? 'ml-auto' : 'w-full'}`}>
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              onClick={() => !creating && onClose()}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={creating || (activeTab === 'template' && !selectedTemplate)}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
