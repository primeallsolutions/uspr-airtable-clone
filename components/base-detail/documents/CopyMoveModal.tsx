import { useState, useCallback } from "react";
import { X, Copy, Move, Loader2 } from "lucide-react";
import { DocumentsService } from "@/lib/services/documents-service";
import { toast } from "sonner";
import type { StoredDocument } from "@/lib/services/documents-service";

type CopyMoveModalProps = {
  isOpen: boolean;
  onClose: () => void;
  document: (StoredDocument & { relative: string }) | null;
  folders: Array<{ name: string; path: string }>;
  baseId: string;
  tableId?: string | null;
  recordId?: string | null;
  currentFolderPath?: string;
  onSuccess?: () => void;
};

export const CopyMoveModal = ({
  isOpen,
  onClose,
  document,
  folders,
  baseId,
  tableId,
  recordId,
  currentFolderPath = "",
  onSuccess,
}: CopyMoveModalProps) => {
  const [operation, setOperation] = useState<"copy" | "move">("copy");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [newFileName, setNewFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = useCallback(() => {
    setOperation("copy");
    setSelectedFolder("");
    setNewFileName("");
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleExecute = useCallback(async () => {
    if (!document) return;

    if (!selectedFolder) {
      toast.error("Please select a destination folder");
      return;
    }

    setIsLoading(true);
    try {
      const fileName = newFileName || document.relative.split("/").pop() || document.relative;

      if (operation === "copy") {
        await DocumentsService.copyDocument({
          baseId,
          tableId,
          recordId,
          sourceRelativePath: document.path,
          targetFolderPath: selectedFolder,
          newFileName: fileName !== document.relative.split("/").pop() ? fileName : undefined,
        });
        toast.success("Document copied successfully");
      } else {
        await DocumentsService.moveDocument({
          baseId,
          tableId,
          recordId,
          sourceRelativePath: document.path,
          targetFolderPath: selectedFolder,
          newFileName: fileName !== document.relative.split("/").pop() ? fileName : undefined,
        });
        toast.success("Document moved successfully");
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error(`Failed to ${operation} document:`, error);
      toast.error(`Failed to ${operation} document`);
    } finally {
      setIsLoading(false);
    }
  }, [document, operation, selectedFolder, newFileName, baseId, tableId, recordId, onSuccess, handleClose]);

  if (!isOpen || !document) return null;

  const availableFolders = folders.filter((f) => f.path !== currentFolderPath);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {operation === "copy" ? (
              <Copy className="w-5 h-5 text-blue-600" />
            ) : (
              <Move className="w-5 h-5 text-purple-600" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {operation === "copy" ? "Copy" : "Move"} Document
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Document Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-1">Document</p>
            <p className="text-sm font-medium text-gray-900 truncate">{document.relative}</p>
          </div>

          {/* Operation Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setOperation("copy");
                setNewFileName("");
              }}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                operation === "copy"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              disabled={isLoading}
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={() => {
                setOperation("move");
                setNewFileName("");
              }}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                operation === "move"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              disabled={isLoading}
            >
              <Move className="w-4 h-4" />
              Move
            </button>
          </div>

          {/* Destination Folder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Folder
            </label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="">Select a folder...</option>
              {availableFolders.length === 0 ? (
                <option disabled>No folders available</option>
              ) : (
                availableFolders.map((folder) => (
                  <option key={folder.path} value={folder.path}>
                    {folder.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* New File Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Name (optional)
            </label>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={document.relative.split("/").pop() || "file"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to keep original name</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={isLoading || !selectedFolder}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              operation === "copy"
                ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                : "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400"
            } text-white disabled:cursor-not-allowed`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {operation === "copy" ? "Copy" : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
};