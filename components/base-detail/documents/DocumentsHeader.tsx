import { useState, useRef, useEffect } from "react";
import { 
  FolderPlus, 
  FileUp, 
  Hash, 
  Loader2, 
  FileText, 
  PenTool, 
  CheckCircle2, 
  Layers, 
  FileTemplate, 
  ChevronDown, 
  Star, 
  Clock, 
  Search, 
  X,
  MoreHorizontal,
  Scissors,
  Copy,
  Trash2,
} from "lucide-react";

type Template = {
  id: string;
  name: string;
  description?: string;
  isFavorite?: boolean;
  lastUsed?: Date;
};

type DocumentsHeaderProps = {
  prefixLabel: string;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  onAddFolder: () => void;
  onUpload: (files: FileList | null) => void;
  onRequestSignature?: () => void;
  onViewSignatures?: () => void;
  onMergeDocuments?: () => void;
  onSplitDocument?: () => void;
  onBulkDelete?: () => void;
  onBulkMove?: () => void;
  // Template quick access
  templates?: Template[];
  recentTemplates?: Template[];
  favoriteTemplates?: Template[];
  onSelectTemplate?: (templateId: string) => void;
  onToggleFavorite?: (templateId: string) => void;
  // Selection state for bulk actions
  selectedCount?: number;
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
  onSplitDocument,
  onBulkDelete,
  onBulkMove,
  templates = [],
  recentTemplates = [],
  favoriteTemplates = [],
  onSelectTemplate,
  onToggleFavorite,
  selectedCount = 0,
}: DocumentsHeaderProps) => {
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showESignDropdown, setShowESignDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const eSignDropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
        setTemplateSearch("");
      }
      if (eSignDropdownRef.current && !eSignDropdownRef.current.contains(event.target as Node)) {
        setShowESignDropdown(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setShowMoreDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter templates by search
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const hasESignActions = onRequestSignature || onViewSignatures;
  const hasMoreActions = onMergeDocuments || onSplitDocument || onBulkDelete || onBulkMove;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
      {/* Path Label */}
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Hash className="w-4 h-4 text-gray-500" />
        <span className="font-semibold truncate max-w-[200px]" title={prefixLabel}>
          {prefixLabel}
        </span>
      </div>
      
      {/* Selection Count Badge */}
      {selectedCount > 0 && (
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
          {selectedCount} selected
        </span>
      )}
      
      <div className="flex items-center gap-2 ml-auto">
        {/* === Primary Actions Group === */}
        
        {/* Upload Button - Primary CTA */}
        <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer shadow-sm hover:shadow">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileUp className="w-4 h-4" />
          )}
          {uploading ? `${uploadProgress.current}/${uploadProgress.total}` : "Upload"}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
            disabled={uploading}
          />
        </label>

        {/* New Folder Button */}
        <button
          onClick={onAddFolder}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
          title="Create new folder"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">New Folder</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* === Template Dropdown === */}
        {onSelectTemplate && (
          <div className="relative" ref={templateDropdownRef}>
            <button
              onClick={() => {
                setShowTemplateDropdown(!showTemplateDropdown);
                setShowESignDropdown(false);
                setShowMoreDropdown(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                showTemplateDropdown
                  ? "text-purple-700 bg-purple-100 border border-purple-300"
                  : "text-gray-700 bg-white border border-gray-200 hover:border-purple-400 hover:text-purple-700"
              }`}
              title="Create from template"
            >
              <FileTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTemplateDropdown ? "rotate-180" : ""}`} />
            </button>
            
            {/* Template Dropdown Panel */}
            {showTemplateDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Search */}
                <div className="p-3 border-b border-gray-100 bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      autoFocus
                    />
                    {templateSearch && (
                      <button
                        onClick={() => setTemplateSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {/* Favorites Section */}
                  {favoriteTemplates.length > 0 && !templateSearch && (
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-amber-600 uppercase">
                        <Star className="w-3 h-3 fill-current" />
                        Favorites
                      </div>
                      {favoriteTemplates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          onSelect={() => {
                            onSelectTemplate(template.id);
                            setShowTemplateDropdown(false);
                            setTemplateSearch("");
                          }}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Recent Section */}
                  {recentTemplates.length > 0 && !templateSearch && (
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                        <Clock className="w-3 h-3" />
                        Recent
                      </div>
                      {recentTemplates.slice(0, 3).map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          onSelect={() => {
                            onSelectTemplate(template.id);
                            setShowTemplateDropdown(false);
                            setTemplateSearch("");
                          }}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* All Templates / Search Results */}
                  <div className="p-2">
                    {templateSearch && (
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                        {filteredTemplates.length} Result{filteredTemplates.length !== 1 ? "s" : ""}
                      </div>
                    )}
                    {!templateSearch && templates.length > 0 && (
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                        All Templates
                      </div>
                    )}
                    
                    {(templateSearch ? filteredTemplates : templates).length > 0 ? (
                      (templateSearch ? filteredTemplates : templates).map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          onSelect={() => {
                            onSelectTemplate(template.id);
                            setShowTemplateDropdown(false);
                            setTemplateSearch("");
                          }}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ))
                    ) : (
                      <div className="text-center py-4 text-sm text-gray-500">
                        {templateSearch ? "No templates found" : "No templates available"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === E-Sign Dropdown === */}
        {hasESignActions && (
          <div className="relative" ref={eSignDropdownRef}>
            <button
              onClick={() => {
                setShowESignDropdown(!showESignDropdown);
                setShowTemplateDropdown(false);
                setShowMoreDropdown(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                showESignDropdown
                  ? "text-emerald-700 bg-emerald-100 border border-emerald-300"
                  : "text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
              }`}
              title="E-Signature actions"
            >
              <PenTool className="w-4 h-4" />
              <span className="hidden sm:inline">E-Sign</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showESignDropdown ? "rotate-180" : ""}`} />
            </button>
            
            {/* E-Sign Dropdown Panel */}
            {showESignDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                {onRequestSignature && (
                  <button
                    onClick={() => {
                      onRequestSignature();
                      setShowESignDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  >
                    <PenTool className="w-4 h-4" />
                    <div className="text-left">
                      <div className="font-medium">Request Signature</div>
                      <div className="text-xs text-gray-500">Send for e-signature</div>
                    </div>
                  </button>
                )}
                {onViewSignatures && (
                  <button
                    onClick={() => {
                      onViewSignatures();
                      setShowESignDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <div className="text-left">
                      <div className="font-medium">View Requests</div>
                      <div className="text-xs text-gray-500">Track signature status</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* === More Actions Dropdown === */}
        {hasMoreActions && (
          <div className="relative" ref={moreDropdownRef}>
            <button
              onClick={() => {
                setShowMoreDropdown(!showMoreDropdown);
                setShowTemplateDropdown(false);
                setShowESignDropdown(false);
              }}
              className={`inline-flex items-center gap-1 p-2 text-sm font-medium rounded-lg transition-colors ${
                showMoreDropdown
                  ? "text-gray-700 bg-gray-200"
                  : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-100"
              }`}
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            
            {/* More Actions Dropdown Panel */}
            {showMoreDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                {onMergeDocuments && (
                  <button
                    onClick={() => {
                      onMergeDocuments();
                      setShowMoreDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    Merge PDFs
                  </button>
                )}
                {onSplitDocument && (
                  <button
                    onClick={() => {
                      onSplitDocument();
                      setShowMoreDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Scissors className="w-4 h-4" />
                    Split PDF
                  </button>
                )}
                
                {/* Bulk Actions (shown when items are selected) */}
                {selectedCount > 0 && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Bulk Actions
                    </div>
                    {onBulkMove && (
                      <button
                        onClick={() => {
                          onBulkMove();
                          setShowMoreDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        Move {selectedCount} items
                      </button>
                    )}
                    {onBulkDelete && (
                      <button
                        onClick={() => {
                          onBulkDelete();
                          setShowMoreDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete {selectedCount} items
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Template item component for the dropdown
function TemplateItem({
  template,
  onSelect,
  onToggleFavorite,
}: {
  template: Template;
  onSelect: () => void;
  onToggleFavorite?: (templateId: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-purple-50 cursor-pointer group transition-colors"
      onClick={onSelect}
    >
      <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {template.name}
        </div>
        {template.description && (
          <div className="text-xs text-gray-500 truncate">
            {template.description}
          </div>
        )}
      </div>
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(template.id);
          }}
          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
            template.isFavorite
              ? "text-amber-500 hover:text-amber-600"
              : "text-gray-400 hover:text-amber-500"
          }`}
          title={template.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={`w-4 h-4 ${template.isFavorite ? "fill-current" : ""}`} />
        </button>
      )}
    </div>
  );
}
