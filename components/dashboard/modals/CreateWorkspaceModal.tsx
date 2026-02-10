import { useState } from "react";
import type { CreateWorkspaceFormData } from "@/lib/types/dashboard";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateWorkspaceFormData) => Promise<void>;
}

export const CreateWorkspaceModal = ({ isOpen, onClose, onCreate }: CreateWorkspaceModalProps) => {
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    
    setCreating(true);
    try {
      await onCreate({ name: workspaceName });
      setWorkspaceName("");
      onClose();
    } catch (err) {
      console.error('Error creating workspace:', err);
      // Error is already handled by the parent component
      // We just need to ensure the modal stays open
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => !creating && onClose()} />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">New workspace</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Workspace name</label>
            <input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., My First Workspace"
              disabled={creating}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              className="rounded-md border px-3 py-2 text-gray-700" 
              onClick={() => onClose()} 
              disabled={creating}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-60" 
              disabled={creating || !workspaceName.trim()}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
