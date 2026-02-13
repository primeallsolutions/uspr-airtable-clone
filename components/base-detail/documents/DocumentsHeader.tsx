import { FolderPlus, FileUp, Hash, Loader2, FileText, PenTool, CheckCircle2, Layers } from "lucide-react";

type DocumentsHeaderProps = {
  prefixLabel: string;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  onAddFolder: () => void;
  onUpload: (files: FileList | null) => void;
  onManageTemplates?: () => void;
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
  onManageTemplates,
  onRequestSignature,
  onViewSignatures,
  onMergeDocuments,
}: DocumentsHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center border-b border-gray-200 px-3 md:px-4 py-2 md:py-3 bg-gray-50 gap-2 md:gap-0">
      <div className="flex items-center gap-2 text-xs md:text-sm text-gray-700 min-w-0">
        <Hash className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="font-semibold truncate">{prefixLabel}</span>
      </div>
      <div className="flex items-center gap-1 md:gap-2 overflow-x-auto md:overflow-x-visible flex-nowrap md:flex-wrap ml-0 md:ml-auto pb-1 md:pb-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
        {onManageTemplates && (
          <button
            onClick={onManageTemplates}
            className="hidden flex-shrink-0 md:inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:text-purple-700 transition-colors"
            title="Manage document templates"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </button>
        )}
        {onRequestSignature && (
          <button
            onClick={onRequestSignature}
            className="flex-shrink-0 inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors"
            title="Request e-signature"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Request Signature</span>
          </button>
        )}
        {onViewSignatures && (
          <button
            onClick={onViewSignatures}
            className="flex-shrink-0 inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:text-green-700 transition-colors"
            title="View signature requests status"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">View Signatures</span>
          </button>
        )}
        {onMergeDocuments && (
          <button
            onClick={onMergeDocuments}
            className="flex-shrink-0 inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            title="Merge PDFs with page reordering"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Merge PDFs</span>
          </button>
        )}
        <button
          onClick={onAddFolder}
          className="flex-shrink-0 inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Folder</span>
        </button>
        <label className="flex-shrink-0 inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <FileUp className="w-4 h-4" />
          <span className="hidden sm:inline">Upload</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
        </label>
        {uploading && <Loader2 className="flex-shrink-0 w-4 h-4 text-blue-600 animate-spin" />}
        {uploading && (
          <span className="flex-shrink-0 text-xs text-gray-600 whitespace-nowrap">
            {uploadProgress.current}/{uploadProgress.total}
          </span>
        )}
      </div>
    </div>
  );
};

