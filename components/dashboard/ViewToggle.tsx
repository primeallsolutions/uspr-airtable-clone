import { Grid3X3, List } from "lucide-react";
import type { CollectionView } from "@/lib/types/dashboard";

interface ViewToggleProps {
  collectionView: CollectionView;
  setCollectionView: (view: CollectionView) => void;
}

export const ViewToggle = ({ collectionView, setCollectionView }: ViewToggleProps) => {
  return (
    <div className="hidden items-center gap-2 md:flex rounded-lg bg-gray-200 p-1">
      <button 
        onClick={() => setCollectionView('grid')} 
        className={`rounded-md px-2 py-1 ${
          collectionView === 'grid' 
            ? 'bg-gray-100 text-gray-900' 
            : 'text-gray-500 hover:bg-gray-100 cursor-pointer'
        }`}
      >
        <Grid3X3 size={18} />
      </button>
      <button 
        onClick={() => setCollectionView('list')} 
        className={`rounded-md px-2 py-1 ${
          collectionView === 'list' 
            ? 'bg-gray-100 text-gray-900' 
            : 'text-gray-500 hover:bg-gray-100 cursor-pointer'
        }`}
      >
        <List size={18} />
      </button>
    </div>
  );
};
