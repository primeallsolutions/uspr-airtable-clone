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
import { MarketingView } from "@/components/dashboard/views/MarketingView";
import { TemplatesView } from "@/components/dashboard/views/TemplatesView";
import { CreateBaseModal } from "@/components/dashboard/modals/CreateBaseModal";
import { CreateWorkspaceModal } from "@/components/dashboard/modals/CreateWorkspaceModal";
import { DeleteWorkspaceModal } from "@/components/dashboard/modals/DeleteWorkspaceModal";
import { DeleteBaseModal } from "@/components/dashboard/modals/DeleteBaseModal";
import { ImportBaseModal } from "@/components/dashboard/modals/ImportBaseModal";
import { TemplatePreviewModal } from "@/components/dashboard/modals/TemplatePreviewModal";
import { CreateTemplateModal } from "@/components/dashboard/modals/CreateTemplateModal";
import type { Template } from "@/lib/types/templates";
import { TemplateService } from "@/lib/services/dashboard-template-service";

// Utils
import { getBaseContextMenuOptions } from "@/lib/utils/context-menu-helpers";
import { useRole } from "@/lib/hooks/useRole";

// Types
import type { BaseRecord } from "@/lib/types/dashboard";
import { SharedView } from "@/components/dashboard/views/SharedView";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewFromQuery = searchParams?.get("view");
  const workspaceIdFromQuery = searchParams?.get("workspaceId");
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

  // Custom hooks
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    recentBases,
    workspaceBases,
    starredBases,
    sharedBases,
    loading: basesLoading,
    initialLoad: initialBasesLoad,
    loadRecentBases,
    loadWorkspaceBases,
    loadStarredBases,
    loadSharedBases,
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
    leaveWorkspace,
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
    switchToSharedView,
    switchToAccountView,
    switchToTemplatesView,
    switchToMarketingView,
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
  const { role, can, loading: roleLoading } = useRole({ workspaceId: selectedWorkspaceId ?? undefined });
  
  // Only show manage members button if role is definitively owner/admin (not while loading)
  const canManageMembers = !roleLoading && (role === 'owner' || role === 'admin');
  const [isImportBaseModalOpen, setIsImportBaseModalOpen] = useState(false);
  
  // Template modal states
  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [templateBaseId, setTemplateBaseId] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const handleCreateFromTemplate = useCallback(async (templateId: string, workspaceId: string, baseName?: string) => {
    const toastId = toast.loading('Creating base from template...', {
      description: 'This may take a few moments'
    });
    
    try {
      const newBaseId = await TemplateService.createBaseFromTemplate(templateId, workspaceId, baseName);
      
      // Reload bases to show the new one
      await loadRecentBases();
      if (activeView === 'workspace' && selectedWorkspaceId) {
        await loadWorkspaceBases(selectedWorkspaceId);
      }
      
      toast.success('Base created successfully!', {
        id: toastId,
        description: 'Your new base is ready to use'
      });
      
      // Navigate to the new base
      router.push(`/bases/${newBaseId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create base from template';
      toast.error('Failed to create base', {
        id: toastId,
        description: message
      });
    }
  }, [activeView, selectedWorkspaceId, loadRecentBases, loadWorkspaceBases, router]);

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

  const handleLeaveWorkspace = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    
    const confirmed = window.confirm('Are you sure you want to leave this workspace? You will lose access to all bases in this workspace.');
    if (!confirmed) return;
    
    try {
      await leaveWorkspace(selectedWorkspaceId);
      // After leaving, switch to home view
      switchToHomeView();
      setSelectedWorkspaceId(null);
      toast.success('You have left the workspace');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to leave workspace';
      toast.error(message);
    }
  }, [selectedWorkspaceId, leaveWorkspace, switchToHomeView, setSelectedWorkspaceId]);

  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    setIsTransitioning(true);
    switchToWorkspaceView(workspaceId);
    loadWorkspaceBases(workspaceId).finally(() => setIsTransitioning(false));
  }, [switchToWorkspaceView, loadWorkspaceBases]);

  const handleStarredViewSelect = useCallback(() => {
    setIsTransitioning(true);
    switchToStarredView();
    loadStarredBases().finally(() => setIsTransitioning(false));
  }, [switchToStarredView, loadStarredBases]);

  const handleSharedViewSelect = useCallback(() => {
    setIsTransitioning(true);
    switchToSharedView();
    loadSharedBases().finally(() => setIsTransitioning(false));
  }, [switchToSharedView, loadSharedBases]);

  const handleTemplatesViewSelect = useCallback(() => {
    switchToTemplatesView();
  }, [switchToTemplatesView]);

  const handleMarketingViewSelect = useCallback(() => {
    switchToMarketingView();
  }, [switchToMarketingView]);

  const handleUseTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setIsTemplatePreviewOpen(true);
  }, []);

  const handlePreviewTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setIsTemplatePreviewOpen(true);
  }, []);

  const handleCreateTemplate = useCallback(async (data: {
    name: string;
    description: string;
    category: string;
    icon: string;
    includeRecords: boolean;
  }) => {
    const toastId = toast.loading('Creating template...', {
      description: 'This may take a moment'
    });
    
    try {
      await TemplateService.createTemplateFromBase(templateBaseId, {
        name: data.name,
        description: data.description,
        category: data.category as any,
        icon: data.icon,
        includeRecords: data.includeRecords
      });
      
      toast.success('Template created successfully!', {
        id: toastId,
        description: 'Your template is now available for use'
      });
      
      setIsCreateTemplateModalOpen(false);
      hideContextMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create template';
      toast.error('Failed to create template', {
        id: toastId,
        description: message
      });
    }
  }, [templateBaseId, hideContextMenu]);

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
        onSaveAsTemplate: (base: BaseRecord) => {
          setTemplateBaseId(base.id);
          setSelectedBase(base);
          setIsCreateTemplateModalOpen(true);
        },
        onDelete: openDeleteBaseModal,
      }).filter((opt) => !(opt.id === "delete" && !can.delete))
    : [];

  // Initialize dashboard on mount
  useEffect(() => {
    if (viewFromQuery !== null) {
      switch (viewFromQuery) {
        case 'home': switchToHomeView(); break;
        case 'starred': switchToStarredView(); break;
        case 'shared': switchToSharedView(); break;
        case 'templates': switchToTemplatesView(); break;
        case 'marketing': switchToMarketingView(); break;
        case 'account': switchToAccountView(); break;
      }
      initializeDashboard();
      return;
    }
    initializeDashboard(workspaceIdFromQuery);
  }, [initializeDashboard, viewFromQuery, workspaceIdFromQuery, switchToHomeView, switchToStarredView, switchToSharedView, switchToTemplatesView, switchToMarketingView, switchToAccountView]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading Overlay */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-4 border-white-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          selectedWorkspaceId={selectedWorkspaceId}
          workspaces={workspaces}
          sharedWorkspaces={sharedWorkspaces}
          workspacesCollapsed={workspacesCollapsed}
          editingWorkspaceId={editingWorkspaceId}
          editingWorkspaceName={editingWorkspaceName}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
          onViewChange={(view) => {
            if (view === 'home') switchToHomeView();
            else if (view === 'starred') handleStarredViewSelect();
            else if (view === 'shared') handleSharedViewSelect();
            else if (view === 'marketing') handleMarketingViewSelect();
            else if (view === 'templates') handleTemplatesViewSelect();
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
        <section className="flex min-w-0 flex-1 flex-col md:ml-64">
          {/* Top Bar */}
          <TopBar 
            user={user} 
            onSignOut={signOut} 
            onOpenAccount={switchToAccountView}
            onMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            isMobileMenuOpen={isMobileSidebarOpen}
            setSearchQuery={setSearchQuery}
          />

          {/* Banner */}
          {showBanner && <Banner onClose={() => setShowBanner(false)} />}

          {/* Content */}
          <main className="px-3 md:px-6 py-4 md:py-6 flex-1 overflow-y-auto">
            {activeView === 'home' && (
              <HomeView
                recentBases={recentBases}
                collectionView={collectionView}
                sortOption={sortOption}
                isSortOpen={isSortOpen}
                loading={basesLoading}
                initialLoad={initialBasesLoad}
                onCollectionViewChange={setCollectionView}
                onSortOptionChange={setSortOption}
                onSortToggle={setIsSortOpen}
                onCreateBase={openCreateModal}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
                searchQuery={searchQuery}
              />
            )}
            
            {activeView === 'workspace' && (
              <WorkspaceView
                workspaceBases={workspaceBases}
                workspaces={workspaces}
                selectedWorkspaceId={selectedWorkspaceId}
                isTransitioning={isTransitioning}
                collectionView={collectionView}
                sortOption={sortOption}
                isSortOpen={isSortOpen}
                loading={basesLoading}
                initialLoad={initialBasesLoad}
                onCollectionViewChange={setCollectionView}
                onSortOptionChange={setSortOption}
                onSortToggle={setIsSortOpen}
                onCreateBase={openCreateModal}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
                canManageMembers={canManageMembers}
                onLeaveWorkspace={handleLeaveWorkspace}
                canLeaveWorkspace={role === 'member' || role === 'admin'}
                searchQuery={searchQuery}
              />
            )}
            
            {activeView === 'starred' && (
              <StarredView
                starredBases={starredBases}
                collectionView={collectionView}
                sortOption={sortOption}
                isSortOpen={isSortOpen}
                loading={basesLoading}
                initialLoad={initialBasesLoad}
                onCollectionViewChange={setCollectionView}
                onSortOptionChange={setSortOption}
                onSortToggle={setIsSortOpen}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
                searchQuery={searchQuery}
              />
            )}
            
            {activeView === 'shared' && (
              <SharedView
                sharedBases={sharedBases}
                collectionView={collectionView}
                sortOption={sortOption}
                isSortOpen={isSortOpen}
                loading={basesLoading}
                initialLoad={initialBasesLoad}
                onCollectionViewChange={setCollectionView}
                onSortOptionChange={setSortOption}
                onSortToggle={setIsSortOpen}
                onBaseStarToggle={toggleStar}
                onBaseContextMenu={handleBaseContextMenu}
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'marketing' && (
              <MarketingView />
            )}

            {activeView === 'templates' && (
              <TemplatesView
                onUseTemplate={handleUseTemplate}
                onPreviewTemplate={handlePreviewTemplate}
                userId={user?.id}
                collectionView={collectionView}
                onCollectionViewChange={setCollectionView}
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
            onCreateFromTemplate={handleCreateFromTemplate}
            activeView={activeView}
            selectedWorkspaceId={selectedWorkspaceId}
            workspaces={workspaces}
            onImport={() => setIsImportBaseModalOpen(true)}
            userId={user?.id}
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

          {/* Template Preview Modal */}
          <TemplatePreviewModal
            template={selectedTemplate}
            isOpen={isTemplatePreviewOpen}
            onClose={() => {
              setIsTemplatePreviewOpen(false);
              setSelectedTemplate(null);
            }}
            onUseTemplate={handleCreateFromTemplate}
            workspaces={workspaces}
          />

          {/* Create Template Modal */}
          <CreateTemplateModal
            isOpen={isCreateTemplateModalOpen}
            onClose={() => setIsCreateTemplateModalOpen(false)}
            onCreate={handleCreateTemplate}
            baseId={templateBaseId}
            baseName={selectedBase?.name}
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
