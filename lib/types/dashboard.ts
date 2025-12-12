export type SupabaseUser = {
  id: string;
  email?: string;
};

export type BaseRecord = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  last_opened_at?: string | null;
  is_starred?: boolean;
  workspace_id?: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  created_at?: string;
};

export type ActiveView = 'home' | 'workspace' | 'starred' | 'shared' | 'account';
export type CollectionView = 'grid' | 'list';
export type SortOption = 'lastOpened' | 'lastModified' | 'alphabetical' | 'oldestToNewest' | 'newestToOldest';

export type CreateBaseFormData = {
  name: string;
  description: string;
  workspaceId: string;
};

export type CreateWorkspaceFormData = {
  name: string;
};
