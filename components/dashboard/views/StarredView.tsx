import { SortDropdown } from "../SortDropdown";
import { ViewToggle } from "../ViewToggle";
import { sortBases } from "@/lib/utils/sort-helpers";
import type { BaseRecord, CollectionView, SortOption } from "@/lib/types/dashboard";
import { BaseCard } from "../BaseCard";

interface StarredViewProps {
  starredBases: BaseRecord[];
  collectionView: CollectionView;
  sortOption: SortOption;
  isSortOpen: boolean;
  loading?: boolean;
  initialLoad?: boolean;
  onCollectionViewChange: (view: CollectionView) => void;
  onSortOptionChange: (option: SortOption) => void;
  onSortToggle: (open: boolean) => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export const StarredView = ({
  starredBases,
  collectionView,
  sortOption,
  isSortOpen,
  loading = false,
  initialLoad = false,
  onCollectionViewChange,
  onSortOptionChange,
  onSortToggle,
  onBaseStarToggle,
  onBaseContextMenu,
  searchQuery,
  setSearchQuery
}: StarredViewProps) => {
  if (loading && !initialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-xl md:text-2xl font-bold text-gray-900">Starred</h1>
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Starred Bases</h2>
          <div className={collectionView === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'
            : 'space-y-2 md:space-y-3'
          }>
            {starredBases.filter(base => !searchQuery || base.name.toLowerCase().includes(searchQuery.toLowerCase())).length
            ? sortBases(starredBases.filter(base => !searchQuery || base.name.toLowerCase().includes(searchQuery.toLowerCase())), sortOption).map(
              (base) => (
                <BaseCard
                  key={base.id}
                  base={base}
                  view={collectionView}
                  onStarToggle={onBaseStarToggle}
                  onContextMenu={onBaseContextMenu}
                />
              )
            ) : (
              <div className="text-sm text-gray-500">You have no starred bases{starredBases.length && searchQuery ? ` matching "${searchQuery}"` : ""}.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
