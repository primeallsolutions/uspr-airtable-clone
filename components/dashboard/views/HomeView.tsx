import { Plus } from "lucide-react";
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
  initialLoad?: boolean;
  onCollectionViewChange: (view: CollectionView) => void;
  onSortOptionChange: (option: SortOption) => void;
  onSortToggle: (open: boolean) => void;
  onCreateBase: () => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
  searchQuery?: string;
}

export const HomeView = ({
  recentBases,
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
  searchQuery
}: HomeViewProps) => {
  // Split bases by today/earlier
  const today = recentBases.filter((b) => {
    const ref = b.last_opened_at ?? b.created_at;
    return isToday(ref) && (!searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });
  const earlier = recentBases.filter((b) => {
    const ref = b.last_opened_at ?? b.created_at;
    return !isToday(ref) && (!searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  if (loading && !initialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-xl md:text-2xl font-bold text-gray-900">Home</h1>
      <div className="mb-6 flex sm:flex-row items-stretch sm:items-center justify-between gap-2">
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

      <div className="space-y-6 md:space-y-8">
        {/* Today */}
        {today.length > 0 && (
          <div>
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Today</h2>
            <div className={collectionView === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'
              : 'space-y-2 md:space-y-3'
            }>
              {sortBases(today, sortOption).map(
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
        )}

        {/* Earlier */}
        {earlier.length > 0 && (
          <div>
            {today.length > 0 && <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Earlier</h2>}
            <div className={collectionView === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'
              : 'space-y-2 md:space-y-3'
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
        )}

        {today.length === 0 && earlier.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 md:p-6 text-sm text-gray-500 w-full sm:w-2/3">
            No bases found in this workspace.
            <button
              onClick={onCreateBase}
              className="flex items-center mt-3 gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer min-h-10"
            >
              <Plus size={16} />
              Create your first base
            </button>
          </div>
        )}
      </div>
    </>
  );
};
