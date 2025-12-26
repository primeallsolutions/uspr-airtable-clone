import { Star } from "lucide-react";
import { BaseTile } from "../BaseTile";
import { BaseRow } from "../BaseRow";
import { EmptyState } from "../EmptyState";
import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import type { BaseRecord, CollectionView, SortOption } from "@/lib/types/dashboard";

interface SharedViewProps {
  sharedBases: BaseRecord[];
  collectionView: CollectionView;
  sortOption: SortOption;
  isSortOpen: boolean;
  onCollectionViewChange: (view: CollectionView) => void;
  onSortOptionChange: (option: SortOption) => void;
  onSortToggle: (open: boolean) => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
}

export const SharedView = ({
  sharedBases,
  collectionView,
  sortOption,
  isSortOpen,
  onCollectionViewChange,
  onSortOptionChange,
  onSortToggle,
  onBaseStarToggle,
  onBaseContextMenu
}: SharedViewProps) => {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Shared</h1>
      <div className="mb-6 flex items-center justify-between">
        <SortDropdown
          sortOption={sortOption}
          setSortOption={onSortOptionChange}
          isOpen={isSortOpen}
          setIsOpen={onSortToggle}
        />
        <ViewToggle
          collectionView={collectionView}
          setCollectionView={onCollectionViewChange}
        />
      </div>
      
      {collectionView === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sharedBases.length === 0 ? (
            <EmptyState type="shared" />
          ) : (
            sortBases(sharedBases, sortOption).map((base) => (
              <BaseTile 
                key={base.id} 
                base={base}
                onStarToggle={onBaseStarToggle}
                onContextMenu={onBaseContextMenu}
              />
            ))
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <div>Name</div>
            <div className="text-right">Last opened</div>
          </div>
          {sharedBases.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              <Star className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              No shared bases yet
            </div>
          ) : (
            sortBases(sharedBases, sortOption).map((base) => (
              <BaseRow
                key={base.id}
                base={base}
                onStarToggle={onBaseStarToggle}
                onContextMenu={onBaseContextMenu}
              />
            ))
          )}
        </div>
      )}
    </>
  );
};
