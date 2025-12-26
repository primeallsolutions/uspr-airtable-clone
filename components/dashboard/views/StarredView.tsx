import { Star } from "lucide-react";
import { BaseTile } from "../BaseTile";
import { BaseRow } from "../BaseRow";
import { EmptyState } from "../EmptyState";
import { ViewToggle } from "../ViewToggle";
import type { BaseRecord, CollectionView } from "@/lib/types/dashboard";

// Skeleton component for grid view tiles
const SkeletonTile = () => (
  <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
    <div className="flex items-start justify-between">
      <div className="h-10 w-10 rounded-lg bg-gray-200" />
      <div className="h-5 w-5 rounded bg-gray-200" />
    </div>
    <div className="mt-3 h-5 w-3/4 rounded bg-gray-200" />
    <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
  </div>
);

// Skeleton component for list view rows
const SkeletonRow = () => (
  <div className="animate-pulse grid grid-cols-2 gap-4 border-b border-gray-100 px-4 py-3">
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded bg-gray-200" />
      <div className="h-4 w-32 rounded bg-gray-200" />
    </div>
    <div className="flex items-center justify-end">
      <div className="h-4 w-24 rounded bg-gray-200" />
    </div>
  </div>
);

interface StarredViewProps {
  starredBases: BaseRecord[];
  collectionView: CollectionView;
  loading?: boolean;
  onCollectionViewChange: (view: CollectionView) => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
}

export const StarredView = ({
  starredBases,
  collectionView,
  loading = false,
  onCollectionViewChange,
  onBaseStarToggle,
  onBaseContextMenu
}: StarredViewProps) => {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Starred</h1>
        <ViewToggle
          collectionView={collectionView}
          setCollectionView={onCollectionViewChange}
        />
      </div>
      
      {collectionView === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            <>
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
            </>
          ) : starredBases.length === 0 ? (
            <EmptyState type="starred" />
          ) : (
            starredBases.map((base) => (
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
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : starredBases.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              <Star className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              No starred bases yet
            </div>
          ) : (
            starredBases.map((base) => (
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
