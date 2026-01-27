"use client";

import { useState, useEffect, useRef } from "react";
import { X, FileText } from "lucide-react";

interface RenameDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
}

export const RenameDocumentModal = ({
  isOpen,
  onClose,
  onRename,
  currentName,
}: RenameDocumentModalProps) => {
  const [fileName, setFileName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileName(currentName);
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        // Select filename without extension for easier editing
        const lastDot = currentName.lastIndexOf(".");
        if (lastDot > 0) {
          inputRef.current?.setSelectionRange(0, lastDot);
        } else {
          inputRef.current?.select();
        }
      }, 100);
    }
  }, [isOpen, currentName]);

  const validateFileName = (name: string): string | null => {
    const trimmed = name.trim();
    
    if (!trimmed) {
      return "File name is required";
    }
    
    if (trimmed.length > 255) {
      return "File name must be 255 characters or less";
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmed)) {
      return "File name contains invalid characters";
    }
    
    // Check for reserved names (Windows)
    const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
    const nameWithoutExt = trimmed.split(".")[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      return "File name is reserved and cannot be used";
    }
    
    // Check for dots at start/end (except extension)
    if (trimmed.startsWith(".") || (trimmed.endsWith(".") && !trimmed.match(/\.[^.]+$/))) {
      return "File name cannot start or end with a dot";
    }
    
    // Check for spaces at start/end
    if (name !== trimmed) {
      return "File name cannot start or end with spaces";
    }
    
    // Ensure there's at least a filename before extension
    const parts = trimmed.split(".");
    if (parts.length > 1 && parts[0].trim() === "") {
      return "File name must have a name before the extension";
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (fileName.trim() === currentName) {
      onClose();
      return;
    }
    
    const validationError = validateFileName(fileName);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsRenaming(true);
    setError(null);
    
    try {
      await onRename(fileName.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename document");
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
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Rename Document</h2>
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
            <div className="mb-4">
              <label htmlFor="file-name" className="block text-sm font-medium text-gray-700 mb-2">
                File Name
              </label>
              <input
                id="file-name"
                ref={inputRef}
                type="text"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  error ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Enter file name"
                disabled={isRenaming}
                maxLength={255}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                File names cannot contain: &lt; &gt; : &quot; / \ | ? * or control characters
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
              disabled={isRenaming || !fileName.trim() || fileName.trim() === currentName}
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















