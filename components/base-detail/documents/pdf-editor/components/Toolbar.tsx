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
  Loader2,
  FileText,
  MousePointer,
  Hand,
  Edit3,
  Undo2,
  Redo2,
  FileSignature,
  Keyboard,
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
  isSaving: boolean;
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotate: () => void;
  onToolChange: (tool: Tool) => void;
  onDownload: () => void;
  onSave: () => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function Toolbar({
  documentName,
  currentPage,
  numPages,
  zoomIndex,
  activeTool,
  isSaving,
  hasChanges,
  canUndo,
  canRedo,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRotate,
  onToolChange,
  onDownload,
  onSave,
  onClose,
  onUndo,
  onRedo,
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
          <div className="relative group">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed text-white"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                <div className="text-white text-sm font-medium">Previous Page</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">PgUp</kbd>
                </div>
              </div>
            </div>
          </div>
          <span className="text-white text-sm px-2">
            {currentPage} / {numPages}
          </span>
          <div className="relative group">
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed text-white"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                <div className="text-white text-sm font-medium">Next Page</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">PgDn</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
          <div className="relative group">
            <button
              onClick={onZoomOut}
              disabled={zoomIndex <= 0}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 text-white"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                <div className="text-white text-sm font-medium">Zoom Out</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">Ctrl+-</kbd>
                </div>
              </div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={onZoomReset}
              className="text-white text-sm px-2 hover:bg-gray-600 rounded"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                <div className="text-white text-sm font-medium">Reset Zoom</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">Ctrl+0</kbd>
                </div>
              </div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={onZoomIn}
              disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 text-white"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                <div className="text-white text-sm font-medium">Zoom In</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">Ctrl++</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        <IconButton
          icon={<RotateCw className="w-4 h-4" />}
          onClick={onRotate}
          label="Rotate"
        />

        <div className="w-px h-6 bg-gray-600" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0 bg-gray-700 rounded-lg px-0.5 py-0.5">
          <IconButton
            icon={<Undo2 className="w-4 h-4" />}
            onClick={onUndo}
            disabled={!canUndo}
            label="Undo"
            shortcut="Ctrl+Z"
            className="p-1.5 hover:bg-gray-600"
          />
          <IconButton
            icon={<Redo2 className="w-4 h-4" />}
            onClick={onRedo}
            disabled={!canRedo}
            label="Redo"
            shortcut="Ctrl+Y"
            className="p-1.5 hover:bg-gray-600"
          />
        </div>

        <div className="w-px h-6 bg-gray-600" />

        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-1 py-1">
          <ToolButton
            icon={<MousePointer className="w-4 h-4" />}
            active={activeTool === "select"}
            onClick={() => onToolChange("select")}
            label="Select"
            title="Select & Move - Click and drag text/annotations to reposition"
            shortcut="V"
          />
          <ToolButton
            icon={<Hand className="w-4 h-4" />}
            active={activeTool === "pan"}
            onClick={() => onToolChange("pan")}
            label="Pan"
            title="Pan - Drag to scroll around the document"
            shortcut="P"
          />
          <ToolButton
            icon={<Highlighter className="w-4 h-4" />}
            active={activeTool === "highlight"}
            onClick={() => onToolChange("highlight")}
            label="Highlight"
            title="Highlight - Click and drag to highlight text"
            shortcut="H"
          />
          <ToolButton
            icon={<Type className="w-4 h-4" />}
            active={activeTool === "text"}
            onClick={() => onToolChange("text")}
            label="Add Text"
            title="Add Text - Click to add new text anywhere"
            shortcut="T"
          />
          <ToolButton
            icon={<Edit3 className="w-4 h-4" />}
            active={activeTool === "edit"}
            onClick={() => onToolChange("edit")}
            label="Edit Text"
            title="Edit Text - Click on existing text to modify it"
            shortcut="E"
          />
          <ToolButton
            icon={<PenTool className="w-4 h-4" />}
            active={activeTool === "signature"}
            onClick={() => onToolChange("signature")}
            label="Signature"
            title="Add Your Signature - Draw or upload your signature"
            shortcut="S"
          />
          <ToolButton
            icon={<FileSignature className="w-4 h-4" />}
            active={activeTool === "signatureField"}
            onClick={() => onToolChange("signatureField")}
            label="Signature Field"
            title="Signature Field - Add a field for others to sign"
            shortcut="F"
          />
          <ToolButton
            icon={<Pen className="w-4 h-4" />}
            active={activeTool === "initialsField"}
            onClick={() => onToolChange("initialsField")}
            label="Initials Field"
            title="Initials Field - Add a field for initials"
            shortcut="I"
          />
          <ToolButton
            icon={<CalendarCheck className="w-4 h-4" />}
            active={activeTool === "dateField"}
            onClick={() => onToolChange("dateField")}
            label="Date Field"
            title="Date Field - Auto-fills with signing date"
            shortcut="D"
          />
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <IconButton
          icon={<Download className="w-4 h-4" />}
          onClick={onDownload}
          label="Download"
        />

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
        <div className="relative group">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={`p-2 rounded-lg transition-colors text-white ${
              showShortcuts ? "bg-gray-600" : "hover:bg-gray-700"
            }`}
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          {/* Enhanced tooltip on hover */}
          {!showShortcuts && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                <div className="text-white text-sm font-medium">Keyboard Shortcuts</div>
              </div>
            </div>
          )}
          
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
        <IconButton
          icon={<X className="w-5 h-5" />}
          onClick={onClose}
          label="Close"
          shortcut="Esc"
        />
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

// Icon button component with enhanced tooltip
function IconButton({
  icon,
  onClick,
  label,
  shortcut,
  disabled,
  className = "",
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`p-2 rounded-lg text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        aria-label={label}
      >
        {icon}
      </button>
      {/* Enhanced tooltip on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
          <div className="text-white text-sm font-medium">{label}</div>
          {shortcut && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">
                {shortcut}
              </kbd>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Tool button component with enhanced tooltip
function ToolButton({
  icon,
  active,
  onClick,
  label,
  title,
  shortcut,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  shortcut?: string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`relative p-1.5 rounded text-white ${
          active ? "bg-blue-600" : "hover:bg-gray-600"
        }`}
        aria-label={title}
      >
        {icon}
      </button>
      {/* Enhanced tooltip on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900" />
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
          <div className="text-white text-sm font-medium">{label}</div>
          {shortcut && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded font-mono text-gray-300">
                {shortcut}
              </kbd>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
