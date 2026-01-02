import { useState, useEffect } from "react";
import type { ActiveView, WorkspaceRecord, CreateBaseFormData } from "@/lib/types/dashboard";

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateBaseFormData) => Promise<void>;
  activeView: ActiveView;
  selectedWorkspaceId: string | null;
  workspaces: WorkspaceRecord[];
  onImport?: () => void;
}

export const CreateBaseModal = ({ 
  isOpen, 
  onClose, 
  onCreate, 
  activeView, 
  selectedWorkspaceId, 
  workspaces,
  onImport
}: CreateBaseModalProps) => {
  // Initialize with the selected workspace or the first available workspace
  const defaultWorkspaceId = selectedWorkspaceId || workspaces[0]?.id || "";
  
  const [baseName, setBaseName] = useState("");
  const [baseDescription, setBaseDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update workspace ID when the modal opens or selected workspace changes
  useEffect(() => {
    if (isOpen) {
      const newDefaultWorkspaceId = selectedWorkspaceId || workspaces[0]?.id || "";
      setWorkspaceId(newDefaultWorkspaceId);
    }
  }, [isOpen, selectedWorkspaceId, workspaces]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseName.trim()) {
      setErrorMessage("Please provide a name.");
      return;
    }
    
    if (!workspaceId) {
      setErrorMessage("Please select a workspace.");
      return;
    }
    
    setErrorMessage(null);
    setCreating(true);

    try {
      await onCreate({
        name: baseName,
        description: baseDescription,
        workspaceId: workspaceId
      });
      
      // Reset form
      setBaseName("");
      setBaseDescription("");
      setWorkspaceId(defaultWorkspaceId);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong creating the database.";
      setErrorMessage(message);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => !creating && onClose()} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create database</h3>
          <p className="text-sm text-gray-600">Similar to creating a new base in Airtable.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeView === 'home' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Workspace</label>
              <select
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating || workspaces.length <= 1}
                required
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          {activeView === 'workspace' && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                <span className="text-sm font-medium text-blue-900">
                  Creating in: {workspaces.find(w => w.id === selectedWorkspaceId)?.name}
                </span>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="e.g., Customer Data Management"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
            <textarea
              value={baseDescription}
              onChange={(e) => setBaseDescription(e.target.value)}
              placeholder="Describe this database"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              disabled={creating}
            />
          </div>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <div className="flex justify-between items-center pt-2">
            {onImport && selectedWorkspaceId && (
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  onClose();
                  onImport();
                }}
                disabled={creating}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Base
              </button>
            )}
            <div className="flex justify-end gap-3 ml-auto">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => !creating && onClose()}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
