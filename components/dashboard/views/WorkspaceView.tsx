import { Plus } from "lucide-react";
import { BaseTile } from "../BaseTile";
import { BaseRow } from "../BaseRow";
import { EmptyState } from "../EmptyState";
import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import type { BaseRecord, CollectionView, SortOption, WorkspaceRecord } from "@/lib/types/dashboard";
import { useState } from "react";
import { WorkspaceActivityModal } from "../modals/WorkspaceActivityModal";

interface WorkspaceViewProps {
  workspaceBases: BaseRecord[];
  workspaces: WorkspaceRecord[];
  selectedWorkspaceId: string | null;
  collectionView: CollectionView;
  sortOption: SortOption;
  isSortOpen: boolean;
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
  onCollectionViewChange,
  onSortOptionChange,
  onSortToggle,
  onCreateBase,
  onBaseStarToggle,
  onBaseContextMenu,
  onManageMembers,
  canManageMembers = false,
  onDeleteBaseClick
}: WorkspaceViewProps) => {
  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

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
      {collectionView === 'grid' ? (
        <>
          <div className="mb-2 text-sm text-gray-600">Last opened</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaceBases.length === 0 ? (
              <EmptyState type="workspace" onCreateBase={onCreateBase} />
            ) : (
              sortBases(workspaceBases, sortOption).map(base => (
                <BaseTile 
                  key={base.id} 
                  base={base}
                  onStarToggle={onBaseStarToggle}
                  onContextMenu={onBaseContextMenu}
                  onDeleteClick={onDeleteBaseClick}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 text-sm text-gray-600">Last opened</div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <div>Name</div>
              <div className="text-right">Last opened</div>
            </div>
            {workspaceBases.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <EmptyState type="workspace" onCreateBase={onCreateBase} />
              </div>
            ) : (
              sortBases(workspaceBases, sortOption).map(base => (
                <BaseRow
                  key={base.id}
                  base={base}
                  onStarToggle={onBaseStarToggle}
                  onContextMenu={onBaseContextMenu}
                  onDeleteClick={onDeleteBaseClick}
                />
              ))
            )}
          </div>
        </>
      )}
    </>
  );
};
