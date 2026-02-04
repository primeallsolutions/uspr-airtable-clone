/**
 * PDF Editor Toolbar
 * Contains navigation, zoom, tools, and action buttons
 */

"use client";

import React from "react";
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
}: ToolbarProps) {
  const zoom = ZOOM_LEVELS[zoomIndex];

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

        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-1 py-1">
          <ToolButton
            icon={<MousePointer className="w-4 h-4" />}
            active={activeTool === "select"}
            onClick={() => onToolChange("select")}
            title="Select"
          />
          <ToolButton
            icon={<Hand className="w-4 h-4" />}
            active={activeTool === "pan"}
            onClick={() => onToolChange("pan")}
            title="Pan"
          />
          <ToolButton
            icon={<Highlighter className="w-4 h-4" />}
            active={activeTool === "highlight"}
            onClick={() => onToolChange("highlight")}
            title="Highlight"
          />
          <ToolButton
            icon={<Type className="w-4 h-4" />}
            active={activeTool === "text"}
            onClick={() => onToolChange("text")}
            title="Add Text"
          />
          <ToolButton
            icon={<Edit3 className="w-4 h-4" />}
            active={activeTool === "edit"}
            onClick={() => onToolChange("edit")}
            title="Edit Text"
          />
          <ToolButton
            icon={<PenTool className="w-4 h-4" />}
            active={activeTool === "signature"}
            onClick={() => onToolChange("signature")}
            title="Add Signature"
          />
        </div>

        <div className="w-px h-6 bg-gray-600" />

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

// Tool button component
function ToolButton({
  icon,
  active,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded text-white ${
        active ? "bg-blue-600" : "hover:bg-gray-600"
      }`}
      title={title}
    >
      {icon}
    </button>
  );
}
