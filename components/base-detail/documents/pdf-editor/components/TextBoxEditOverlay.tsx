/**
 * TextBox Edit Overlay
 * Inline text editing for existing textBox annotations
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, X, Trash2 } from "lucide-react";
import type { TextBoxAnnotation, TextFormatting } from "../types";
import { useAnnotationStore } from "../hooks/useAnnotationStore";
import { pdfToScreen, calculateAnnotationDimensions } from "../utils/coordinates";

interface TextBoxEditOverlayProps {
  annotation: TextBoxAnnotation;
  pageHeight: number;
  zoom: number;
  formatting: TextFormatting;
  onClose: () => void;
}

export function TextBoxEditOverlay({
  annotation,
  pageHeight,
  zoom,
  formatting,
  onClose,
}: TextBoxEditOverlayProps) {
  const { updateAnnotation, removeAnnotation, selectAnnotation } = useAnnotationStore();

  const [text, setText] = useState(annotation.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasChanges = text !== annotation.content;

  // Update text state when annotation changes (switching between annotations)
  useEffect(() => {
    setText(annotation.content);
  }, [annotation.id, annotation.content]);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, [annotation.id]); // Re-focus when annotation changes

  const handleSave = () => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      // Empty text - delete the annotation
      removeAnnotation(annotation.id);
    } else {
      // Calculate new dimensions based on content and formatting
      const dimensions = calculateAnnotationDimensions(
        trimmedText,
        formatting.fontSize,
        formatting.fontFamily,
        formatting.fontWeight,
        formatting.fontStyle
      );
      
      // Update the annotation with new text, formatting, and dimensions
      updateAnnotation(annotation.id, {
        content: trimmedText,
        width: dimensions.width,
        height: dimensions.height,
        fontSize: formatting.fontSize,
        color: formatting.color,
        fontFamily: formatting.fontFamily,
        fontWeight: formatting.fontWeight,
        fontStyle: formatting.fontStyle,
        textDecoration: formatting.textDecoration,
        backgroundColor: formatting.backgroundColor,
      });
      selectAnnotation(annotation.id);
    }

    onClose();
  };

  const handleDelete = () => {
    removeAnnotation(annotation.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Position the editor at the annotation location
  const screenPos = pdfToScreen(annotation.x, annotation.y + annotation.height, pageHeight, zoom);

  const style: React.CSSProperties = {
    position: "absolute",
    left: screenPos.x - 2,
    top: screenPos.y - 2,
    zIndex: 1000,
  };

  return (
    <div style={style} className="flex flex-col gap-1">
      <div className="flex items-start gap-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="outline-none border-2 border-blue-500 rounded-sm shadow-lg resize-none"
          style={{
            fontSize: formatting.fontSize * zoom,
            lineHeight: 1.4,
            padding: "4px 8px",
            minWidth: Math.max(annotation.width * zoom + 40, 180),
            minHeight: 40,
            fontFamily: formatting.fontFamily,
            fontWeight: formatting.fontWeight,
            fontStyle: formatting.fontStyle,
            textDecoration: formatting.textDecoration === "none" ? undefined : formatting.textDecoration,
            color: formatting.color,
            backgroundColor: formatting.backgroundColor === "transparent" ? "white" : formatting.backgroundColor,
          }}
          rows={2}
        />

        {/* Action buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleSave}
            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            title="Save changes (Ctrl+Enter)"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors"
            title="Cancel (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
            title="Delete annotation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="text-xs text-gray-500 bg-white/90 px-1 rounded">
        Ctrl+Enter to save • Escape to cancel
      </div>
    </div>
  );
}

