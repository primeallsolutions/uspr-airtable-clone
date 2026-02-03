import { Grid3X3, List } from "lucide-react";
import type { CollectionView } from "@/lib/types/dashboard";

interface ViewToggleProps {
  collectionView: CollectionView;
  setCollectionView: (view: CollectionView) => void;
}

export const ViewToggle = ({ collectionView, setCollectionView }: ViewToggleProps) => {
  return (
    <div className="flex items-center gap-1 md:gap-2 rounded-md bg-gray-200 p-1 md:p-1 invisible md:visible">
      <button 
        onClick={() => setCollectionView('grid')} 
        className={`rounded-md p-1 md:px-2 md:py-1 ${
          collectionView === 'grid' 
            ? 'bg-blue-200 text-gray-900' 
            : 'text-gray-500 hover:bg-blue-100 cursor-pointer'
        }`}
      >
        <Grid3X3 size={16} className="md:hidden" />
        <Grid3X3 size={18} className="hidden md:block" />
      </button>
      <button 
        onClick={() => setCollectionView('list')} 
        className={`rounded-md p-1 md:px-2 md:py-1 ${
          collectionView === 'list' 
            ? 'bg-blue-200 text-gray-900' 
            : 'text-gray-500 hover:bg-blue-100 cursor-pointer'
        }`}
      >
        <List size={16} className="md:hidden" />
        <List size={18} className="hidden md:block" />
      </button>
    </div>
  );
};
