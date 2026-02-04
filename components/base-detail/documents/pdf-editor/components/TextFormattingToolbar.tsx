/**
 * Text Formatting Toolbar
 * Secondary toolbar that appears when edit/text tool is active
 * Provides font, style, and color formatting options
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Paintbrush,
  Type,
  ChevronDown,
  Palette,
} from "lucide-react";
import type { TextFormatting } from "../types";
import { FONT_FAMILIES, FONT_SIZES } from "../types";

interface TextFormattingToolbarProps {
  formatting: TextFormatting;
  onFormattingChange: (formatting: Partial<TextFormatting>) => void;
  disabled?: boolean;
}

// Preset colors for quick selection
const PRESET_COLORS = [
  "#000000", // Black
  "#374151", // Gray 700
  "#6B7280", // Gray 500
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#FFFFFF", // White
];

const BACKGROUND_COLORS = [
  "transparent",
  "#FEF3C7", // Yellow light
  "#DCFCE7", // Green light
  "#DBEAFE", // Blue light
  "#FCE7F3", // Pink light
  "#F3E8FF", // Purple light
  "#FEE2E2", // Red light
  "#FFEDD5", // Orange light
  "#E0E7FF", // Indigo light
  "#ECFEFF", // Cyan light
  "#F5F5F4", // Gray light
  "#FFFFFF", // White
];

export function TextFormattingToolbar({
  formatting,
  onFormattingChange,
  disabled = false,
}: TextFormattingToolbarProps) {
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const textColorRef = useRef<HTMLDivElement>(null);
  const bgColorRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setShowFontDropdown(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target as Node)) {
        setShowSizeDropdown(false);
      }
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node)) {
        setShowTextColorPicker(false);
      }
      if (bgColorRef.current && !bgColorRef.current.contains(e.target as Node)) {
        setShowBgColorPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleBold = () => {
    onFormattingChange({
      fontWeight: formatting.fontWeight === "bold" ? "normal" : "bold",
    });
  };

  const toggleItalic = () => {
    onFormattingChange({
      fontStyle: formatting.fontStyle === "italic" ? "normal" : "italic",
    });
  };

  const toggleUnderline = () => {
    onFormattingChange({
      textDecoration: formatting.textDecoration === "underline" ? "none" : "underline",
    });
  };

  const toggleStrikethrough = () => {
    onFormattingChange({
      textDecoration: formatting.textDecoration === "line-through" ? "none" : "line-through",
    });
  };

  return (
    <div className="bg-gray-750 px-4 py-2 flex items-center gap-3 border-b border-gray-700 animate-slideDown relative z-[100]">
      {/* Label */}
      <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium uppercase tracking-wide">
        <Type className="w-3.5 h-3.5" />
        <span>Text Format</span>
      </div>

      <div className="w-px h-5 bg-gray-600" />

      {/* Font Family Dropdown */}
      <div ref={fontDropdownRef} className="relative">
        <button
          onClick={() => setShowFontDropdown(!showFontDropdown)}
          disabled={disabled}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm min-w-[140px] justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ fontFamily: formatting.fontFamily }}
        >
          <span className="truncate">{formatting.fontFamily}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </button>
        
        {showFontDropdown && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-[1000] max-h-64 overflow-y-auto">
            {FONT_FAMILIES.map((font) => (
              <button
                key={font}
                onClick={() => {
                  onFormattingChange({ fontFamily: font });
                  setShowFontDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                  formatting.fontFamily === font ? "bg-blue-600 text-white" : "text-gray-200"
                }`}
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size Dropdown */}
      <div ref={sizeDropdownRef} className="relative">
        <button
          onClick={() => setShowSizeDropdown(!showSizeDropdown)}
          disabled={disabled}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm min-w-[70px] justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>{formatting.fontSize}px</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </button>
        
        {showSizeDropdown && (
          <div className="absolute top-full left-0 mt-1 w-24 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-[1000] max-h-64 overflow-y-auto">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => {
                  onFormattingChange({ fontSize: size });
                  setShowSizeDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                  formatting.fontSize === size ? "bg-blue-600 text-white" : "text-gray-200"
                }`}
              >
                {size}px
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-600" />

      {/* Style Buttons */}
      <div className="flex items-center gap-0.5 bg-gray-700 rounded-lg p-0.5">
        <FormatButton
          active={formatting.fontWeight === "bold"}
          onClick={toggleBold}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          icon={<Bold className="w-4 h-4" />}
        />
        <FormatButton
          active={formatting.fontStyle === "italic"}
          onClick={toggleItalic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          icon={<Italic className="w-4 h-4" />}
        />
        <FormatButton
          active={formatting.textDecoration === "underline"}
          onClick={toggleUnderline}
          disabled={disabled}
          title="Underline (Ctrl+U)"
          icon={<Underline className="w-4 h-4" />}
        />
        <FormatButton
          active={formatting.textDecoration === "line-through"}
          onClick={toggleStrikethrough}
          disabled={disabled}
          title="Strikethrough"
          icon={<Strikethrough className="w-4 h-4" />}
        />
      </div>

      <div className="w-px h-5 bg-gray-600" />

      {/* Text Color Picker */}
      <div ref={textColorRef} className="relative">
        <button
          onClick={() => setShowTextColorPicker(!showTextColorPicker)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Text Color"
        >
          <div className="relative">
            <Type className="w-4 h-4" />
            <div
              className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-full"
              style={{ backgroundColor: formatting.color }}
            />
          </div>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {showTextColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-[1000]">
            <div className="text-xs text-gray-400 mb-2 font-medium">Text Color</div>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onFormattingChange({ color });
                    setShowTextColorPicker(false);
                  }}
                  className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                    formatting.color === color ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-600"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" />
              <input
                type="color"
                value={formatting.color}
                onChange={(e) => onFormattingChange({ color: e.target.value })}
                className="w-8 h-6 rounded cursor-pointer border-none bg-transparent"
                title="Custom color"
              />
              <input
                type="text"
                value={formatting.color}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    onFormattingChange({ color: e.target.value });
                  }
                }}
                className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="#000000"
              />
            </div>
          </div>
        )}
      </div>

      {/* Background Color Picker */}
      <div ref={bgColorRef} className="relative">
        <button
          onClick={() => setShowBgColorPicker(!showBgColorPicker)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Background Color"
        >
          <div className="relative">
            <Paintbrush className="w-4 h-4" />
            <div
              className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-full border border-gray-500"
              style={{ 
                backgroundColor: formatting.backgroundColor === "transparent" ? "transparent" : formatting.backgroundColor,
                backgroundImage: formatting.backgroundColor === "transparent" 
                  ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                  : "none",
                backgroundSize: "4px 4px",
                backgroundPosition: "0 0, 0 2px, 2px -2px, -2px 0px",
              }}
            />
          </div>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {showBgColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-[1000]">
            <div className="text-xs text-gray-400 mb-2 font-medium">Background</div>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {BACKGROUND_COLORS.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onFormattingChange({ backgroundColor: color });
                    setShowBgColorPicker(false);
                  }}
                  className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                    formatting.backgroundColor === color ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-600"
                  }`}
                  style={{ 
                    backgroundColor: color === "transparent" ? "white" : color,
                    backgroundImage: color === "transparent" 
                      ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                      : "none",
                    backgroundSize: "6px 6px",
                    backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
                  }}
                  title={color === "transparent" ? "No background" : color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" />
              <input
                type="color"
                value={formatting.backgroundColor === "transparent" ? "#ffffff" : formatting.backgroundColor}
                onChange={(e) => onFormattingChange({ backgroundColor: e.target.value })}
                className="w-8 h-6 rounded cursor-pointer border-none bg-transparent"
                title="Custom color"
              />
              <button
                onClick={() => onFormattingChange({ backgroundColor: "transparent" })}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-gray-500 text-xs">Preview:</span>
        <div
          className="px-3 py-1 rounded border border-gray-600 min-w-[80px] text-center"
          style={{
            fontFamily: formatting.fontFamily,
            fontSize: Math.min(formatting.fontSize, 16),
            fontWeight: formatting.fontWeight,
            fontStyle: formatting.fontStyle,
            textDecoration: formatting.textDecoration,
            color: formatting.color,
            backgroundColor: formatting.backgroundColor === "transparent" ? "transparent" : formatting.backgroundColor,
          }}
        >
          Sample
        </div>
      </div>
    </div>
  );
}

// Individual format button component
function FormatButton({
  active,
  onClick,
  disabled,
  title,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-300 hover:bg-gray-600 hover:text-white"
      }`}
      title={title}
    >
      {icon}
    </button>
  );
}

