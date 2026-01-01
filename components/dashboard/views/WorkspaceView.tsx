import { Plus } from "lucide-react";
import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import type { BaseRecord, CollectionView, SortOption, WorkspaceRecord } from "@/lib/types/dashboard";
import { useState } from "react";
import { WorkspaceActivityModal } from "../modals/WorkspaceActivityModal";
import { BaseCard } from "../BaseCard";

interface WorkspaceViewProps {
  workspaceBases: BaseRecord[];
  workspaces: WorkspaceRecord[];
  selectedWorkspaceId: string | null;
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
  onManageMembers?: () => void;
  canManageMembers?: boolean;
  onDeleteBaseClick?: (base: BaseRecord) => void;
}

export const WorkspaceView = ({
  workspaceBases,
  workspaces,
  selectedWorkspaceId,
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
  onManageMembers,
  canManageMembers = false,
}: WorkspaceViewProps) => {
  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

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
      <div className="mb-6 flex items-center justify-between">
        <SortDropdown
          sortOption={sortOption}
          setSortOption={onSortOptionChange}
          isOpen={isSortOpen}
          setIsOpen={onSortToggle}
        />
        <div className="flex items-center gap-3">
          {canManageMembers && onManageMembers && (
            <button
              onClick={onManageMembers}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Manage members
            </button>
          )}
          {selectedWorkspaceId && (
            <button
              onClick={() => setIsActivityOpen(true)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Activity
            </button>
          )}
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
      {selectedWorkspaceId && (
        <WorkspaceActivityModal
          isOpen={isActivityOpen}
          onClose={() => setIsActivityOpen(false)}
          workspaceId={selectedWorkspaceId}
        />
      )}
      <div className="space-y-8">
        <div>
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
      </div>
    </>
  );
};
