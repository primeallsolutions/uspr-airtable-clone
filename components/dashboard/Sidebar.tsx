import { Home as HomeIcon, Star, Share2, ChevronDown, Plus, Edit3, Trash2, Check, X } from "lucide-react";
import type { ActiveView, WorkspaceRecord } from "@/lib/types/dashboard";

interface SidebarProps {
  activeView: ActiveView;
  selectedWorkspaceId: string | null;
  workspaces: WorkspaceRecord[];
  sharedWorkspaces?: Array<WorkspaceRecord & { owner_name?: string | null }>;
  workspacesCollapsed: boolean;
  editingWorkspaceId: string | null;
  editingWorkspaceName: string;
  onViewChange: (view: ActiveView) => void;
  onWorkspaceSelect: (workspaceId: string) => void;
  onWorkspacesToggle: () => void;
  onCreateWorkspace: () => void;
  onCreateBase: () => void;
  onEditWorkspace: (id: string, name: string) => void;
  onStartEditingWorkspace: (id: string, name: string) => void;
  onCancelEditingWorkspace: () => void;
  onDeleteWorkspace: (workspace: {id: string, name: string}) => void;
  setEditingWorkspaceName: (name: string) => void;
}

export const Sidebar = ({
  activeView,
  selectedWorkspaceId,
  workspaces,
  sharedWorkspaces = [],
  workspacesCollapsed,
  editingWorkspaceId,
  editingWorkspaceName,
  onViewChange,
  onWorkspaceSelect,
  onWorkspacesToggle,
  onCreateWorkspace,
  onCreateBase,
  onEditWorkspace,
  onStartEditingWorkspace,
  onCancelEditingWorkspace,
  onDeleteWorkspace,
  setEditingWorkspaceName
}: SidebarProps) => {
  const dotColors = ["bg-blue-600", "bg-gray-400", "bg-purple-600", "bg-green-600", "bg-amber-500"];

  return (
    <aside className="hidden w-64 flex-col border-r bg-white md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white">US</div>
        <div className="text-base font-semibold text-gray-900">Prime Database</div>
      </div>
      
      <nav className="px-2 py-2">
        <button 
          onClick={() => onViewChange('home')} 
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
            activeView === 'home' 
              ? 'bg-blue-100 text-blue-700 font-medium' 
              : 'text-gray-900 hover:bg-gray-100'
          }`}
        >
          <HomeIcon size={18} />
          <span>Home</span>
        </button>
        
        <button 
          onClick={() => onViewChange('starred')}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
            activeView === 'starred'
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Star size={18} />
          <span>Starred</span>
        </button>
        
        <button
          /* TODO: Add onClick attribute when "Shared" page is created */
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 ${
            activeView === 'shared'
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-400' // Currently disabled; enabled state: 'text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Share2 size={18} />
          <span>Shared</span>
        </button>
      </nav>
      
      <div className="mt-2 flex items-center justify-between px-4 text-xs font-medium uppercase tracking-wide text-gray-500">
        <button className="flex items-center gap-2" onClick={onWorkspacesToggle}>
          <span className={`transition-transform ${workspacesCollapsed ? '-rotate-90' : ''}`}>
            <ChevronDown size={16} />
          </span>
          <span>Workspaces</span>
        </button>
        <button className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={onCreateWorkspace}>
          <Plus size={14} />
        </button>
      </div>
      
      {!workspacesCollapsed && (
        <div className="space-y-1 px-2 py-2">
          {workspaces.length === 0 ? (
            <div className="px-2 py-2 text-sm text-gray-500">No workspaces</div>
          ) : (
            workspaces.map((workspace, idx) => {
              const color = dotColors[idx % dotColors.length];
              return (
                <div key={workspace.id} className="group relative">
                  {editingWorkspaceId === workspace.id ? (
                    <div className="flex items-center gap-1 px-2 py-2">
                      <span className={`inline-block h-3.5 w-3.5 rounded-full ${color}`}></span>
                      <input
                        type="text"
                        value={editingWorkspaceName}
                        onChange={(e) => setEditingWorkspaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onEditWorkspace(workspace.id, editingWorkspaceName);
                          }
                          if (e.key === 'Escape') {
                            onCancelEditingWorkspace();
                          }
                        }}
                        className="flex-1 text-sm bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => onEditWorkspace(workspace.id, editingWorkspaceName)}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={onCancelEditingWorkspace}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
                        activeView === 'workspace' && selectedWorkspaceId === workspace.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-900 hover:bg-gray-100'
                      }`}
                      onClick={() => onWorkspaceSelect(workspace.id)}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full ${color}`}></span>
                      <span className="truncate">{workspace.name}</span>
                    </button>
                  )}
                  
                  {/* Workspace Actions */}
                  {editingWorkspaceId !== workspace.id && (
                    <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-opacity ${
                      (activeView === 'workspace' && selectedWorkspaceId === workspace.id) ? 'opacity-100' : 'group-hover:opacity-100'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEditingWorkspace(workspace.id, workspace.name);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer"
                        title="Edit workspace"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWorkspace({ id: workspace.id, name: workspace.name });
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-40 cursor-pointer"
                        title="Delete workspace"
                        disabled={false /* gated by parent using menu visibility; RLS still protects */}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      
      {/* Shared Workspaces section (visible/expanded by default) */}
      {sharedWorkspaces && sharedWorkspaces.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="px-4 text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
            Shared Workspaces
          </div>
          <div className="space-y-1 px-2 py-2">
            {sharedWorkspaces.map((workspace, idx) => {
              const color = dotColors[(idx + 3) % dotColors.length];
              return (
                <button
                  key={workspace.id}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
                    activeView === 'workspace' && selectedWorkspaceId === workspace.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => onWorkspaceSelect(workspace.id)}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full ${color}`}></span>
                  <span className="truncate">{workspace.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Only show the Create button on the following views: */}
      {(activeView === 'home' || activeView === 'workspace') && (
        <div className="mt-auto px-4 pb-4">
          <button
            onClick={onCreateBase}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      )}
    </aside>
  );
};
