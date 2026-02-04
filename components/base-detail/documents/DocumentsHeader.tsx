import { FolderPlus, FileUp, Hash, Loader2, FileText, PenTool, CheckCircle2, Layers } from "lucide-react";

type DocumentsHeaderProps = {
  prefixLabel: string;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  onAddFolder: () => void;
  onUpload: (files: FileList | null) => void;
  onRequestSignature?: () => void;
  onViewSignatures?: () => void;
  onMergeDocuments?: () => void;
};

export const DocumentsHeader = ({
  prefixLabel,
  uploading,
  uploadProgress,
  onAddFolder,
  onUpload,
  onRequestSignature,
  onViewSignatures,
  onMergeDocuments,
}: DocumentsHeaderProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 bg-gray-50">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Hash className="w-4 h-4 text-gray-500" />
        <span className="font-semibold truncate">{prefixLabel}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {onRequestSignature && (
          <button
            onClick={onRequestSignature}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors"
            title="Request e-signature"
          >
            <PenTool className="w-4 h-4" />
            Request Signature
          </button>
        )}
        {onViewSignatures && (
          <button
            onClick={onViewSignatures}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:text-green-700 transition-colors"
            title="View signature requests status"
          >
            <CheckCircle2 className="w-4 h-4" />
            View Signatures
          </button>
        )}
        {onMergeDocuments && (
          <button
            onClick={onMergeDocuments}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            title="Merge PDFs with page reordering"
          >
            <Layers className="w-4 h-4" />
            Merge PDFs
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

