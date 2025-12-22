import { useState, useRef, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Settings, 
  Eye, 
  Filter, 
  Group, 
  ArrowUpDown, 
  Palette, 
  Share2, 
  Search,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  CalendarPlus,
  CalendarX2
} from "lucide-react";
import type { TableRow } from "@/lib/types/base-detail";

export type ViewControlPanel = 'hideFields' | 'filter' | 'group' | 'sort' | 'color' | 'share';

interface TableControlsProps {
  tables: TableRow[];
  selectedTableId: string | null;
  onTableSelect: (tableId: string) => void;
  showTableTabs?: boolean;
  viewMode?: 'grid' | 'kanban'; // View mode to show appropriate controls
  onImportCsv: () => void;
  onCreateTable: () => void;
  onRenameTable: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
  onReorderTables: (reorderedTableIds: string[]) => void;
  onHideFields: (trigger: HTMLElement) => void;
  onFilter: (trigger: HTMLElement) => void;
  onGroup: (trigger: HTMLElement) => void;
  onSort: (trigger: HTMLElement) => void;
  onColor: (trigger: HTMLElement) => void;
  onShare: (trigger: HTMLElement) => void;
  onDeleteAllFields?: () => void;
  canDeleteTable?: boolean;
  viewState?: {
    hiddenFieldsCount?: number;
    filterDescription?: string | null;
    groupDescription?: string | null;
    sortDescription?: string | null;
    colorDescription?: string | null;
  };
  activePanel?: ViewControlPanel | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showCreatedAt?: boolean;
  onToggleCreatedAt?: () => void;
}

