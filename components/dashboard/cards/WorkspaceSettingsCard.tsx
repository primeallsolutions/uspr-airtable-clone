import { ChevronDown, Edit3, Trash2 } from "lucide-react";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { WorkspaceService } from "@/lib/services/workspace-service";
import { useRole } from "@/lib/hooks/useRole";

interface WorkspaceSettingsCardProps {
  workspaceId: string;
  workspaceName: string;
  onWorkspaceDeleted?: () => void;
  onWorkspaceRenamed?: (newName: string) => void;
}

export const WorkspaceSettingsCard = ({ 
  workspaceId, 
  workspaceName,
  onWorkspaceDeleted,
  onWorkspaceRenamed
}: WorkspaceSettingsCardProps) => {
  const { role: currentUserRole, loading: roleLoading } = useRole({ workspaceId });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newName, setNewName] = useState(workspaceName);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if current user has permission to manage workspace (only owner/admin)
  const canManageWorkspace = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canDeleteWorkspace = currentUserRole === 'owner';

  const handleRename = async () => {
    if (!newName.trim() || newName === workspaceName) {
      setError("Please enter a different name");
      return;
    }

    setIsRenaming(true);
    setError(null);
    setSuccess(null);

    try {
      await WorkspaceService.updateWorkspace(workspaceId, newName);
      setSuccess("Workspace renamed successfully");
      setIsEditing(false);
      onWorkspaceRenamed?.(newName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to rename workspace");
      setNewName(workspaceName);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await WorkspaceService.deleteWorkspace(workspaceId);
      setSuccess("Workspace deleted successfully");
      onWorkspaceDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete workspace");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8">
        <div className="text-center">
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Block access if user doesn't have permission
  if (!canManageWorkspace) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Workspace Settings</h3>
        </div>
        <div className="px-6 py-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="mb-2 font-medium text-gray-700">You do not have permission to manage workspace settings.</p>
          <p className="text-sm text-gray-500">Only workspace owners and admins can access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-4/5 rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 transition-colors text-left ${isCollapsed ? 'rounded-lg' : ''} hover:bg-gray-50`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Workspace Settings</h3>
          <ChevronDown size={14} className={`text-gray-600 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {!isCollapsed && (
        <div className="space-y-4 sm:space-y-6 px-3 sm:px-6 py-3 sm:py-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">{success}</div>
          )}

          {/* Rename Section */}
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">Rename Workspace</h4>
            {!isEditing ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-sm text-gray-600">Current name: <span className="font-medium text-gray-900">{workspaceName}</span></div>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setNewName(workspaceName);
                  }}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New workspace name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleRename}
                    disabled={isRenaming || !newName.trim() || newName === workspaceName}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRenaming ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={isRenaming}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete Section */}
          {canDeleteWorkspace && (
            <div className="border-t border-gray-200 pt-4 sm:pt-6">
              <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">Delete Workspace</h4>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">
                Deleting a workspace is permanent and cannot be undone. All bases and data within this workspace will be deleted.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Workspace
                </button>
              ) : (
                <div className="border border-red-300 bg-red-50 rounded-lg p-3 sm:p-4 space-y-3">
                  <p className="text-xs sm:text-sm font-medium text-red-900 break-words">
                    Are you sure you want to delete "{workspaceName}"?
                  </p>
                  <p className="text-xs text-red-700">
                    This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
