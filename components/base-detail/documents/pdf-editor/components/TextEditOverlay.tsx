/**
 * Text Edit Overlay
 * Inline text editing input that appears over PDF text
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import type { TextItem } from "../types";
import { useAnnotationStore } from "../hooks/useAnnotationStore";

interface TextEditOverlayProps {
  textItem: TextItem;
  textIndex: number;
  pageIndex: number;
  pageHeight: number;
  zoom: number;
  onClose: () => void;
}

export function TextEditOverlay({
  textItem,
  textIndex,
  pageIndex,
  pageHeight,
  zoom,
  onClose,
}: TextEditOverlayProps) {
  const { findTextEdit, addTextEdit, updateAnnotation, removeAnnotation } =
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
      // Update existing edit
      updateAnnotation(existingEdit.id, { content: trimmedText });
    } else {
      // Create new edit
      addTextEdit(
        pageIndex,
        textItem.x,
        textItem.y,
        textItem.width,
        textItem.height,
        textItem.str,
        trimmedText,
        textItem.fontSize
      );
    }

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      // Revert and close
      onClose();
    }
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
    <div style={style}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className="bg-white text-black outline-none border-2 border-blue-500 rounded-sm shadow-lg"
        style={{
          fontSize: textItem.fontSize * zoom,
          lineHeight: 1.2,
          padding: "2px 4px",
          minWidth: Math.max(textItem.width * zoom + 20, 80),
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      />
    </div>
  );
}
