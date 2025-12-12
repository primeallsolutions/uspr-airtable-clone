import { Star } from "lucide-react";
import { BaseTile } from "../BaseTile";
import { BaseRow } from "../BaseRow";
import { EmptyState } from "../EmptyState";
import { ViewToggle } from "../ViewToggle";
import type { BaseRecord, CollectionView } from "@/lib/types/dashboard";

interface StarredViewProps {
  starredBases: BaseRecord[];
  collectionView: CollectionView;
  onCollectionViewChange: (view: CollectionView) => void;
  onBaseStarToggle?: (base: BaseRecord) => void;
  onBaseContextMenu: (e: React.MouseEvent, base: BaseRecord) => void;
}

export const StarredView = ({
  starredBases,
  collectionView,
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
          {starredBases.length === 0 ? (
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
          {starredBases.length === 0 ? (
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
