import { FolderPlus, FileUp, Hash, Loader2, FileText, Sparkles } from "lucide-react";

type DocumentsHeaderProps = {
  prefixLabel: string;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  onAddFolder: () => void;
  onUpload: (files: FileList | null) => void;
  onManageTemplates?: () => void;
  onGenerateDocument?: () => void;
};

export const DocumentsHeader = ({
  prefixLabel,
  uploading,
  uploadProgress,
  onAddFolder,
  onUpload,
  onManageTemplates,
  onGenerateDocument,
}: DocumentsHeaderProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 bg-gray-50">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Hash className="w-4 h-4 text-gray-500" />
        <span className="font-semibold truncate">{prefixLabel}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {onManageTemplates && (
          <button
            onClick={onManageTemplates}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:text-purple-700 transition-colors"
            title="Manage document templates"
          >
            <FileText className="w-4 h-4" />
            Templates
          </button>
        )}
        {onGenerateDocument && (
          <button
            onClick={onGenerateDocument}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 border border-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            title="Generate document from template"
          >
            <Sparkles className="w-4 h-4" />
            Generate
          </button>
        )}
        <button
          onClick={onAddFolder}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          New Folder
        </button>
        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <FileUp className="w-4 h-4" />
          Upload
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
        </label>
        {uploading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
        {uploading && (
          <span className="text-xs text-gray-600">
            {uploadProgress.current}/{uploadProgress.total}
          </span>
        )}
      </div>
    </div>
  );
};

