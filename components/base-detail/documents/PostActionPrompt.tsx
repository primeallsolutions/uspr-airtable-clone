"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  PenTool,
  Share2,
  Edit3,
  FolderOpen,
  FileUp,
  Eye,
  ArrowRight,
  X,
  Sparkles,
  Clock,
  FileText,
} from "lucide-react";

export type PostActionType = 
  | "document-saved" 
  | "document-uploaded" 
  | "signature-sent" 
  | "signature-completed"
  | "document-edited";

export type ActionSuggestion = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  variant: "primary" | "secondary" | "ghost";
  onClick: () => void;
};

type PostActionPromptProps = {
  type: PostActionType;
  documentName?: string;
  isOpen: boolean;
  onClose: () => void;
  suggestions: ActionSuggestion[];
  autoCloseDelay?: number; // in ms, 0 to disable
};

// Configuration for different action types
const ACTION_CONFIG: Record<PostActionType, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  bgGradient: string;
}> = {
  "document-saved": {
    title: "Document Saved!",
    subtitle: "Your changes have been saved successfully.",
    icon: <CheckCircle2 className="w-6 h-6" />,
    accentColor: "text-emerald-600",
    bgGradient: "from-emerald-50 to-green-50",
  },
  "document-uploaded": {
    title: "Upload Complete!",
    subtitle: "Your document is ready.",
    icon: <FileUp className="w-6 h-6" />,
    accentColor: "text-blue-600",
    bgGradient: "from-blue-50 to-indigo-50",
  },
  "signature-sent": {
    title: "Signature Request Sent!",
    subtitle: "Recipients will be notified by email.",
    icon: <PenTool className="w-6 h-6" />,
    accentColor: "text-purple-600",
    bgGradient: "from-purple-50 to-violet-50",
  },
  "signature-completed": {
    title: "All Signatures Collected!",
    subtitle: "The document has been fully signed.",
    icon: <Sparkles className="w-6 h-6" />,
    accentColor: "text-amber-600",
    bgGradient: "from-amber-50 to-yellow-50",
  },
  "document-edited": {
    title: "Edits Applied!",
    subtitle: "Your annotations have been added.",
    icon: <Edit3 className="w-6 h-6" />,
    accentColor: "text-cyan-600",
    bgGradient: "from-cyan-50 to-sky-50",
  },
};

