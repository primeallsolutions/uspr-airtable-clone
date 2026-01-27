"use client";

import { useState, useEffect, useRef } from "react";
import { X, Folder } from "lucide-react";

interface RenameFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
  currentPath?: string;
}

export const RenameFolderModal = ({
  isOpen,
  onClose,
  onRename,
  currentName,
  currentPath = "",
}: RenameFolderModalProps) => {
  const [folderName, setFolderName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName(currentName);
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentName]);

  const validateFolderName = (name: string): string | null => {
    const trimmed = name.trim();
    
    if (!trimmed) {
      return "Folder name is required";
    }
    
    if (trimmed.length > 255) {
      return "Folder name must be 255 characters or less";
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmed)) {
      return "Folder name contains invalid characters";
    }
    
    // Check for reserved names (Windows)
    const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
    if (reservedNames.includes(trimmed.toUpperCase())) {
      return "Folder name is reserved and cannot be used";
    }
    
    // Check for dots at start/end
    if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
      return "Folder name cannot start or end with a dot";
    }
    
    // Check for spaces at start/end
    if (name !== trimmed) {
      return "Folder name cannot start or end with spaces";
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (folderName.trim() === currentName) {
      onClose();
      return;
    }
    
    const validationError = validateFolderName(folderName);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsRenaming(true);
    setError(null);
    
    try {
      await onRename(folderName.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename folder");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => !isRenaming && onClose()}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Folder className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Rename Folder</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isRenaming}
            className="p-2 hover:bg-gray-100 rounded-md disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {currentPath && (
              <div className="mb-4 text-sm text-gray-600">
                <span className="font-medium">Location:</span> {currentPath || "Root"}
              </div>
            )}
            <div className="mb-4">
              <label htmlFor="folder-name" className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name
              </label>
              <input
                id="folder-name"
                ref={inputRef}
                type="text"
                value={folderName}
                onChange={(e) => {
                  setFolderName(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  error ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Enter folder name"
                disabled={isRenaming}
                maxLength={255}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Folder names cannot contain: &lt; &gt; : &quot; / \ | ? * or control characters
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isRenaming}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRenaming || !folderName.trim() || folderName.trim() === currentName}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRenaming ? "Renaming..." : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};















