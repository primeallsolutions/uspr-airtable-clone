import { BaseTile } from "../BaseTile";
import { BaseRow } from "../BaseRow";
import { EmptyState } from "../EmptyState";
import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import { isToday } from "@/lib/utils/date-helpers";
import type { BaseRecord, CollectionView, SortOption } from "@/lib/types/dashboard";

interface HomeViewProps {
  recentBases: BaseRecord[];
  collectionView: CollectionView;
  sortOption: SortOption;
  isSortOpen: boolean;
  onCollectionViewChange: (view: CollectionView) => void;
  onSortOptionChange: (option: SortOption) => void;
  onSortToggle: (open: boolean) => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
}

export const HomeView = ({
  recentBases,
  collectionView,
  sortOption,
  isSortOpen,
  onCollectionViewChange,
  onSortOptionChange,
  onSortToggle,
  onBaseStarToggle,
  onBaseContextMenu
}: HomeViewProps) => {
  // Split bases by today/earlier
  const today = recentBases.filter((b) => {
    const ref = b.last_opened_at ?? b.created_at;
    return isToday(ref);
  });
  const earlier = recentBases.filter((b) => {
    const ref = b.last_opened_at ?? b.created_at;
    return !isToday(ref);
  });

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Home</h1>
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
        <>
          {/* Today */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-600">Today</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {today.length === 0 ? (
                <EmptyState type="today" />
              ) : (
                today.map((base) => (
                  <BaseTile 
                    key={base.id} 
                    base={base}
                    onStarToggle={onBaseStarToggle}
                    onContextMenu={onBaseContextMenu}
                  />
                ))
              )}
            </div>
          </div>

          {/* Earlier */}
          <div className="mt-8 space-y-3">
            <div className="text-sm font-medium text-gray-600">Earlier</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {earlier.length === 0 ? (
                <EmptyState type="earlier" />
              ) : (
                sortBases(earlier, sortOption).map((base) => (
                  <BaseTile 
                    key={base.id} 
                    base={base}
                    onStarToggle={onBaseStarToggle}
                    onContextMenu={onBaseContextMenu}
                  />
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 text-sm font-medium text-gray-600">Last opened</div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <div>Name</div>
              <div className="text-right">Last opened</div>
            </div>
            {sortBases(recentBases, sortOption).map((base) => (
              <BaseRow
                key={base.id}
                base={base}
                onStarToggle={onBaseStarToggle}
                onContextMenu={onBaseContextMenu}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
};
