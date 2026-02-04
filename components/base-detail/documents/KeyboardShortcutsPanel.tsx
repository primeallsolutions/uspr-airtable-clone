"use client";

import { useState, useEffect } from "react";
import { X, Keyboard, Command, ArrowUp, ArrowDown } from "lucide-react";

type ShortcutCategory = {
  name: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
    context?: string; // Optional context (e.g., "In editor")
  }>;
};

const DOCUMENT_SHORTCUTS: ShortcutCategory[] = [
  {
    name: "Navigation",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate document list" },
      { keys: ["J", "K"], description: "Navigate (Vim-style)" },
      { keys: ["Enter"], description: "Select document" },
      { keys: ["Tab"], description: "Cycle through signature fields", context: "In editor" },
    ],
  },
  {
    name: "Document Actions",
    shortcuts: [
      { keys: ["E"], description: "Edit selected document" },
      { keys: ["S"], description: "Request signature" },
      { keys: ["D"], description: "Download document" },
      { keys: ["Delete"], description: "Delete selected document" },
    ],
  },
  {
    name: "Editor",
    shortcuts: [
      { keys: ["Ctrl", "S"], description: "Save document" },
      { keys: ["Ctrl", "Z"], description: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
      { keys: ["V"], description: "Select tool" },
      { keys: ["T"], description: "Text tool" },
      { keys: ["H"], description: "Highlight tool" },
      { keys: ["P"], description: "Pan tool" },
      { keys: ["F"], description: "Signature field tool" },
      { keys: ["Escape"], description: "Deselect / Cancel" },
    ],
  },
  {
    name: "Zoom & View",
    shortcuts: [
      { keys: ["Ctrl", "+"], description: "Zoom in" },
      { keys: ["Ctrl", "-"], description: "Zoom out" },
      { keys: ["Ctrl", "0"], description: "Reset zoom" },
      { keys: ["PageUp"], description: "Previous page" },
      { keys: ["PageDown"], description: "Next page" },
      { keys: ["Ctrl", "Home"], description: "First page" },
      { keys: ["Ctrl", "End"], description: "Last page" },
    ],
  },
  {
    name: "General",
    shortcuts: [
      { keys: ["?"], description: "Show this panel" },
      { keys: ["Escape"], description: "Close panel / modal" },
    ],
  },
];

type KeyboardShortcutsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen && !isAnimating) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        isOpen ? "bg-black/40 backdrop-blur-sm" : "bg-transparent pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden transition-all duration-200 ${
          isOpen 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={() => {
          if (!isOpen) setIsAnimating(false);
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Keyboard className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
                <p className="text-xs text-gray-500">Press ? anytime to show this panel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DOCUMENT_SHORTCUTS.map((category) => (
              <div key={category.name}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {category.name}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">{shortcut.description}</span>
                        {shortcut.context && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {shortcut.context}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center">
                            {keyIdx > 0 && <span className="text-gray-300 mx-0.5">+</span>}
                            <KeyBadge keyName={key} />
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Pro tip: Most shortcuts work when the document list has focus</span>
            <div className="flex items-center gap-1">
              <KeyBadge keyName="Esc" size="sm" />
              <span>to close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Key Badge Component
 * Renders a styled keyboard key
 */
function KeyBadge({ keyName, size = "md" }: { keyName: string; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" 
    ? "min-w-[1.25rem] h-5 px-1 text-[10px]" 
    : "min-w-[1.5rem] h-6 px-1.5 text-xs";

  // Special key icons
  const renderKey = () => {
    switch (keyName.toLowerCase()) {
      case "ctrl":
        return <span className="font-semibold">Ctrl</span>;
      case "cmd":
      case "command":
        return <Command className="w-3 h-3" />;
      case "shift":
        return <span className="font-semibold">⇧</span>;
      case "enter":
        return <span className="font-semibold">↵</span>;
      case "tab":
        return <span className="font-semibold">⇥</span>;
      case "escape":
      case "esc":
        return <span className="font-semibold">Esc</span>;
      case "delete":
        return <span className="font-semibold">Del</span>;
      case "backspace":
        return <span className="font-semibold">⌫</span>;
      case "↑":
        return <ArrowUp className="w-3 h-3" />;
      case "↓":
        return <ArrowDown className="w-3 h-3" />;
      default:
        return <span className="font-semibold">{keyName}</span>;
    }
  };

  return (
    <kbd className={`inline-flex items-center justify-center ${sizeClasses} text-gray-700 bg-gray-100 border border-gray-300 rounded shadow-sm font-mono`}>
      {renderKey()}
    </kbd>
  );
}

/**
 * Hook to handle global keyboard shortcut panel toggle
 */
export function useKeyboardShortcutsPanel() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // ? key to toggle panel
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}


