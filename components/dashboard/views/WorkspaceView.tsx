import { Plus } from "lucide-react";
import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import type { BaseRecord, CollectionView, SortOption, WorkspaceRecord } from "@/lib/types/dashboard";
import { useEffect, useState } from "react";
import { WorkspaceActivityCard } from "../cards/WorkspaceActivityCard";
import { WorkspaceAnalyticsDashboard } from "../WorkspaceAnalyticsDashboard";
import { BaseCard } from "../BaseCard";
import { ManageWorkspaceMembersCard } from "../cards/ManageWorkspaceMembersCard";

interface WorkspaceViewProps {
  workspaceBases: BaseRecord[];
  workspaces: WorkspaceRecord[];
  selectedWorkspaceId: string | null;
  isTransitioning: boolean;
  collectionView: CollectionView;
  sortOption: SortOption;
  isSortOpen: boolean;
  loading?: boolean;
  initialLoad?: boolean;
  onCollectionViewChange: (view: CollectionView) => void;
  onSortOptionChange: (option: SortOption) => void;
  onSortToggle: (open: boolean) => void;
  onCreateBase: () => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
  canManageMembers?: boolean;
  onLeaveWorkspace?: () => void;
  canLeaveWorkspace?: boolean;
}

export const WorkspaceView = ({
  workspaceBases,
  workspaces,
  selectedWorkspaceId,
  isTransitioning,
  collectionView,
  sortOption,
  isSortOpen,
  loading = false,
  initialLoad = false,
  onCollectionViewChange,
  onSortOptionChange,
  onSortToggle,
  onCreateBase,
  onBaseStarToggle,
  onBaseContextMenu,
  canManageMembers,
  onLeaveWorkspace,
  canLeaveWorkspace = false,
}: WorkspaceViewProps) => {
  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const [activeTab, setActiveTab] = useState<'bases' | 'analytics' | 'settings'>(
    (() => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'bases' || tab === 'analytics' || tab === 'settings') {
          if (tab === 'analytics' && !canManageMembers) {
            return 'bases';
          }
          return tab;
        }
      }
      return 'bases';
    })()
  );

  useEffect(() => {
    // Update URL with active tab
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.delete('view');
      params.set('tab', activeTab);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [activeTab]);
  useEffect(() => {
    if (!currentWorkspace) return;
    if (activeTab === 'analytics' && !(currentWorkspace.accessRole === 'owner' || currentWorkspace.accessRole === 'admin')) {
      setActiveTab('bases');
    }
  }, [currentWorkspace, activeTab, setActiveTab]);

  if (loading && !initialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">{currentWorkspace?.name || 'Workspace'}</h1>
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-8">
          {(canManageMembers ? ['analytics', 'bases', 'settings'] as const : ['bases', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {!isTransitioning && activeTab === 'bases' && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <SortDropdown
              sortOption={sortOption}
              setSortOption={onSortOptionChange}
              isOpen={isSortOpen}
              setIsOpen={onSortToggle}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={onCreateBase}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
              >
                <Plus size={16} />
                Create base
              </button>
              <ViewToggle
                collectionView={collectionView}
                setCollectionView={onCollectionViewChange}
              />
            </div>
          </div>
          <div className="space-y-8">
            <div className={collectionView === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
              : 'space-y-3'
            }>
              {sortBases(workspaceBases, sortOption).map(
                (base) => (
                  <BaseCard
                    key={base.id}
                    base={base}
                    view={collectionView}
                    onStarToggle={onBaseStarToggle}
                    onContextMenu={onBaseContextMenu}
                  />
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* Analytics tab, only visible to admins */}
      {activeTab === 'analytics' && canManageMembers && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          {selectedWorkspaceId ? (
            <WorkspaceAnalyticsDashboard workspaceId={selectedWorkspaceId} />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
              Select a workspace to view analytics.
            </div>
          )}
          {selectedWorkspaceId && (
            <WorkspaceActivityCard workspaceId={selectedWorkspaceId} className="w-full" />
          )}
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="space-y-8">
          {canManageMembers && selectedWorkspaceId && (
            <ManageWorkspaceMembersCard workspaceId={selectedWorkspaceId} />
          )}
          {canLeaveWorkspace && onLeaveWorkspace ? (
            <div className="w-1/2 rounded-lg border border-gray-200 bg-white p-6 space-y-4">
              <p className="text-gray-500">You can leave this workspace if you no longer want to be a member.</p>
              <button
                onClick={onLeaveWorkspace}
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 cursor-pointer"
                title="Leave this workspace"
              >
                Leave workspace
              </button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
};
