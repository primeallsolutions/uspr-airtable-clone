import type { BaseRecord, SortOption } from '../types/dashboard';

export const getSortLabel = (option: SortOption): string => {
  switch (option) {
    case 'lastOpened':
      return 'Last opened';
    case 'alphabetical':
      return 'Alphabetical';
    case 'oldestToNewest':
      return 'Oldest to newest';
    case 'newestToOldest':
      return 'Newest to oldest';
    default:
      return 'Last opened';
  }
};

export const sortBases = <T extends BaseRecord>(list: T[], sortOption: SortOption): T[] => {
  const copy = [...list];
  switch (sortOption) {
    case 'alphabetical':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'oldestToNewest':
      return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case 'newestToOldest':
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'lastOpened':
    default:
      return copy.sort((a, b) => {
        const aRef = a.last_opened_at ?? a.created_at;
        const bRef = b.last_opened_at ?? b.created_at;
        return new Date(bRef).getTime() - new Date(aRef).getTime();
      });
  }
};
