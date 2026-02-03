import { useState } from "react";
import { Menu, Grid, Kanban, Plus, Search, X } from "lucide-react";
import type { ViewMode } from "@/lib/types/base-detail";

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateNew: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar = ({
  viewMode,
  onViewModeChange,
  onCreateNew,
  isMobileOpen = false,
  onMobileClose = () => {}
}: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      <aside className={`w-64 h-screen flex flex-col bg-white border-r border-gray-200 fixed top-0 left-0 z-50 transition-transform overflow-hidden ${
        isMobileOpen ? '!translate-x-0' : '!-translate-x-full md:!translate-x-0'
      }`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileClose}
            className="p-1 hover:bg-gray-100 rounded md:hidden"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Create New */}
      {!isCollapsed && (
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Create new table</span>
          </button>
        </div>
      )}

      {/* View Types */}
      <div className="flex-shrink-0 p-4">
        {!isCollapsed && (
          <div className="space-y-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Grid size={16} />
              <span>Grid view</span>
            </button>
            <button
              onClick={() => onViewModeChange('kanban')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'kanban' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Kanban size={16} />
              <span>Kanban</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Icons */}
      {/* <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <HelpCircle size={20} className="text-gray-400" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} className="text-gray-400" />
        </button>
        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">1</span>
        </div>
      </div> */}
      </aside>
    </>
  );
};
