import { useState, useRef, useEffect } from "react";
import { FolderPlus, FileUp, Hash, Loader2, FileText, PenTool, CheckCircle2, Layers, FileTemplate, ChevronDown, Star, Clock, Search, X } from "lucide-react";

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
  // Template quick access
  templates?: Template[];
  recentTemplates?: Template[];
  favoriteTemplates?: Template[];
  onSelectTemplate?: (templateId: string) => void;
  onToggleFavorite?: (templateId: string) => void;
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
  templates = [],
  recentTemplates = [],
  favoriteTemplates = [],
  onSelectTemplate,
  onToggleFavorite,
}: DocumentsHeaderProps) => {
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
        setTemplateSearch("");
      }
    };

    if (showTemplateDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTemplateDropdown]);

  // Filter templates by search
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const hasTemplates = templates.length > 0 || recentTemplates.length > 0 || favoriteTemplates.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 bg-gray-50">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Hash className="w-4 h-4 text-gray-500" />
        <span className="font-semibold truncate">{prefixLabel}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {/* Template Quick Access */}
        {onSelectTemplate && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                showTemplateDropdown
                  ? "text-purple-700 bg-purple-100 border border-purple-300"
                  : "text-gray-700 bg-white border border-gray-200 hover:border-purple-400 hover:text-purple-700"
              }`}
              title="Create from template"
            >
              <FileTemplate className="w-4 h-4" />
              New from Template
              <ChevronDown className={`w-4 h-4 transition-transform ${showTemplateDropdown ? "rotate-180" : ""}`} />
            </button>
            
            {/* Template Dropdown */}
            {showTemplateDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                {/* Search */}
                <div className="p-2 border-b border-gray-100">
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
      className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 cursor-pointer group"
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

