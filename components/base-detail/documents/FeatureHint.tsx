"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Lightbulb, Keyboard, MousePointer, Zap } from "lucide-react";

type HintType = "tip" | "keyboard" | "action" | "feature";

type FeatureHintProps = {
  id: string; // Unique ID for localStorage persistence
  type?: HintType;
  title?: string;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
  showOnce?: boolean; // Only show once, then remember dismissal
  delay?: number; // Delay before showing (ms)
  className?: string;
  children: React.ReactNode;
};

// Get the icon for hint type
function getHintIcon(type: HintType) {
  switch (type) {
    case "keyboard":
      return <Keyboard className="w-3.5 h-3.5" />;
    case "action":
      return <MousePointer className="w-3.5 h-3.5" />;
    case "feature":
      return <Zap className="w-3.5 h-3.5" />;
    default:
      return <Lightbulb className="w-3.5 h-3.5" />;
  }
}

// Get colors for hint type
function getHintColors(type: HintType) {
  switch (type) {
    case "keyboard":
      return {
        bg: "bg-indigo-900",
        border: "border-indigo-700",
        text: "text-indigo-100",
        iconBg: "bg-indigo-800",
      };
    case "action":
      return {
        bg: "bg-emerald-900",
        border: "border-emerald-700",
        text: "text-emerald-100",
        iconBg: "bg-emerald-800",
      };
    case "feature":
      return {
        bg: "bg-amber-900",
        border: "border-amber-700",
        text: "text-amber-100",
        iconBg: "bg-amber-800",
      };
    default:
      return {
        bg: "bg-gray-900",
        border: "border-gray-700",
        text: "text-gray-100",
        iconBg: "bg-gray-800",
      };
  }
}

// Check if hint was dismissed
function wasHintDismissed(id: string): boolean {
  if (typeof window === "undefined") return false;
  const dismissed = localStorage.getItem(`hint_dismissed_${id}`);
  return dismissed === "true";
}

// Mark hint as dismissed
function dismissHint(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`hint_dismissed_${id}`, "true");
}

export function FeatureHint({
  id,
  type = "tip",
  title,
  message,
  position = "top",
  showOnce = true,
  delay = 1000,
  className = "",
  children,
}: FeatureHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const colors = getHintColors(type);

  useEffect(() => {
    // Don't show if already dismissed
    if (showOnce && wasHintDismissed(id)) {
      return;
    }

    // Show hint after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [id, showOnce, delay]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (showOnce) {
      dismissHint(id);
    }
  }, [id, showOnce]);

  // Position classes
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // Arrow classes
  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent",
  };

  const arrowBorderColor = position === "top" ? "border-t-gray-900" 
    : position === "bottom" ? "border-b-gray-900"
    : position === "left" ? "border-l-gray-900"
    : "border-r-gray-900";

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      
      {/* Hint Tooltip */}
      {(isVisible || isHovered) && (
        <div 
          className={`absolute z-50 ${positionClasses[position]} animate-in fade-in slide-in-from-bottom-1 duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`${colors.bg} ${colors.border} border rounded-lg shadow-xl max-w-xs overflow-hidden`}>
            {/* Header */}
            <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
              <span className={`p-1 rounded ${colors.iconBg}`}>
                {getHintIcon(type)}
              </span>
              <span className={`text-xs font-semibold ${colors.text} flex-1`}>
                {title || (type === "keyboard" ? "Shortcut" : type === "action" ? "Quick Action" : "Tip")}
              </span>
              <button
                onClick={handleDismiss}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>
            
            {/* Content */}
            <div className={`px-3 py-2 text-xs ${colors.text}`}>
              {message}
            </div>
          </div>
          
          {/* Arrow */}
          <div 
            className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]} ${arrowBorderColor}`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * First-Time User Hints
 * Shows contextual hints for first-time users
 */
export type FirstTimeHint = {
  id: string;
  target: string; // CSS selector for target element
  type: HintType;
  title: string;
  message: string;
  position: "top" | "bottom" | "left" | "right";
  delay?: number;
};

const DOCUMENT_HINTS: FirstTimeHint[] = [
  {
    id: "double-click-edit",
    target: ".document-list-item",
    type: "action",
    title: "Quick Edit",
    message: "Double-click any PDF to open the editor directly",
    position: "right",
    delay: 2000,
  },
  {
    id: "keyboard-nav",
    target: ".documents-list",
    type: "keyboard",
    title: "Navigate with Keyboard",
    message: "Use ↑↓ or J/K to navigate, E to edit, S to sign",
    position: "bottom",
    delay: 3000,
  },
  {
    id: "drag-upload",
    target: ".upload-zone",
    type: "feature",
    title: "Drag & Drop",
    message: "Drag files directly onto this area to upload",
    position: "bottom",
    delay: 1500,
  },
];

/**
 * Floating Hint Badge
 * A small badge that shows a hint indicator
 */
type HintBadgeProps = {
  type?: HintType;
  message: string;
  className?: string;
};

export function HintBadge({ type = "tip", message, className = "" }: HintBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getHintColors(type);

  return (
    <div 
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Badge */}
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${colors.bg} cursor-help`}>
        {getHintIcon(type)}
      </span>
      
      {/* Expanded tooltip */}
      {isExpanded && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50">
          <div className={`${colors.bg} rounded-lg px-3 py-2 text-xs ${colors.text} whitespace-nowrap shadow-lg`}>
            {message}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Keyboard Shortcut Display
 * Shows a keyboard shortcut in a stylized way
 */
type KeyboardShortcutProps = {
  keys: string[];
  description?: string;
  className?: string;
};

export function KeyboardShortcut({ keys, description, className = "" }: KeyboardShortcutProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {keys.map((key, idx) => (
        <span key={idx} className="inline-flex items-center">
          {idx > 0 && <span className="text-gray-400 mx-0.5">+</span>}
          <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-[10px] font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded shadow-sm">
            {key}
          </kbd>
        </span>
      ))}
      {description && (
        <span className="text-xs text-gray-500 ml-2">{description}</span>
      )}
    </span>
  );
}


