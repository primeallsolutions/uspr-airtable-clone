import { Home as HomeIcon, Star, Share2, ChevronDown, Plus, Edit3, Trash2, Check, X, Sparkles, Megaphone } from "lucide-react";
import type { ActiveView, WorkspaceRecord } from "@/lib/types/dashboard";
import type { RoleType } from "@/lib/services/membership-service";

type SidebarWorkspace = WorkspaceRecord & {
  accessRole?: RoleType;
  owner_name?: string | null;
};

interface SidebarProps {
  activeView: ActiveView;
  selectedWorkspaceId: string | null;
  workspaces: SidebarWorkspace[];
  sharedWorkspaces?: SidebarWorkspace[];
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
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
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
  setEditingWorkspaceName,
  isMobileOpen = false,
  onMobileClose
}: SidebarProps) => {
  const workspaceList = (() => {
    const map = new Map<string, SidebarWorkspace>();
    [...workspaces, ...(sharedWorkspaces ?? [])].forEach((ws) => {
      if (ws?.id) {
        map.set(ws.id, ws);
      }
    });
    return Array.from(map.values());
  })();
  const dotColors = ["bg-blue-600", "bg-gray-400", "bg-purple-600", "bg-green-600", "bg-amber-500"];

  // Close sidebar when navigation happens on mobile
  const handleNavigate = (callback: () => void) => {
    callback();
    if (onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`w-64 h-screen flex flex-col border-r bg-white fixed top-0 left-0 z-50 transition-transform duration-300 overflow-hidden ${
        isMobileOpen ? '!translate-x-0' : '!-translate-x-full md:!translate-x-0'
      }`}>
      <div className="flex items-center gap-2 px-4 py-4 flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white">US</div>
        <div className="text-base font-semibold text-gray-900">Prime Database</div>
      </div>
      
      <nav className="px-2 py-2 flex-shrink-0">
        <button 
          onClick={() => handleNavigate(() => onViewChange('home'))} 
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
          onClick={() => handleNavigate(() => onViewChange('starred'))}
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
          onClick={() => handleNavigate(() => onViewChange('shared'))}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
            activeView === 'shared'
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Share2 size={18} />
          <span>Shared</span>
        </button>
        
        <button
          onClick={() => handleNavigate(() => onViewChange('marketing'))}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
            activeView === 'marketing'
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Megaphone size={18} />
          <span>Marketing</span>
        </button>
        
        <button
          onClick={() => handleNavigate(() => onViewChange('templates'))}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${
            activeView === 'templates'
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Sparkles size={18} />
          <span>Templates</span>
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
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 px-2 py-2">
          {workspaceList.length === 0 ? (
            <div className="px-2 py-2 text-sm text-gray-500">No workspaces</div>
          ) : (
            workspaceList.map((workspace, idx) => {
              const color = dotColors[idx % dotColors.length];
              const canManageWorkspace = workspace.accessRole === 'owner';
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
                      onClick={() => handleNavigate(() => onWorkspaceSelect(workspace.id))}
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
                          if (!canManageWorkspace) return;
                          onStartEditingWorkspace(workspace.id, workspace.name);
                        }}
                        className={`p-1 rounded ${canManageWorkspace ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
                        disabled={!canManageWorkspace}
                        title="Edit workspace"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canManageWorkspace) return;
                          onDeleteWorkspace({ id: workspace.id, name: workspace.name });
                        }}
                        className={`p-1 rounded disabled:opacity-40 ${canManageWorkspace ? 'text-gray-400 hover:text-red-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Delete workspace"
                        disabled={!canManageWorkspace}
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

      {/* Only show the Create button on the following views: */}
      {(activeView === 'home' || activeView === 'workspace') && (
        <div className="mt-auto px-4 pb-4 flex-shrink-0">
          <button
            onClick={onCreateBase}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      )}
    </aside>
    </>
  );
};
