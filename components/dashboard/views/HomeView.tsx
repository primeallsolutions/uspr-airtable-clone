import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import { isToday } from "@/lib/utils/date-helpers";
import type { BaseRecord, CollectionView, SortOption } from "@/lib/types/dashboard";
import { BaseCard } from "../BaseCard";

interface HomeViewProps {
  recentBases: BaseRecord[];
  collectionView: CollectionView;
  sortOption: SortOption;
  isSortOpen: boolean;
  loading?: boolean;
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
  loading = false,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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

      <div className="space-y-8">
        {/* Today */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today</h2>
          <div className={collectionView === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
            : 'space-y-3'
          }>
            {today.map(
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

        {/* Earlier */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Earlier</h2>
          <div className={collectionView === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
            : 'space-y-3'
          }>
            {sortBases(earlier, sortOption).map(
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
