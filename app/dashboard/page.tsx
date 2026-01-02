"use client";
import { Suspense, useEffect, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ContextMenu, useContextMenu } from "@/components/ui/context-menu";
import { RenameModal } from "@/components/ui/rename-modal";

// Hooks
import { useAuth } from "@/lib/hooks/useAuth";
import { useBases } from "@/lib/hooks/useBases";
import { useWorkspaces } from "@/lib/hooks/useWorkspaces";
import { useDashboardState } from "@/lib/hooks/useDashboardState";

// Components
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import AccountPage from "@/app/account/page";
import { Banner } from "@/components/dashboard/Banner";
import { HomeView } from "@/components/dashboard/views/HomeView";
import { WorkspaceView } from "@/components/dashboard/views/WorkspaceView";
import { StarredView } from "@/components/dashboard/views/StarredView";
import { CreateBaseModal } from "@/components/dashboard/modals/CreateBaseModal";
import { CreateWorkspaceModal } from "@/components/dashboard/modals/CreateWorkspaceModal";
import { DeleteWorkspaceModal } from "@/components/dashboard/modals/DeleteWorkspaceModal";
import { DeleteBaseModal } from "@/components/dashboard/modals/DeleteBaseModal";
import { ManageWorkspaceMembersModal } from "@/components/dashboard/modals/ManageWorkspaceMembersModal";
import { ImportBaseModal } from "@/components/dashboard/modals/ImportBaseModal";

// Utils
import { getBaseContextMenuOptions } from "@/lib/utils/context-menu-helpers";
import { useRole } from "@/lib/hooks/useRole";

