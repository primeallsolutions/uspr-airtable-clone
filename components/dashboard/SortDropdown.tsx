import { ChevronDown } from "lucide-react";
import { getSortLabel } from "@/lib/utils/sort-helpers";
import type { SortOption } from "@/lib/types/dashboard";

interface SortDropdownProps {
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const sortOptions: SortOption[] = ['lastOpened', 'alphabetical', 'oldestToNewest', 'newestToOldest'];

export const SortDropdown = ({ sortOption, setSortOption, isOpen, setIsOpen }: SortDropdownProps) => {
  const handleOptionSelect = (option: SortOption) => {
    setSortOption(option);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {getSortLabel(sortOption)} <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {sortOptions.map(option => (
            <button
              key={option}
              onClick={() => handleOptionSelect(option)}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                sortOption === option ? 'text-gray-900' : 'text-gray-700'
              }`}
            >
              <span>{getSortLabel(option)}</span>
              {sortOption === option && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
