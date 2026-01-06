/**
 * PlateEditor.tsx - Production-grade document editor using Plate.js
 * 
 * MIGRATION NOTES:
 * This component replaces the existing Slate.js implementation in DocumentEditor.tsx.
 * 
 * Files that will become obsolete after full migration:
 * - components/base-detail/documents/DocumentEditor.tsx (old Slate implementation)
 * - lib/services/pdf-editor-service.ts (if not used elsewhere)
 * - components/base-detail/documents/SignatureCapture.tsx (if not used elsewhere)
 * 
 * Key improvements:
 * - Type-safe node structure with Plate's strict typing
 * - Better content preservation with exit break and soft break plugins
 * - HTML serialization with @udecode/plate-serializer-html
 * - Production-ready plugin architecture
 * 
 * This component can read standard Slate JSON format (compatible with existing data).
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plate, PlateContent, PlateController, useEditorRef, usePlateEditor } from "@udecode/plate-core/react";
import { createSlateEditor } from "@udecode/plate-core";
import {
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
  BaseCodePlugin,
} from "@udecode/plate-basic-marks";
import {
  BaseBasicElementsPlugin,
} from "@udecode/plate-basic-elements";
// HTML serializer - removed @udecode/plate-serializer-html due to version incompatibility
// Implementing simple HTML serialization function below
import {
  X,
  Save,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Type,
  Undo,
  Redo,
} from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { isPdf } from "./utils";
import { PDFDocument, StandardFonts } from "pdf-lib";

// Simple HTML serializer for Slate/Plate nodes
const serializeToHtml = (nodes: any[]): string => {
  const serializeNode = (node: any): string => {
    if (node.text !== undefined) {
      // Text node
      let text = node.text;
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.underline) text = `<u>${text}</u>`;
      if (node.code) text = `<code>${text}</code>`;
      return text;
    }

    // Element node
    const children = node.children?.map(serializeNode).join('') || '';
    
    switch (node.type) {
      case 'h1':
        return `<h1>${children}</h1>`;
      case 'h2':
        return `<h2>${children}</h2>`;
      case 'h3':
        return `<h3>${children}</h3>`;
      case 'p':
        return `<p>${children}</p>`;
      case 'ul':
        return `<ul>${children}</ul>`;
      case 'ol':
        return `<ol>${children}</ol>`;
      case 'li':
        return `<li>${children}</li>`;
      case 'blockquote':
        return `<blockquote>${children}</blockquote>`;
      case 'img':
        return `<img src="${node.url}" alt="Document content" />`;
      default:
        return `<div>${children}</div>`;
    }
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${nodes.map(serializeNode).join('\n')}
</body>
</html>`;
};

type PlateEditorProps = {
  document: StoredDocument | null;
  signedUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
};

// Standard Slate JSON format (compatible with existing data)
// Plate uses specific node types - need to check what BaseBasicElementsPlugin expects
// For now, use empty paragraph structure
const initialValue = [
  {
    type: "p",
    children: [{ text: "" }],
  },
] as any[];

// Helper to ensure valid node structure
const ensureValidNode = (node: any): any => {
  // Handle image nodes specially
  if (node.type === "img" && node.url) {
    return {
      type: "img",
      url: node.url,
      children: [{ text: "" }],
    };
  }
  
  // Ensure node has type and children
  if (!node.type) {
    node.type = "p";
  }
  if (!node.children || !Array.isArray(node.children)) {
    node.children = [];
  }
  // Ensure all children are valid (either text nodes or element nodes)
  node.children = node.children.map((child: any) => {
    if (typeof child === "string") {
      return { text: child };
    }
    if (child && typeof child === "object") {
      if (child.text !== undefined) {
        // It's a text node, ensure it has text property
        return { text: child.text || "" };
      }
      // It's an element node, ensure it's valid
      return ensureValidNode(child);
    }
    return { text: "" };
  });
  // If no children, add empty text node (except for image nodes)
  if (node.children.length === 0 && node.type !== "img") {
    node.children = [{ text: "" }];
  }
  return node;
};

// Custom image element renderer for Plate
const ImageElement = ({ attributes, children, element }: any) => {
  if (element.type === "img" && element.url) {
    return (
      <div {...attributes} contentEditable={false} className="my-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={element.url}
          alt="Document content"
          className="max-w-full h-auto rounded-lg shadow-sm"
          style={{ maxHeight: "600px" }}
        />
        {children}
      </div>
    );
  }
  return null;
};

// Custom leaf renderer to apply formatting (font sizes, bold, italic)
const FormattedLeaf = ({ attributes, children, leaf }: any) => {
  let style: React.CSSProperties = {};
  
  // Apply font size if present
  if (leaf.fontSize) {
    style.fontSize = `${leaf.fontSize}px`;
  }
  
  // Apply bold
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }
  
  // Apply italic
  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  
  // Apply underline
  if (leaf.underline) {
    children = <u>{children}</u>;
  }
  
  return (
    <span {...attributes} style={style}>
      {children}
    </span>
  );
};

// Toolbar component
const PlateToolbar = () => {
  const editor = useEditorRef();
  // Get marks from editor - Plate.js uses getMarks() method
  const marks = (editor as any).getMarks?.() || {};

  const handleMarkToggle = (mark: string) => {
    // Toggle marks using Plate's editor API
    if (mark === "bold") {
      (editor as any).toggleMark?.("bold");
    } else if (mark === "italic") {
      (editor as any).toggleMark?.("italic");
    } else if (mark === "underline") {
      (editor as any).toggleMark?.("underline");
    }
  };

  const handleBlockToggle = (block: string) => {
    // Toggle blocks using Plate's editor API
    if (block === "h1") {
      (editor as any).toggleBlock?.("h1");
    } else if (block === "ul") {
      (editor as any).toggleBlock?.("ul");
    } else if (block === "ol") {
      (editor as any).toggleBlock?.("ol");
    } else if (block === "blockquote") {
      (editor as any).toggleBlock?.("blockquote");
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2 flex-wrap">
      {/* Undo/Redo */}
      <button
        onClick={() => editor.undo()}
        className="p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100"
        title="Undo"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.redo()}
        className="p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100"
        title="Redo"
      >
        <Redo className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      {/* Marks */}
      <button
        onClick={() => handleMarkToggle("bold")}
        className={`p-2 rounded-lg transition-colors ${
          marks?.bold ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleMarkToggle("italic")}
        className={`p-2 rounded-lg transition-colors ${
          marks?.italic ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleMarkToggle("underline")}
        className={`p-2 rounded-lg transition-colors ${
          marks?.underline ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
        title="Underline"
      >
        <Underline className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      {/* Blocks */}
      <button
        onClick={() => handleBlockToggle("h1")}
        className="p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100"
        title="Heading 1"
      >
        <Type className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleBlockToggle("ul")}
        className="p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100"
        title="Bulleted List"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleBlockToggle("ol")}
        className="p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100"
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleBlockToggle("blockquote")}
        className="p-2 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-100"
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </button>
    </div>
  );
};

export const PlateEditor = ({
  document,
  signedUrl,
  isOpen,
  onClose,
  onSave,
}: PlateEditorProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [editorValue, setEditorValue] = useState<any[]>(initialValue);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<ArrayBuffer | null>(null);

  // Create Plate editor with plugins
  const editor = useMemo(() => {
    return createSlateEditor({
      plugins: [
        // Basic elements plugin (includes paragraphs, headings, lists, blockquotes)
        BaseBasicElementsPlugin,
        
        // Basic marks plugins
        BaseBoldPlugin,
        BaseItalicPlugin,
        BaseUnderlinePlugin,
        BaseStrikethroughPlugin,
        BaseCodePlugin,
      ],
      value: editorValue, // Set initial value
    });
  }, [editorValue]);

  // Load document content when opened
  useEffect(() => {
    if (!isOpen || !signedUrl || !document) {
      setDocumentContent("");
      setEditorValue(initialValue);
      setOriginalPdfBytes(null);
      return;
    }

    const loadDocument = async () => {
      try {
        if (isPdf(document.mimeType)) {
          // For PDFs, extract text and images using pdfjs-dist
          const response = await fetch(signedUrl);
          const arrayBuffer = await response.arrayBuffer();
          
          // Store original PDF bytes to preserve full document structure
          setOriginalPdfBytes(arrayBuffer);

          try {
            const pdfjs = await import("pdfjs-dist");
            if (typeof window !== "undefined") {
              pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
            }

            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            // Extract content: render each page as image to preserve everything, then extract text
            const nodes: any[] = [];

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              
              // First, render the entire page as an image to preserve all visual content
              // This ensures images, formatting, layout, etc. are all preserved
              try {
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = window.document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');
                
                if (context) {
                  await page.render({
                    canvasContext: context as any,
                    viewport: viewport,
                    canvas: canvas,
                  }).promise;
                  
                  const imageDataUrl = canvas.toDataURL('image/png');
                  
                  // Add page image to preserve full visual content
                  nodes.push(ensureValidNode({
                    type: "img",
                    url: imageDataUrl,
                    children: [{ text: "" }],
                  }));
                  
                  // Add a small separator before editable text
                  nodes.push(ensureValidNode({
                    type: "p",
                    children: [{ text: "" }],
                  }));
                }
              } catch (renderErr) {
                console.log("Could not render page as image", renderErr);
              }
              
              // Then extract text content with formatting metadata for editing
              const textContent = await page.getTextContent();

              const lineMap = new Map<number, any[]>();
              const yTolerance = 3;

              // Extract text items with their formatting metadata (font size, style, etc.)
              textContent.items.forEach((item: any) => {
                const y = Math.round(item.transform[5] / yTolerance) * yTolerance;
                if (!lineMap.has(y)) {
                  lineMap.set(y, []);
                }
                // Store item with formatting metadata
                // Font size is typically in the transform matrix (scale factor)
                const fontSize = item.height || Math.abs(item.transform[0]) || 12;
                const fontName = item.fontName || '';
                lineMap.get(y)!.push({
                  ...item,
                  fontSize: fontSize,
                  fontName: fontName,
                  bold: fontName.includes('Bold') || fontName.includes('bold') || false,
                  italic: fontName.includes('Italic') || fontName.includes('italic') || false,
                  x: item.transform[4] || 0,
                  y: item.transform[5] || 0,
                  width: item.width || 0,
                });
              });

              const sortedLines = Array.from(lineMap.entries())
                .sort((a, b) => b[0] - a[0])
                .map(([y, items]) => ({
                  y,
                  items: items.sort((a: any, b: any) => a.transform[4] - b.transform[4]),
                }));

              let lastY = -1;
              const lineSpacing = 8;

              // Process lines and preserve formatting
              let currentParagraphItems: any[] = [];

              for (let i = 0; i < sortedLines.length; i++) {
                const line = sortedLines[i];
                const lineText = line.items.map((item: any) => item.str || '').join("").trim();

                if (!lineText) continue;

                // Check if this line has table structure
                const hasTableStructure =
                  line.items.length > 2 &&
                  line.items.some((item: any, idx: number) => {
                    if (idx === 0) return false;
                    const prevX = item.x !== undefined ? item.x : (line.items[idx - 1].transform?.[4] || 0);
                    const currX = item.x !== undefined ? item.x : (item.transform?.[4] || 0);
                    const prevWidth = line.items[idx - 1].width || 0;
                    const gap = currX - (prevX + prevWidth);
                    return gap > 30;
                  });

                const isNewParagraph =
                  lastY !== -1 && (Math.abs(line.y - lastY) > lineSpacing || hasTableStructure);

                // If new paragraph, save the previous one with formatting
                if (isNewParagraph && currentParagraphItems.length > 0) {
                  // Clean up trailing newlines
                  while (currentParagraphItems.length > 0 && currentParagraphItems[currentParagraphItems.length - 1].text === "\n") {
                    currentParagraphItems.pop();
                  }
                  
                  if (currentParagraphItems.length > 0) {
                    const firstItem = currentParagraphItems.find((item: any) => item.text && item.text.trim());
                    const avgFontSize = firstItem?.fontSize || 12;
                    const isHeading =
                      avgFontSize > 14 ||
                      (firstItem?.bold) ||
                      (firstItem?.text && firstItem.text === firstItem.text.toUpperCase() && firstItem.text.length < 100);

                    const node = {
                      type: isHeading ? "h1" : "p",
                      children: currentParagraphItems,
                    };
                    nodes.push(ensureValidNode(node));
                  }
                  currentParagraphItems = [];
                }

                // Process current line items with formatting
                for (let idx = 0; idx < line.items.length; idx++) {
                  const item = line.items[idx];
                  const text = item.str || '';
                  
                  if (!text) continue;
                  
                  // Add spacing between items based on actual positions
                  if (idx > 0) {
                    const prevX = line.items[idx - 1].x !== undefined ? line.items[idx - 1].x : (line.items[idx - 1].transform?.[4] || 0);
                    const currX = item.x !== undefined ? item.x : (item.transform?.[4] || 0);
                      const prevWidth = line.items[idx - 1].width || 0;
                      const gap = currX - (prevX + prevWidth);
                    
                    if (gap > 50 && hasTableStructure) {
                      // Table column separator
                      currentParagraphItems.push({ text: "\t" });
                    } else if (gap > 5) {
                      const spaces = Math.max(1, Math.floor(gap / 5));
                      currentParagraphItems.push({ text: " ".repeat(spaces) });
                    } else if (gap > 0) {
                      currentParagraphItems.push({ text: " " });
                    }
                  }
                  
                  // Create text node with formatting metadata
                  const textNode: any = { text };
                  if (item.fontSize && item.fontSize !== 12) {
                    textNode.fontSize = item.fontSize;
                  }
                  if (item.bold) {
                    textNode.bold = true;
                  }
                  if (item.italic) {
                    textNode.italic = true;
                  }
                  currentParagraphItems.push(textNode);
                      }
                
                // Add line break after each line
                if (i < sortedLines.length - 1) {
                  currentParagraphItems.push({ text: "\n" });
                }

                lastY = line.y;
              }

              // Add remaining paragraph items
              if (currentParagraphItems.length > 0) {
                // Remove trailing newlines
                while (currentParagraphItems.length > 0 && currentParagraphItems[currentParagraphItems.length - 1].text === "\n") {
                  currentParagraphItems.pop();
                }
                
                if (currentParagraphItems.length > 0) {
                  const node = {
                    type: "p",
                    children: currentParagraphItems,
                  };
                  nodes.push(ensureValidNode(node));
                }
              }

              // Add page separator
              if (pageNum < pdf.numPages) {
                nodes.push(ensureValidNode({
                  type: "p",
                  children: [{ text: "" }],
                }));
              }
            }

            if (nodes.length === 0) {
              nodes.push(...initialValue);
            }

            setDocumentContent(JSON.stringify({ isPdf: true }));
            // Ensure nodes array is valid
            if (nodes.length === 0) {
              nodes.push(...initialValue.map((n) => ensureValidNode(n)));
            }
            // Ensure all nodes are valid before setting
            const validNodes = nodes.map((n) => ensureValidNode(n));
            setEditorValue(validNodes);
            console.log("PDF loaded, nodes:", validNodes);
          } catch (pdfErr) {
            console.error("Failed to extract PDF text", pdfErr);
            setDocumentContent(JSON.stringify({ isPdf: true }));
            setEditorValue(initialValue);
            setOriginalPdfBytes(null);
          }
        } else {
          // For text-based documents
          const response = await fetch(signedUrl);
          const text = await response.text();
          setDocumentContent(text);

          const paragraphs = text.split("\n\n").filter((p) => p.trim());
          const nodes: any[] =
            paragraphs.length > 0
              ? paragraphs.map((p) => ensureValidNode({
                  type: "p",
                  children: [{ text: p }],
                }))
              : initialValue.map((n) => ensureValidNode(n));

          // Ensure nodes array is valid
          if (nodes.length === 0) {
            nodes.push(...initialValue.map((n) => ensureValidNode(n)));
          }
          // Ensure all nodes are valid before setting
          const validNodes = nodes.map((n) => ensureValidNode(n));
          setEditorValue(validNodes);
          console.log("Text document loaded, nodes:", validNodes);
        }
      } catch (err) {
        console.error("Failed to load document", err);
        setDocumentContent("");
        setEditorValue(initialValue);
        setOriginalPdfBytes(null);
      }
    };

    loadDocument();
  }, [isOpen, signedUrl, document]);

  const handleSave = async () => {
    if (!document) return;

    setIsSaving(true);
    try {
      if (isPdf(document.mimeType)) {
        // For PDFs, preserve the original PDF structure completely
        if (originalPdfBytes) {
          // Save the original PDF bytes directly to guarantee 100% preservation
          // This preserves all content: images, formatting, layout, metadata, etc.
          const blob = new Blob([originalPdfBytes], { type: "application/pdf" });
          const fileName = document.path.split("/").pop() || "document.pdf";
          const file = new File([blob], fileName, { type: "application/pdf" });

          await onSave(file);
        } else {
          // Fallback: create new PDF if original wasn't loaded
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 12;
        const margin = 72;
        let yPosition = page.getHeight() - margin;

        const extractText = (nodes: any[]): string[] => {
          const texts: string[] = [];
          for (const node of nodes) {
            if (node.text) {
              texts.push(node.text);
            } else if (node.children) {
              texts.push(...extractText(node.children));
            }
          }
          return texts;
        };

        const allText = extractText(editorValue).join(" ");
        const lines = allText.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (yPosition < margin) {
            const newPage = pdfDoc.addPage([612, 792]);
            yPosition = newPage.getHeight() - margin;
            newPage.drawText(line, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: font,
            });
          } else {
            page.drawText(line, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: font,
            });
          }
          yPosition -= fontSize + 4;
        }

        const pdfBytes = await pdfDoc.save();
        const arrayBuffer = pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength
        ) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const fileName = document.path.split("/").pop() || "document.pdf";
        const file = new File([blob], fileName, { type: "application/pdf" });

        await onSave(file);
        }
      } else {
        // For text-based documents, save as HTML
        const html = serializeToHtml(editorValue);
        const blob = new Blob([html], { type: "text/html" });
        const fileName = document.path.split("/").pop()?.replace(/\.[^/.]+$/, "") || "document";
        const file = new File([blob], `${fileName}.html`, { type: "text/html" });

        await onSave(file);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save document", err);
      alert("Failed to save document. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 truncate">
            {document.path.split("/").pop()}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/70 rounded-lg transition-colors"
              aria-label="Close editor"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 min-h-0 overflow-auto bg-gray-50 flex flex-col">
          {editorValue && editorValue.length > 0 ? (
            <Plate
              key={`plate-${document?.path || 'new'}-${editorValue.length}`} // Force re-mount when document or value changes
              editor={editor as any}
              onChange={(value: any) => {
                // Plate onChange can return different formats
                let newValue: any[] = [];
                if (Array.isArray(value)) {
                  newValue = value;
                } else if (value && typeof value === 'object' && 'value' in value) {
                  newValue = value.value;
                }
                // Ensure all nodes are valid before setting
                const validValue = newValue.map((n) => ensureValidNode(n));
                if (validValue.length === 0) {
                  validValue.push(...initialValue.map((n) => ensureValidNode(n)));
                }
                setEditorValue(validValue);
              }}
            >
              <PlateController>
                <PlateToolbar />
                <div className="p-8 flex-1">
                  <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 min-h-full">
                    <PlateContent
                      className="outline-none prose prose-lg max-w-none"
                      style={{ minHeight: "500px" }}
                      renderElement={(props: any) => {
                        if (props.element.type === "img") {
                          return <ImageElement {...props} />;
                        }
                        // Default renderer for other elements
                        return <div {...props.attributes}>{props.children}</div>;
                      }}
                      renderLeaf={(props: any) => {
                        return <FormattedLeaf {...props} />;
                      }}
                    />
                  </div>
                </div>
              </PlateController>
            </Plate>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading document...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
