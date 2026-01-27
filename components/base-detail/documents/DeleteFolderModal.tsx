"use client";

import { useState } from "react";
import { X, AlertTriangle, Folder } from "lucide-react";

interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  folderName: string;
  folderPath: string;
  hasChildren?: boolean;
  documentCount?: number;
}

export const DeleteFolderModal = ({
  isOpen,
  onClose,
  onDelete,
  folderName,
  folderPath,
  hasChildren = false,
  documentCount = 0,
}: DeleteFolderModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      console.error("Failed to delete folder", err);
      // Error will be handled by parent component via toast
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => !isDeleting && onClose()}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Delete Folder</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 hover:bg-gray-100 rounded-md disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete the folder{" "}
              <span className="font-semibold text-gray-900">&quot;{folderName}&quot;</span>?
            </p>
            
            {(hasChildren || documentCount > 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">Warning</h4>
                    <p className="text-sm text-yellow-700">
                      {hasChildren && documentCount > 0
                        ? `This folder contains ${documentCount} document${documentCount > 1 ? "s" : ""} and subfolders.`
                        : hasChildren
                        ? "This folder contains subfolders."
                        : `This folder contains ${documentCount} document${documentCount > 1 ? "s" : ""}.`}
                      {" "}All contents will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 mb-1">This action cannot be undone</h4>
                  <p className="text-sm text-red-700">
                    The folder and all its contents will be permanently deleted from storage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Deleting...
              </span>
            ) : (
              "Delete Folder"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};















