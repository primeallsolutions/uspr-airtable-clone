"use client";

import { useState } from "react";
import {
  X,
  Loader2,
  FolderPlus,
  ChevronRight,
  Check,
  Building2,
  Home,
  Users,
  RefreshCw,
  Store,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import {
  AutoFolderService,
  TransactionType,
  TRANSACTION_FOLDER_TEMPLATES,
} from "@/lib/services/auto-folder-service";

type TransactionFolderSetupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  existingFolders?: string[];
  onComplete?: () => void;
};

const TYPE_ICONS: Record<TransactionType, React.FC<{ className?: string }>> = {
  buyer: Home,
  seller: Home,
  dual_agent: Users,
  refinance: RefreshCw,
  commercial: Building2,
  custom: Folder,
};

const TYPE_COLORS: Record<TransactionType, string> = {
  buyer: "bg-blue-100 text-blue-600 border-blue-200",
  seller: "bg-green-100 text-green-600 border-green-200",
  dual_agent: "bg-purple-100 text-purple-600 border-purple-200",
  refinance: "bg-orange-100 text-orange-600 border-orange-200",
  commercial: "bg-gray-100 text-gray-600 border-gray-200",
  custom: "bg-gray-100 text-gray-600 border-gray-200",
};

export const TransactionFolderSetupModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  existingFolders = [],
  onComplete,
}: TransactionFolderSetupModalProps) => {
  const [selectedType, setSelectedType] = useState<TransactionType | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const transactionTypes = AutoFolderService.getTransactionTypes();

  const handleCreate = async () => {
    if (!selectedType) return;

    try {
      setCreating(true);

      const result = await AutoFolderService.createTransactionFolders(
        baseId,
        tableId ?? null,
        selectedType,
        existingFolders
      );

      if (result.created.length > 0) {
        toast.success("Folders created successfully", {
          description: `Created ${result.created.length} folder(s)`,
        });
      } else {
        toast.info("No new folders created", {
          description: "All folders already exist",
        });
      }

      onComplete?.();
      onClose();
    } catch (error) {
      console.error("Failed to create folders:", error);
      toast.error("Failed to create folders");
    } finally {
      setCreating(false);
    }
  };

  const previewFolders = selectedType
    ? TRANSACTION_FOLDER_TEMPLATES[selectedType]
    : [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <FolderPlus className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Set Up Folder Structure
              </h2>
              <p className="text-sm text-gray-500">
                Create folders based on transaction type
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/70 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {!showPreview ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Select a transaction type to automatically create the appropriate folder structure:
              </p>

              {/* Transaction Type Grid */}
              <div className="grid grid-cols-2 gap-3">
                {transactionTypes.map((type) => {
                  const Icon = TYPE_ICONS[type.value];
                  const isSelected = selectedType === type.value;

                  return (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`p-4 border-2 rounded-xl text-left transition-all ${
                        isSelected
                          ? `${TYPE_COLORS[type.value]} border-current`
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected
                              ? TYPE_COLORS[type.value]
                              : "bg-gray-100"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{type.label}</p>
                          <p className="text-xs text-gray-500">
                            {TRANSACTION_FOLDER_TEMPLATES[type.value].length} folders
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 ml-auto text-current" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview Link */}
              {selectedType && (
                <button
                  onClick={() => setShowPreview(true)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Preview folder structure
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {/* Back Button */}
              <button
                onClick={() => setShowPreview(false)}
                className="mb-4 text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to selection
              </button>

              {/* Folder Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  Folders to be created:
                </h3>
                <div className="space-y-1">
                  {previewFolders.map((folder, index) => (
                    <div key={index}>
                      <div className="flex items-center gap-2 text-sm">
                        <Folder className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium">{folder.name}</span>
                        {existingFolders?.some(
                          (f) => f.toLowerCase() === folder.name.toLowerCase()
                        ) && (
                          <span className="text-xs text-gray-400">(exists)</span>
                        )}
                      </div>
                      {folder.subfolders && (
                        <div className="ml-6 mt-1 space-y-1">
                          {folder.subfolders.map((sub, subIndex) => (
                            <div
                              key={subIndex}
                              className="flex items-center gap-2 text-sm text-gray-600"
                            >
                              <Folder className="w-3.5 h-3.5 text-yellow-400" />
                              {sub}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedType || creating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4" />
                Create Folders
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
