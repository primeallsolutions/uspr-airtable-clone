/**
 * PDF Editor Status Bar
 * Shows current tool, zoom, field counts, and unsaved changes status
 */

"use client";

import React from "react";
import { FileSignature, Pen, CalendarCheck } from "lucide-react";
import type { Tool } from "../types";
import { ZOOM_LEVELS } from "../types";

interface FieldCounts {
  signature: number;
  initial: number;
  date: number;
}

interface StatusBarProps {
  activeTool: Tool;
  zoomIndex: number;
  annotationCount: number;
  textEditCount: number;
  fieldCounts?: FieldCounts;
}

export function StatusBar({
  activeTool,
  zoomIndex,
  annotationCount,
  textEditCount,
  fieldCounts,
}: StatusBarProps) {
  const zoom = ZOOM_LEVELS[zoomIndex];
  const hasChanges = annotationCount > 0 || textEditCount > 0;
  const totalFields = fieldCounts 
    ? fieldCounts.signature + fieldCounts.initial + fieldCounts.date 
    : 0;

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
      case "signatureField":
        return "Signature Field";
      case "initialsField":
        return "Initials Field";
      case "dateField":
        return "Date Field";
      default:
        return tool;
    }
  };

  const getToolHint = (tool: Tool): { hint: string; tip?: string } => {
    switch (tool) {
      case "select":
        return { 
          hint: "Click to select, drag to move any text or annotation",
          tip: "💡 Want to reposition text? Just drag it!"
        };
      case "pan":
        return { hint: "Click and drag to scroll around the document" };
      case "highlight":
        return { hint: "Click and drag to create a highlight" };
      case "text":
        return { hint: "Click anywhere to add new text (Ctrl+Enter to save)" };
      case "edit":
        return { 
          hint: "Click on existing text to modify it",
          tip: "💡 Use Select tool (V) to move text after editing"
        };
      case "signature":
        return { hint: "Draw or upload your signature to place it" };
      case "signatureField":
        return { 
          hint: "Click to place a signature field",
          tip: "👆 Others will sign here when you request signatures"
        };
      case "initialsField":
        return { 
          hint: "Click to place an initials field",
          tip: "👆 Others will initial here when you request signatures"
        };
      case "dateField":
        return { 
          hint: "Click to place a date field",
          tip: "📅 This will auto-fill with the signing date"
        };
      default:
        return { hint: "" };
    }
  };

  return (
    <div className="bg-gray-800 px-4 py-1.5 flex items-center justify-between text-xs border-t border-gray-700">
      {/* Left side - Changes Status and Field Counts */}
      <div className="flex items-center gap-4">
        {hasChanges ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-yellow-400 font-medium">Unsaved:</span>
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
          </span>
        ) : (
          <span className="text-gray-500">No unsaved changes</span>
        )}

        {/* Signature Fields Summary */}
        {totalFields > 0 && (
          <div className="flex items-center gap-3 pl-4 border-l border-gray-600">
            <span className="text-gray-400">E-Sign Fields:</span>
            {fieldCounts && fieldCounts.signature > 0 && (
              <span className="flex items-center gap-1 text-purple-400">
                <FileSignature className="w-3 h-3" />
                {fieldCounts.signature}
              </span>
            )}
            {fieldCounts && fieldCounts.initial > 0 && (
              <span className="flex items-center gap-1 text-cyan-400">
                <Pen className="w-3 h-3" />
                {fieldCounts.initial}
              </span>
            )}
            {fieldCounts && fieldCounts.date > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <CalendarCheck className="w-3 h-3" />
                {fieldCounts.date}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side - Tool and Zoom Info */}
      <div className="flex items-center gap-4 text-gray-400">
        <span>Tool: <span className="text-white">{getToolName(activeTool)}</span></span>
        <span>Zoom: <span className="text-white">{Math.round(zoom * 100)}%</span></span>
        <span className="text-blue-400">{getToolHint(activeTool).hint}</span>
        {getToolHint(activeTool).tip && (
          <span className="text-amber-400 font-medium animate-pulse">{getToolHint(activeTool).tip}</span>
        )}
      </div>
    </div>
  );
}
