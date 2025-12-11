import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Zap, Crown, Edit, Trash2, ArrowLeft } from "lucide-react";
import type { BaseRow, TableRow, TopTab } from "@/lib/types/base-detail";
import { GHLSyncStatus } from "./GHLSyncStatus";

interface TopNavigationProps {
  base: BaseRow | null;
  tables: TableRow[];
  selectedTableId: string | null;
  topTab: TopTab;
  onTableSelect: (tableId: string) => void;
  onTabChange: (tab: TopTab) => void;
  onBaseContextMenu: (e: React.MouseEvent) => void;
  onCreateTable: () => void;
  onToggleMasterList: (tableId: string) => void;
  onRenameTable: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
  canDeleteTable?: boolean;
  onExportBase?: () => void;
  showInterfacesTab?: boolean;
  showFormsTab?: boolean;
  baseId?: string;
  onConnectGHL?: () => void;
}

export const TopNavigation = ({
  base,
  tables,
  selectedTableId,
  topTab,
  onTableSelect,
  onTabChange,
  onBaseContextMenu,
  onCreateTable,
  onToggleMasterList,
  onRenameTable,
  onDeleteTable,
  canDeleteTable = true,
  onExportBase,
  showInterfacesTab = true,
  showFormsTab = true,
  baseId,
  onConnectGHL
}: TopNavigationProps) => {
  const router = useRouter();
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    tableId: string;
    x: number;
    y: number;
  } | null>(null);

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

  const tabs: { id: TopTab; label: string }[] = [
    { id: 'data', label: 'Data' },
    { id: 'automations', label: 'Automations' },
  ];

  if (showInterfacesTab) {
    tabs.push({ id: 'interfaces', label: 'Interfaces' });
  }
  if (showFormsTab) {
    tabs.push({ id: 'forms', label: 'Forms' });
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Back button */}
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          
          {/* Logo and Base name */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap size={20} className="text-white" />
              </div>
              <button
                type="button"
                onClick={onBaseContextMenu}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {base?.name || 'Customer Data Management'}
              </button>
            </div>
          </div>

          {/* Table selector */}
          <div className="relative">

            {isTableDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-2">
                  {tables.map((table) => {
                    const hasMasterList = tables.some(t => t.is_master_list);
                    
                    return (
                      <div key={table.id} className="flex items-center gap-2 group">
                        <button
                          type="button"
                          onClick={() => {
                            onTableSelect(table.id);
                            setIsTableDropdownOpen(false);
                          }}
                          onContextMenu={(e) => handleTableContextMenu(e, table.id)}
                          className={`flex-1 text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors ${
                            selectedTableId === table.id ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{table.name}</span>
                            {table.is_master_list && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                Master
                              </span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1">
                          {/* Only show crown button if there's no master list in the base */}
                          {!hasMasterList && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleMasterList(table.id);
                                setIsTableDropdownOpen(false);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-yellow-100 rounded transition-all text-yellow-600"
                              title="Make master list"
                            >
                              <Crown size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTableContextMenu(e, table.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                            title="Table options"
                          >
                            <MoreVertical size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onCreateTable();
                        setIsTableDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      + Create new table
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* GHL Integration */}
          {baseId && (
            <GHLSyncStatus 
              baseId={baseId} 
              onOpenSettings={onConnectGHL}
              showConnectButton={onConnectGHL !== undefined}
            />
          )}

          {onExportBase && (
            <button
              type="button"
              onClick={onExportBase}
              className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              title="Export base"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-t border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              topTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
