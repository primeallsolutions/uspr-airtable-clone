/**
 * PDF Editor Status Bar
 * Shows current tool, zoom, and unsaved changes status
 */

"use client";

import React from "react";
import type { Tool } from "../types";
import { ZOOM_LEVELS } from "../types";

interface StatusBarProps {
  activeTool: Tool;
  zoomIndex: number;
  annotationCount: number;
  textEditCount: number;
}

export function StatusBar({
  activeTool,
  zoomIndex,
  annotationCount,
  textEditCount,
}: StatusBarProps) {
  const zoom = ZOOM_LEVELS[zoomIndex];
  const hasChanges = annotationCount > 0 || textEditCount > 0;

  const getToolName = (tool: Tool): string => {
    switch (tool) {
      case "select":
        return "Select";
      case "pan":
        return "Pan";
      case "highlight":
        return "Highlight";
      case "text":
        return "Add Text";
      case "edit":
        return "Edit Text";
      case "signature":
        return "Signature";
      default:
        return tool;
    }
  };

  const getToolHint = (tool: Tool): string => {
    switch (tool) {
      case "select":
        return "Click to select annotations";
      case "pan":
        return "Click and drag to pan";
      case "highlight":
        return "Click and drag to highlight";
      case "text":
        return "Click to add text";
      case "edit":
        return "Click on text to edit";
      case "signature":
        return "Click to add signature";
      default:
        return "";
    }
  };

  return (
    <div className="bg-gray-800 px-4 py-1.5 flex items-center justify-between text-xs border-t border-gray-700">
      {/* Changes Status */}
      <div className="flex items-center gap-4">
        {hasChanges ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-yellow-400 font-medium">Unsaved changes:</span>
            <span className="text-gray-400">
              {annotationCount > 0 && (
                <>
                  {annotationCount} annotation{annotationCount !== 1 ? "s" : ""}
                </>
              )}
              {annotationCount > 0 && textEditCount > 0 && ", "}
              {textEditCount > 0 && (
                <>
                  {textEditCount} text edit{textEditCount !== 1 ? "s" : ""}
                </>
              )}
            </span>
            <span className="text-green-400 ml-2">
              • Original will be preserved in version history
            </span>
          </span>
        ) : (
          <span className="text-gray-400">No unsaved changes</span>
        )}
      </div>

      {/* Tool and Zoom Info */}
      <div className="flex items-center gap-4 text-gray-400">
        <span>Tool: {getToolName(activeTool)}</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span className="text-blue-400">{getToolHint(activeTool)}</span>
      </div>
    </div>
  );
}