export const TableControls = ({
  tables,
  selectedTableId,
  onTableSelect,
  showTableTabs = true,
  viewMode = 'grid',
  onImportCsv,
  onCreateTable,
  onRenameTable,
  onDeleteTable,
  onReorderTables,
  onHideFields,
  onFilter,
  onGroup,
  onSort,
  onColor,
  onShare,
  onDeleteAllFields,
  canDeleteTable = true,
  viewState,
  activePanel = null,
  searchQuery,
  onSearchChange,
  showCreatedAt = false,
  onToggleCreatedAt
}: TableControlsProps) => {
  const [contextMenu, setContextMenu] = useState<{
    tableId: string;
    x: number;
    y: number;
  } | null>(null);

  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sort tables by order_index to ensure consistent display order
  const sortedTables = [...tables].sort((a, b) => a.order_index - b.order_index);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        settingsButtonRef.current &&
        !settingsMenuRef.current.contains(event.target as Node) &&
        !settingsButtonRef.current.contains(event.target as Node)
      ) {
        setSettingsMenuOpen(false);
      }
    };

    if (settingsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsMenuOpen]);

  const handleTableContextMenu = (e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      tableId,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, tableId: string) => {
    setDraggedTableId(tableId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tableId);
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTableId(null);
    setDragOverIndex(null);
    // Reset opacity for all draggable elements
    const target = e.currentTarget as HTMLElement;
    if (target) {
      target.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    if (!draggedTableId) return;

    const draggedIndex = sortedTables.findIndex(t => t.id === draggedTableId);
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedTableId(null);
      return;
    }

    // Create new array with reordered tables
    const newTables = [...sortedTables];
    const [removed] = newTables.splice(draggedIndex, 1);
    newTables.splice(dropIndex, 0, removed);

    // Extract just the IDs in the new order
    const reorderedIds = newTables.map(t => t.id);
    
    // Call the callback to update order
    onReorderTables(reorderedIds);
    
    setDraggedTableId(null);
  };

  const truncateLabel = (label?: string | null) => {
    if (!label) return null;
    return label.length > 28 ? `${label.slice(0, 25)}...` : label;
  };
  const filterLabel = truncateLabel(viewState?.filterDescription);
  const groupLabel = truncateLabel(viewState?.groupDescription);
  const sortLabel = truncateLabel(viewState?.sortDescription);
  const colorLabel = truncateLabel(viewState?.colorDescription);

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Table Tabs */}
      {showTableTabs && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 overflow-x-auto">
            {sortedTables.map((table, index) => (
              <div 
                key={table.id} 
                className="flex items-center gap-1 group relative"
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div 
                  className={`absolute left-0 w-1 h-8 bg-blue-500 rounded transition-opacity z-10 ${
                    dragOverIndex === index ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ transform: 'translateX(-8px)' }}
                />
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, table.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onTableSelect(table.id)}
                  onContextMenu={(e) => handleTableContextMenu(e, table.id)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    selectedTableId === table.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  } ${draggedTableId === table.id ? 'opacity-50' : ''}`}
                  style={{ cursor: 'grab' }}
                >
                  {table.name}
                  {selectedTableId === table.id && (
                    <ChevronRight size={14} className="text-blue-700" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTableContextMenu(e, table.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                  title="Table options"
                  style={{ cursor: 'pointer' }}
                >
                  <MoreVertical size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onCreateTable}
              className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Create new table"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Table Navigation */}
          <div className="flex items-center gap-2">
            <button type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={16} className="text-gray-400" />
            </button>
            <button type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight size={16} className="text-gray-400" />
            </button>
            <button
              type="button"
              onClick={onImportCsv}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Import CSV"
            >
              <Upload size={16} className="text-gray-400" />
            </button>
            <div className="relative">
              <button
                ref={settingsButtonRef}
                type="button"
                onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings size={16} className="text-gray-400" />
              </button>
              {settingsMenuOpen && onDeleteAllFields && (
                <>
                  {/* Backdrop to close menu */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setSettingsMenuOpen(false)}
                  />
                  <div
                    ref={settingsMenuRef}
                    className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50"
                  >
                    <button
                      type="button"
                      onClick={onToggleCreatedAt}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors text-left"
                    >
                      {showCreatedAt ? (
                        <>
                          <CalendarX2 size={14} className="text-gray-600" />
                          <span>Hide Record Creation Dates</span>
                        </>
                      ) : (
                        <>
                          <CalendarPlus size={14} />
                          <span>Show Record Creation Dates</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteAllFields();
                        setSettingsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <Trash2 size={14} />
                      <span>Delete All Fields</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Controls */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Hide Fields - Grid only */}
          {viewMode === 'grid' && (
            <button
              type="button"
              onClick={(e) => onHideFields(e.currentTarget as HTMLElement)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                activePanel === 'hideFields'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye size={16} />
              <div className="flex items-center gap-2">
                <span>Hide fields</span>
                {viewState?.hiddenFieldsCount ? (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {viewState.hiddenFieldsCount}
                  </span>
                ) : null}
              </div>
            </button>
          )}
          
          {/* Filter - Shared */}
          <button
            type="button"
            onClick={(e) => onFilter(e.currentTarget as HTMLElement)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              activePanel === 'filter'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Filter size={16} />
            <div className="flex flex-col leading-tight text-left">
              <span>Filter</span>
              {filterLabel && (
                <span className="text-xs text-blue-600">
                  {filterLabel}
                </span>
              )}
            </div>
          </button>
          
          {/* Group - Grid only */}
          {viewMode === 'grid' && (
            <button
              type="button"
              onClick={(e) => onGroup(e.currentTarget as HTMLElement)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                activePanel === 'group'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Group size={16} />
              <div className="flex flex-col leading-tight text-left">
                <span>Group</span>
                {groupLabel && (
                  <span className="text-xs text-blue-600">
                    {groupLabel}
                  </span>
                )}
              </div>
            </button>
          )}
          
          {/* Sort - Shared */}
          <button
            type="button"
            onClick={(e) => onSort(e.currentTarget as HTMLElement)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              activePanel === 'sort'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowUpDown size={16} />
            <div className="flex flex-col leading-tight text-left">
              <span>{sortLabel ? 'Sorted' : 'Sorted by 1 field'}</span>
              {sortLabel && (
                <span className="text-xs text-blue-600">
                  {sortLabel}
                </span>
              )}
            </div>
          </button>
          
          {/* Color - Grid only */}
          {viewMode === 'grid' && (
            <button
              type="button"
              onClick={(e) => onColor(e.currentTarget as HTMLElement)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                activePanel === 'color'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Palette size={16} />
              <div className="flex flex-col leading-tight text-left">
                <span>Color</span>
                {colorLabel && (
                  <span className="text-xs text-blue-600">
                    {colorLabel}
                  </span>
                )}
              </div>
            </button>
          )}
          
          {/* Share - Shared */}
          <button
            type="button"
            onClick={(e) => onShare(e.currentTarget as HTMLElement)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              activePanel === 'share'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Share2 size={16} />
            <span>Share and sync</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={closeContextMenu}
          />
          
          {/* Context Menu */}
          <div
            className="fixed z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onRenameTable(contextMenu.tableId);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Edit size={14} />
              <span>Rename table</span>
            </button>
            {canDeleteTable && (
              <button
                type="button"
                onClick={() => {
                  onDeleteTable(contextMenu.tableId);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete table</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
