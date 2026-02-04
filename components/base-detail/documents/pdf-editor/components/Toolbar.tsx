/**
 * PDF Editor Toolbar
 * Contains navigation, zoom, tools, and action buttons
 */

"use client";

import React, { useState } from "react";
import {
  X,
  Save,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
  Highlighter,
  Type,
  PenTool,
  Maximize2,
  Minimize2,
  Loader2,
  FileText,
  MousePointer,
  Hand,
  Edit3,
  Undo2,
  Redo2,
  FileSignature,
  Send,
  Keyboard,
  HelpCircle,
  Pen,
  CalendarCheck,
} from "lucide-react";
import type { Tool } from "../types";
import { ZOOM_LEVELS } from "../types";

interface ToolbarProps {
  documentName: string;
  currentPage: number;
  numPages: number;
  zoomIndex: number;
  activeTool: Tool;
  isFullscreen: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSignatureFields: boolean;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotate: () => void;
  onToolChange: (tool: Tool) => void;
  onFullscreenToggle: () => void;
  onDownload: () => void;
  onSave: () => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRequestSignature?: () => void;
}

export function Toolbar({
  documentName,
  currentPage,
  numPages,
  zoomIndex,
  activeTool,
  isFullscreen,
  isSaving,
  hasChanges,
  canUndo,
  canRedo,
  hasSignatureFields,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRotate,
  onToolChange,
  onFullscreenToggle,
  onDownload,
  onSave,
  onClose,
  onUndo,
  onRedo,
  onRequestSignature,
}: ToolbarProps) {
  const zoom = ZOOM_LEVELS[zoomIndex];
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
      {/* Document Info */}
      <div className="flex items-center gap-4">
        <FileText className="w-5 h-5 text-gray-400" />
        <span className="text-white font-medium truncate max-w-xs">
          {documentName}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Page Navigation */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-sm px-2">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
          <button
            onClick={onZoomOut}
            disabled={zoomIndex <= 0}
            className="p-1 hover:bg-gray-600 rounded disabled:opacity-50"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={onZoomReset}
            className="text-white text-sm px-2 hover:bg-gray-600 rounded"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            className="p-1 hover:bg-gray-600 rounded disabled:opacity-50"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
        </div>

        <button
          onClick={onRotate}
          className="p-2 hover:bg-gray-700 rounded-lg"
          title="Rotate"
        >
          <RotateCw className="w-4 h-4 text-white" />
        </button>

        <div className="w-px h-6 bg-gray-600" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-1 py-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded text-white hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded text-white hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-1 py-1">
          <ToolButton
            icon={<MousePointer className="w-4 h-4" />}
            active={activeTool === "select"}
            onClick={() => onToolChange("select")}
            title="Select & Move (V) - Click and drag text/annotations to reposition"
            shortcut="V"
          />
          <ToolButton
            icon={<Hand className="w-4 h-4" />}
            active={activeTool === "pan"}
            onClick={() => onToolChange("pan")}
            title="Pan (P) - Drag to scroll around the document"
            shortcut="P"
          />
          <ToolButton
            icon={<Highlighter className="w-4 h-4" />}
            active={activeTool === "highlight"}
            onClick={() => onToolChange("highlight")}
            title="Highlight (H) - Click and drag to highlight text"
            shortcut="H"
          />
          <ToolButton
            icon={<Type className="w-4 h-4" />}
            active={activeTool === "text"}
            onClick={() => onToolChange("text")}
            title="Add Text (T) - Click to add new text anywhere"
            shortcut="T"
          />
          <ToolButton
            icon={<Edit3 className="w-4 h-4" />}
            active={activeTool === "edit"}
            onClick={() => onToolChange("edit")}
            title="Edit Text (E) - Click on existing text to modify it"
            shortcut="E"
          />
          <ToolButton
            icon={<PenTool className="w-4 h-4" />}
            active={activeTool === "signature"}
            onClick={() => onToolChange("signature")}
            title="Add Your Signature (S) - Draw or upload your signature"
            shortcut="S"
          />
          <ToolButton
            icon={<FileSignature className="w-4 h-4" />}
            active={activeTool === "signatureField"}
            onClick={() => onToolChange("signatureField")}
            title="Signature Field (F) - Add a field for others to sign"
            shortcut="F"
          />
          <ToolButton
            icon={<Pen className="w-4 h-4" />}
            active={activeTool === "initialsField"}
            onClick={() => onToolChange("initialsField")}
            title="Initials Field (I) - Add a field for initials"
            shortcut="I"
          />
          <ToolButton
            icon={<CalendarCheck className="w-4 h-4" />}
            active={activeTool === "dateField"}
            onClick={() => onToolChange("dateField")}
            title="Date Field (D) - Auto-fills with signing date"
            shortcut="D"
          />
        </div>

        <div className="w-px h-6 bg-gray-600" />

        {/* Request Signature Button */}
        {onRequestSignature && (
          <>
            <button
              onClick={onRequestSignature}
              disabled={!hasSignatureFields && !hasChanges}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                hasSignatureFields
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-600 hover:bg-gray-500 text-gray-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={hasSignatureFields ? "Send for signature" : "Add signature fields first, or save and send existing document"}
            >
              <Send className="w-4 h-4" />
              Request Signature
            </button>
            <div className="w-px h-6 bg-gray-600" />
          </>
        )}

        {/* View Controls */}
        <button
          onClick={onFullscreenToggle}
          className="p-2 hover:bg-gray-700 rounded-lg"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-white" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white" />
          )}
        </button>

        <button
          onClick={onDownload}
          className="p-2 hover:bg-gray-700 rounded-lg"
          title="Download"
        >
          <Download className="w-4 h-4 text-white" />
        </button>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={isSaving || !hasChanges}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            hasChanges
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={hasChanges ? "Save changes" : "No changes to save"}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : hasChanges ? "Save" : "No Changes"}
        </button>

        {/* Keyboard Shortcuts Help */}
        <div className="relative">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={`p-2 rounded-lg transition-colors ${
              showShortcuts ? "bg-gray-600" : "hover:bg-gray-700"
            }`}
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4 text-white" />
          </button>
          
          {/* Shortcuts Panel */}
          {showShortcuts && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Keyboard className="w-4 h-4" />
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                {/* Tools Section */}
                <div>
                  <div className="text-gray-400 text-xs uppercase mb-1">Tools</div>
                  <div className="grid grid-cols-2 gap-1">
                    <ShortcutItem keys={["V"]} description="Select" />
                    <ShortcutItem keys={["T"]} description="Text" />
                    <ShortcutItem keys={["H"]} description="Highlight" />
                    <ShortcutItem keys={["E"]} description="Edit" />
                    <ShortcutItem keys={["S"]} description="Signature" />
                    <ShortcutItem keys={["F"]} description="Sig. Field" />
                    <ShortcutItem keys={["I"]} description="Initials" />
                    <ShortcutItem keys={["D"]} description="Date Field" />
                    <ShortcutItem keys={["P"]} description="Pan" />
                  </div>
                </div>
                
                {/* Navigation Section */}
                <div>
                  <div className="text-gray-400 text-xs uppercase mb-1">Navigation</div>
                  <div className="grid grid-cols-2 gap-1">
                    <ShortcutItem keys={["PgUp"]} description="Prev Page" />
                    <ShortcutItem keys={["PgDn"]} description="Next Page" />
                    <ShortcutItem keys={["Ctrl", "Home"]} description="First Page" />
                    <ShortcutItem keys={["Ctrl", "End"]} description="Last Page" />
                    <ShortcutItem keys={["Tab"]} description="Next Field" />
                    <ShortcutItem keys={["⇧", "Tab"]} description="Prev Field" />
                  </div>
                </div>
                
                {/* Actions Section */}
                <div>
                  <div className="text-gray-400 text-xs uppercase mb-1">Actions</div>
                  <div className="grid grid-cols-2 gap-1">
                    <ShortcutItem keys={["Ctrl", "Z"]} description="Undo" />
                    <ShortcutItem keys={["Ctrl", "Y", "/", "⇧Z"]} description="Redo" />
                    <ShortcutItem keys={["Ctrl", "S"]} description="Save" />
                    <ShortcutItem keys={["Del"]} description="Delete" />
                    <ShortcutItem keys={["Esc"]} description="Cancel" />
                  </div>
                </div>
                
                {/* Zoom Section */}
                <div>
                  <div className="text-gray-400 text-xs uppercase mb-1">Zoom</div>
                  <div className="grid grid-cols-2 gap-1">
                    <ShortcutItem keys={["Ctrl", "+"]} description="Zoom In" />
                    <ShortcutItem keys={["Ctrl", "-"]} description="Zoom Out" />
                    <ShortcutItem keys={["Ctrl", "0"]} description="Reset" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-lg"
          title="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

// Shortcut item component
function ShortcutItem({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between text-gray-300 py-0.5">
      <span className="text-xs">{description}</span>
      <div className="flex gap-0.5">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

// Tool button component with keyboard shortcut indicator
function ToolButton({
  icon,
  active,
  onClick,
  title,
  shortcut,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-1.5 rounded text-white group ${
        active ? "bg-blue-600" : "hover:bg-gray-600"
      }`}
      title={title}
    >
      {icon}
      {/* Show shortcut key on hover */}
      {shortcut && (
        <span className="absolute -bottom-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold bg-gray-900 border border-gray-600 rounded text-gray-300">
          {shortcut}
        </span>
      )}
    </button>
  );
}
