/**
 * Text Edit Overlay
 * Inline text editing input that appears over PDF text
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import type { TextItem, TextFormatting } from "../types";
import { useAnnotationStore } from "../hooks/useAnnotationStore";

interface TextEditOverlayProps {
  textItem: TextItem;
  textIndex: number;
  pageIndex: number;
  pageHeight: number;
  zoom: number;
  formatting: TextFormatting;
  onClose: () => void;
}

export function TextEditOverlay({
  textItem,
  textIndex,
  pageIndex,
  pageHeight,
  zoom,
  formatting,
  onClose,
}: TextEditOverlayProps) {
  const { findTextEdit, addTextEdit, updateAnnotation, removeAnnotation, selectAnnotation } =
    useAnnotationStore();

  // Check if there's an existing edit for this text
  const existingEdit = findTextEdit(
    pageIndex,
    textItem.str,
    textItem.x,
    textItem.y
  );

  const [text, setText] = useState(existingEdit?.content ?? textItem.str);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChanges = text !== (existingEdit?.content ?? textItem.str);
  const isModified = text !== textItem.str;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const trimmedText = text.trim();

    if (trimmedText === textItem.str) {
      // Reverted to original - remove any existing edit
      if (existingEdit) {
        removeAnnotation(existingEdit.id);
      }
    } else if (existingEdit) {
      // Update existing edit with formatting
      updateAnnotation(existingEdit.id, { 
        content: trimmedText,
        fontSize: formatting.fontSize,
        color: formatting.color,
        fontFamily: formatting.fontFamily,
        fontWeight: formatting.fontWeight,
        fontStyle: formatting.fontStyle,
        textDecoration: formatting.textDecoration,
        backgroundColor: formatting.backgroundColor,
      });
      selectAnnotation(existingEdit.id);
    } else {
      // Create new edit with formatting
      const newId = addTextEdit(
        pageIndex,
        textItem.x,
        textItem.y,
        textItem.width,
        textItem.height,
        textItem.str,
        trimmedText,
        textItem.fontSize,
        formatting
      );
      selectAnnotation(newId);
    }

    onClose();
  };

  const handleRevert = () => {
    setText(textItem.str);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    // Backspace and Delete work naturally in input
  };

  // Position the input at the text location
  // textItem.y is already in screen-like coordinates (top-down)
  const style: React.CSSProperties = {
    position: "absolute",
    left: textItem.x * zoom - 2,
    top: textItem.y * zoom - 2,
    zIndex: 1000,
  };

  return (
    <div style={style} className="flex flex-col">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="outline-none border-2 border-blue-500 rounded-sm shadow-lg"
          style={{
            fontSize: formatting.fontSize * zoom,
            lineHeight: 1.2,
            padding: "2px 6px",
            minWidth: Math.max(textItem.width * zoom + 40, 120),
            fontFamily: formatting.fontFamily,
            fontWeight: formatting.fontWeight,
            fontStyle: formatting.fontStyle,
            textDecoration: formatting.textDecoration === "none" ? undefined : formatting.textDecoration,
            color: formatting.color,
            backgroundColor: formatting.backgroundColor === "transparent" ? "white" : formatting.backgroundColor,
          }}
        />
        
        {/* Action buttons */}
        <div className="flex gap-0.5">
          {isModified && (
            <button
              onClick={handleRevert}
              className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              title="Revert to original"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleSave}
            className="p-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            title="Save changes (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors"
            title="Cancel (Escape)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Helper text */}
      <div className="text-xs text-gray-500 mt-1 bg-white/90 px-1 rounded">
        Enter to save • Escape to cancel
      </div>
    </div>
  );
}
