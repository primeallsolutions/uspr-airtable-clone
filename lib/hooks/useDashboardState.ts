import { useState, useCallback } from 'react';
import type { ActiveView, CollectionView, SortOption, BaseRecord } from '../types/dashboard';

export const useDashboardState = () => {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [collectionView, setCollectionView] = useState<CollectionView>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('lastOpened');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedBase, setSelectedBase] = useState<BaseRecord | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteBaseModalOpen, setIsDeleteBaseModalOpen] = useState(false);
  const [isDeleteWorkspaceModalOpen, setIsDeleteWorkspaceModalOpen] = useState(false);
  
  // UI states
  const [workspacesCollapsed, setWorkspacesCollapsed] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  
  // Workspace editing states
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{id: string, name: string} | null>(null);

  const switchToWorkspaceView = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setActiveView('workspace');
  }, []);

  const switchToHomeView = useCallback(() => {
    setActiveView('home');
  }, []);

  const switchToStarredView = useCallback(() => {
    setActiveView('starred');
  }, []);

  const switchToSharedView = useCallback(() => {
    setActiveView('shared');
  }, []);

  const switchToAccountView = useCallback(() => {
    setActiveView('account');
  }, []);

  const openCreateModal = useCallback(() => {
    setIsCreateOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const openRenameModal = useCallback((base: BaseRecord) => {
    setSelectedBase(base);
    setIsRenameModalOpen(true);
  }, []);

  const closeRenameModal = useCallback(() => {
    setIsRenameModalOpen(false);
    setSelectedBase(null);
  }, []);

  const openDeleteBaseModal = useCallback((base: BaseRecord) => {
    setSelectedBase(base);
    setIsDeleteBaseModalOpen(true);
  }, []);

  const closeDeleteBaseModal = useCallback(() => {
    setIsDeleteBaseModalOpen(false);
    setSelectedBase(null);
  }, []);

  const startEditingWorkspace = useCallback((workspaceId: string, currentName: string) => {
    setEditingWorkspaceId(workspaceId);
    setEditingWorkspaceName(currentName);
  }, []);

  const cancelEditingWorkspace = useCallback(() => {
    setEditingWorkspaceId(null);
    setEditingWorkspaceName('');
  }, []);

  const openDeleteWorkspaceModal = useCallback((workspace: {id: string, name: string}) => {
    setWorkspaceToDelete(workspace);
    setIsDeleteWorkspaceModalOpen(true);
  }, []);

  const closeDeleteWorkspaceModal = useCallback(() => {
    setIsDeleteWorkspaceModalOpen(false);
    setWorkspaceToDelete(null);
  }, []);

  return {
    // View states
    activeView,
    collectionView,
    sortOption,
    selectedWorkspaceId,
    selectedBase,
    showBanner,
    
    // Modal states
    isCreateOpen,
    isCreateWorkspaceOpen,
    isRenameModalOpen,
    isDeleteBaseModalOpen,
    isDeleteWorkspaceModalOpen,
    
    // UI states
    workspacesCollapsed,
    isSortOpen,
    
    // Workspace editing states
    editingWorkspaceId,
    editingWorkspaceName,
    workspaceToDelete,
    
    // Setters
    setActiveView,
    setCollectionView,
    setSortOption,
    setSelectedWorkspaceId,
    setSelectedBase,
    setShowBanner,
    setIsCreateOpen,
    setIsCreateWorkspaceOpen,
    setIsRenameModalOpen,
    setIsDeleteBaseModalOpen,
    setIsDeleteWorkspaceModalOpen,
    setWorkspacesCollapsed,
    setIsSortOpen,
    setEditingWorkspaceId,
    setEditingWorkspaceName,
    setWorkspaceToDelete,
    
    // Helper methods
    switchToWorkspaceView,
    switchToHomeView,
    switchToStarredView,
    switchToSharedView,
    switchToAccountView,
    openCreateModal,
    closeCreateModal,
    openRenameModal,
    closeRenameModal,
    openDeleteBaseModal,
    closeDeleteBaseModal,
    startEditingWorkspace,
    cancelEditingWorkspace,
    openDeleteWorkspaceModal,
    closeDeleteWorkspaceModal,
  };
};
