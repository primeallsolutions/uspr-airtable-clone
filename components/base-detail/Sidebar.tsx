import { useState } from "react";
import { Menu, Grid, Kanban, Plus, Search } from "lucide-react";
import type { ViewMode } from "@/lib/types/base-detail";

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateNew: () => void;
}

export const Sidebar = ({
  viewMode,
  onViewModeChange,
  onCreateNew
}: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Menu size={20} />
          </button>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Grid size={20} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Grid view</span>
            </div>
          )}
        </div>
      </div>

      {/* Create New */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Create new...</span>
          </button>
        </div>
      )}

      {/* Search */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Q Find a view"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* View Types */}
      <div className="p-4">
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
    </div>
  );
};