export function PostActionPrompt({
  type,
  documentName,
  isOpen,
  onClose,
  suggestions,
  autoCloseDelay = 0,
}: PostActionPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const config = ACTION_CONFIG[type];

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      // Small delay for mount animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Auto-close after delay
  useEffect(() => {
    if (isOpen && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseDelay]);

  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleSuggestionClick = (suggestion: ActionSuggestion) => {
    handleClose();
    // Small delay to let animation complete
    setTimeout(() => {
      suggestion.onClick();
    }, 150);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        isVisible ? "bg-black/30 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-200 transform ${
          isVisible 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${config.bgGradient} px-6 py-5 relative`}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/50 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl bg-white shadow-sm ${config.accentColor}`}>
              {config.icon}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {config.title}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {config.subtitle}
              </p>
              {documentName && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5 truncate">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{documentName}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="px-6 py-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              What would you like to do next?
            </p>
            
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
                  suggestion.variant === "primary"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg"
                    : suggestion.variant === "secondary"
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    : "bg-transparent text-gray-700 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  suggestion.variant === "primary"
                    ? "bg-white/20"
                    : "bg-white shadow-sm"
                }`}>
                  {suggestion.icon}
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium block">{suggestion.label}</span>
                  {suggestion.description && (
                    <span className={`text-xs ${
                      suggestion.variant === "primary" 
                        ? "text-white/80" 
                        : "text-gray-500"
                    }`}>
                      {suggestion.description}
                    </span>
                  )}
                </div>
                <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                  suggestion.variant === "primary" ? "text-white/70" : "text-gray-400"
                }`} />
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            Close and continue working
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Preset suggestion builders for common scenarios
 */
export const createSaveSuggestions = ({
  onRequestSignature,
  onShare,
  onContinueEditing,
}: {
  onRequestSignature?: () => void;
  onShare?: () => void;
  onContinueEditing?: () => void;
}): ActionSuggestion[] => {
  const suggestions: ActionSuggestion[] = [];
  
  if (onRequestSignature) {
    suggestions.push({
      id: "request-signature",
      label: "Request Signature",
      description: "Send this document for e-signature",
      icon: <PenTool className="w-4 h-4 text-purple-600" />,
      variant: "primary",
      onClick: onRequestSignature,
    });
  }
  
  if (onShare) {
    suggestions.push({
      id: "share",
      label: "Share Document",
      description: "Share with team members or clients",
      icon: <Share2 className="w-4 h-4 text-blue-600" />,
      variant: "secondary",
      onClick: onShare,
    });
  }
  
  if (onContinueEditing) {
    suggestions.push({
      id: "continue-editing",
      label: "Continue Editing",
      description: "Make more changes to this document",
      icon: <Edit3 className="w-4 h-4 text-gray-600" />,
      variant: "ghost",
      onClick: onContinueEditing,
    });
  }
  
  return suggestions;
};

export const createUploadSuggestions = ({
  onEditDocument,
  onOrganize,
  onRequestSignature,
  onUploadMore,
}: {
  onEditDocument?: () => void;
  onOrganize?: () => void;
  onRequestSignature?: () => void;
  onUploadMore?: () => void;
}): ActionSuggestion[] => {
  const suggestions: ActionSuggestion[] = [];
  
  if (onEditDocument) {
    suggestions.push({
      id: "edit-document",
      label: "Edit Document",
      description: "Add annotations, text, or signatures",
      icon: <Edit3 className="w-4 h-4 text-blue-600" />,
      variant: "primary",
      onClick: onEditDocument,
    });
  }
  
  if (onRequestSignature) {
    suggestions.push({
      id: "request-signature",
      label: "Request Signature",
      description: "Send for e-signature right away",
      icon: <PenTool className="w-4 h-4 text-purple-600" />,
      variant: "secondary",
      onClick: onRequestSignature,
    });
  }
  
  if (onOrganize) {
    suggestions.push({
      id: "organize",
      label: "Organize into Folder",
      description: "Move to the appropriate folder",
      icon: <FolderOpen className="w-4 h-4 text-amber-600" />,
      variant: "ghost",
      onClick: onOrganize,
    });
  }
  
  if (onUploadMore) {
    suggestions.push({
      id: "upload-more",
      label: "Upload Another",
      description: "Add more documents",
      icon: <FileUp className="w-4 h-4 text-gray-600" />,
      variant: "ghost",
      onClick: onUploadMore,
    });
  }
  
  return suggestions;
};

export const createSignatureSentSuggestions = ({
  onViewStatus,
  onUploadAnother,
  onViewAllRequests,
}: {
  onViewStatus?: () => void;
  onUploadAnother?: () => void;
  onViewAllRequests?: () => void;
}): ActionSuggestion[] => {
  const suggestions: ActionSuggestion[] = [];
  
  if (onViewStatus) {
    suggestions.push({
      id: "view-status",
      label: "Track Request Status",
      description: "Monitor signature progress",
      icon: <Clock className="w-4 h-4 text-purple-600" />,
      variant: "primary",
      onClick: onViewStatus,
    });
  }
  
  if (onViewAllRequests) {
    suggestions.push({
      id: "view-all",
      label: "View All Requests",
      description: "See all pending signatures",
      icon: <Eye className="w-4 h-4 text-blue-600" />,
      variant: "secondary",
      onClick: onViewAllRequests,
    });
  }
  
  if (onUploadAnother) {
    suggestions.push({
      id: "upload-another",
      label: "Upload Another Document",
      icon: <FileUp className="w-4 h-4 text-gray-600" />,
      variant: "ghost",
      onClick: onUploadAnother,
    });
  }
  
  return suggestions;
};