// Types
import type { BaseRecord } from "@/lib/types/dashboard";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceIdFromQuery = searchParams?.get("workspaceId");
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

  // Custom hooks
  const { user, loading, signOut } = useAuth();
  const {
    recentBases,
    workspaceBases,
    starredBases,
    loadRecentBases,
    loadWorkspaceBases,
    loadStarredBases,
    createBase,
    renameBase,
    updateBaseDetails,
    toggleStar,
    deleteBase
  } = useBases();
  
  const {
    workspaces,
    sharedWorkspaces,
    loadWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaces();
  
  const {
    activeView,
    collectionView,
    sortOption,
    selectedWorkspaceId,
    selectedBase,
    showBanner,
    isCreateOpen,
    isCreateWorkspaceOpen,
    isRenameModalOpen,
    isDeleteBaseModalOpen,
    isDeleteWorkspaceModalOpen,
    workspacesCollapsed,
    isSortOpen,
    editingWorkspaceId,
    editingWorkspaceName,
    workspaceToDelete,
    setCollectionView,
    setSortOption,
    setSelectedWorkspaceId,
    setSelectedBase,
    setShowBanner,
    setIsCreateWorkspaceOpen,
    setWorkspacesCollapsed,
    setIsSortOpen,
    switchToWorkspaceView,
    switchToHomeView,
    switchToStarredView,
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
    setEditingWorkspaceName
  } = useDashboardState();

  // Resolve delete permission for selected workspace/base context
  const { role, can } = useRole({ workspaceId: selectedWorkspaceId ?? undefined });
  const [isManageWorkspaceMembersOpen, setIsManageWorkspaceMembersOpen] = useState(false);
  const [isImportBaseModalOpen, setIsImportBaseModalOpen] = useState(false);

  // Initialize data on component mount
  const initializeDashboard = useCallback(async (preferredWorkspaceId?: string | null) => {
    // Ensure user is present before loading data
    if (!user) return;
    const defaultWorkspaceId = await loadWorkspaces();
    const workspaceToSelect = preferredWorkspaceId ?? defaultWorkspaceId;

    if (workspaceToSelect) {
      setSelectedWorkspaceId(workspaceToSelect);
    }

    if (preferredWorkspaceId && workspaceToSelect) {
      switchToWorkspaceView(workspaceToSelect);
      await loadWorkspaceBases(workspaceToSelect);
    }
    await loadRecentBases();
  }, [user, loadWorkspaces, loadRecentBases, setSelectedWorkspaceId, switchToWorkspaceView, loadWorkspaceBases]);

  // Event handlers
  const handleBaseContextMenu = useCallback((e: React.MouseEvent, base: BaseRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedBase(base);
    showContextMenu(e);
  }, [setSelectedBase, showContextMenu]);

  const handleRenameBase = useCallback(async (newName: string) => {
    if (!selectedBase) return;
    await renameBase(selectedBase.id, newName);
  }, [selectedBase, renameBase]);

  const handleEditBase = useCallback(async (payload: { name: string; description: string }) => {
    if (!selectedBase) return;
    await updateBaseDetails(selectedBase.id, payload);
  }, [selectedBase, updateBaseDetails]);

  const handleCreateBase = useCallback(async (formData: { name: string; description: string; workspaceId: string }) => {
    await createBase(formData);
  }, [createBase]);

  const handleCreateWorkspace = useCallback(async (formData: { name: string }) => {
    try {
      const newWorkspace = await createWorkspace(formData);
      setSelectedWorkspaceId(newWorkspace.id);
      switchToWorkspaceView(newWorkspace.id);
    } catch (err: unknown) {
      // Error is already handled in createWorkspace, but we can add UI feedback here
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      if (typeof window !== 'undefined') {
        alert(message);
      }
    }
  }, [createWorkspace, setSelectedWorkspaceId, switchToWorkspaceView]);

  const handleEditWorkspace = useCallback(async (id: string, name: string) => {
    await updateWorkspace(id, name);
    cancelEditingWorkspace();
  }, [updateWorkspace, cancelEditingWorkspace]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return;
    try {
      await deleteWorkspace(workspaceToDelete.id);
      // If we're deleting the currently selected workspace, switch to home
      if (selectedWorkspaceId === workspaceToDelete.id) {
        switchToHomeView();
        setSelectedWorkspaceId(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace';
      // Avoid throwing raw objects to the runtime – surface to the user and log for devs
      console.error('Delete workspace error:', err);
      if (typeof window !== 'undefined') {
        alert(message);
      }
    } finally {
      closeDeleteWorkspaceModal();
    }
  }, [workspaceToDelete, deleteWorkspace, selectedWorkspaceId, switchToHomeView, setSelectedWorkspaceId, closeDeleteWorkspaceModal]);

  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    switchToWorkspaceView(workspaceId);
    loadWorkspaceBases(workspaceId);
  }, [switchToWorkspaceView, loadWorkspaceBases]);

  const handleStarredViewSelect = useCallback(() => {
    switchToStarredView();
    loadStarredBases();
  }, [switchToStarredView, loadStarredBases]);

  // Handle duplicate base
  const handleDuplicateBase = useCallback(async (base: BaseRecord) => {
    const toastId = toast.loading(`Duplicating "${base.name}"...`, {
      description: 'This may take a few moments'
    });
    
    try {
      const { BaseService } = await import("@/lib/services/base-service");
      const newBaseId = await BaseService.duplicateBase(base.id);
      
      // Reload bases to show the new duplicate
      await loadRecentBases();
      if (activeView === 'workspace' && selectedWorkspaceId) {
        await loadWorkspaceBases(selectedWorkspaceId);
      }
      await loadStarredBases();
      
      // Update toast to success
      toast.success(`Base duplicated successfully!`, {
        id: toastId,
        description: `"${base.name} (Copy)" has been created`
      });
      
      // Navigate to the new base
      router.push(`/bases/${newBaseId}`);
      hideContextMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate base';
      toast.error('Failed to duplicate base', {
        id: toastId,
        description: message
      });
    }
  }, [activeView, selectedWorkspaceId, loadRecentBases, loadWorkspaceBases, loadStarredBases, router, hideContextMenu]);

  const handleDeleteBaseShortcut = useCallback((base: BaseRecord) => {
    openDeleteBaseModal(base);
  }, [openDeleteBaseModal]);

  // Context menu options
  const contextMenuOptions = selectedBase
    ? getBaseContextMenuOptions(selectedBase, {
        onOpen: (baseId: string) => router.push(`/bases/${baseId}`),
        onRename: openRenameModal,
        onToggleStar: toggleStar,
        onDuplicate: handleDuplicateBase,
        onDelete: openDeleteBaseModal,
      }).filter((opt) => !(opt.id === "delete" && !can.delete))
    : [];

  // Initialize dashboard on mount
  useEffect(() => {
    initializeDashboard(workspaceIdFromQuery);
  }, [initializeDashboard, workspaceIdFromQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
          {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          selectedWorkspaceId={selectedWorkspaceId}
          workspaces={workspaces}
          sharedWorkspaces={sharedWorkspaces}
          workspacesCollapsed={workspacesCollapsed}
          editingWorkspaceId={editingWorkspaceId}
          editingWorkspaceName={editingWorkspaceName}
          onViewChange={(view) => {
            if (view === 'home') switchToHomeView();
            else if (view === 'starred') handleStarredViewSelect();
          }}
          onWorkspaceSelect={handleWorkspaceSelect}
          onWorkspacesToggle={() => setWorkspacesCollapsed(!workspacesCollapsed)}
          onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
          onCreateBase={openCreateModal}
          onEditWorkspace={handleEditWorkspace}
          onStartEditingWorkspace={startEditingWorkspace}
          onCancelEditingWorkspace={cancelEditingWorkspace}
          onDeleteWorkspace={openDeleteWorkspaceModal}
          setEditingWorkspaceName={setEditingWorkspaceName}
        />

        {/* Main Content */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar */}
          <TopBar user={user} onSignOut={signOut} onOpenAccount={switchToAccountView} />

          {/* Banner */}
          {showBanner && <Banner onClose={() => setShowBanner(false)} />}

          {/* Content */}
          <main className="px-6 py-6">
            {activeView === 'home' && (
              <HomeView
                recentBases={recentBases}
                collectionView={collectionView}
                sortOption={sortOption}
                isSortOpen={isSortOpen}
                onCollectionViewChange={setCollectionView}
                onSortOptionChange={setSortOption}
                onSortToggle={setIsSortOpen}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
              />
            )}
            
            {activeView === 'workspace' && (
              <WorkspaceView
                workspaceBases={workspaceBases}
                workspaces={workspaces}
                selectedWorkspaceId={selectedWorkspaceId}
                collectionView={collectionView}
                sortOption={sortOption}
                onCollectionViewChange={setCollectionView}
                onCreateBase={openCreateModal}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
                onManageMembers={() => setIsManageWorkspaceMembersOpen(true)}
                canManageMembers={role === 'owner' || role === 'admin'}
                onDeleteBaseClick={handleDeleteBaseShortcut}
              />
            )}
            
            {activeView === 'starred' && (
              <StarredView
                starredBases={starredBases}
                collectionView={collectionView}
                onCollectionViewChange={setCollectionView}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
              />
            )}

            {activeView === 'account' && (
              <div className="max-w-5xl">
                <AccountPage />
              </div>
            )}
          </main>

          {/* Modals */}
          <CreateBaseModal
            isOpen={isCreateOpen}
            onClose={closeCreateModal}
            onCreate={handleCreateBase}
            activeView={activeView}
            selectedWorkspaceId={selectedWorkspaceId}
            workspaces={workspaces}
            onImport={() => setIsImportBaseModalOpen(true)}
          />

          <CreateWorkspaceModal
            isOpen={isCreateWorkspaceOpen}
            onClose={() => setIsCreateWorkspaceOpen(false)}
            onCreate={handleCreateWorkspace}
          />

          {selectedWorkspaceId && (
            <ImportBaseModal
              isOpen={isImportBaseModalOpen}
              onClose={() => setIsImportBaseModalOpen(false)}
              workspaceId={selectedWorkspaceId}
              onImportComplete={(baseId) => {
                // Reload bases and navigate to the new base
                loadRecentBases();
                if (activeView === 'workspace' && selectedWorkspaceId) {
                  loadWorkspaceBases(selectedWorkspaceId);
                }
                router.push(`/bases/${baseId}`);
              }}
            />
          )}

          <DeleteWorkspaceModal
            isOpen={isDeleteWorkspaceModalOpen}
            workspace={workspaceToDelete}
            onClose={closeDeleteWorkspaceModal}
            onDelete={handleDeleteWorkspace}
            deleting={false}
          />

          {/* Manage Workspace Members */}
          {selectedWorkspaceId && (
            <ManageWorkspaceMembersModal
              isOpen={isManageWorkspaceMembersOpen}
              onClose={() => setIsManageWorkspaceMembersOpen(false)}
              workspaceId={selectedWorkspaceId}
            />
          )}

          {/* Context Menu */}
          {selectedBase && (
            <ContextMenu
              options={contextMenuOptions}
              position={contextMenu.position}
              onClose={hideContextMenu}
              isVisible={contextMenu.isVisible}
            />
          )}

          {/* Edit Base Modal */}
          <RenameModal
            isOpen={isRenameModalOpen}
            currentName={selectedBase?.name || ""}
            currentDescription={selectedBase?.description || ""}
            onClose={closeRenameModal}
            onSave={handleEditBase}
            onRename={handleRenameBase}
            title="Edit Base"
          />

          {/* Delete Base Modal */}
          <DeleteBaseModal
            isOpen={isDeleteBaseModalOpen}
            base={selectedBase}
            onClose={closeDeleteBaseModal}
            onDelete={async () => {
              if (!selectedBase) return;
              await deleteBase(selectedBase.id);
              closeDeleteBaseModal();
            }}
          />

          
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
