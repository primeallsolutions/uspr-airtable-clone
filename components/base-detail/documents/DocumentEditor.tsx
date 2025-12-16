"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createEditor, Descendant, Editor, Transforms, Text, Element as SlateElement, BaseEditor } from "slate";
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps, useSlate, ReactEditor } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import {
  X,
  Save,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Type,
  Image as ImageIcon,
  Link,
  Undo,
  Redo,
} from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { isPdf } from "./utils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

type DocumentEditorProps = {
  document: StoredDocument | null;
  signedUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
};

const initialValue: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];

// Custom element types
type CustomElement = {
  type: "paragraph" | "heading" | "bulleted-list" | "numbered-list" | "list-item" | "image" | "link";
  align?: "left" | "center" | "right";
  url?: string;
  children: CustomText[];
};

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
  color?: string;
};

type SlateEditor = BaseEditor & ReactEditor & HistoryEditor;

declare module "slate" {
  interface CustomTypes {
    Editor: SlateEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// Toolbar buttons
const ToolbarButton = ({
  icon: Icon,
  isActive,
  onClick,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick: () => void;
  title: string;
}) => (
  <button
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={`p-2 rounded-lg transition-colors ${
      isActive ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
    }`}
    title={title}
  >
    <Icon className="w-4 h-4" />
  </button>
);

// Format button component
const FormatButton = ({ format, icon: Icon }: { format: string; icon: React.ComponentType<{ className?: string }> }) => {
  const editor = useSlate();
  const isActive = isMarkActive(editor, format);

  return (
    <ToolbarButton
      icon={Icon}
      isActive={isActive}
      onClick={() => toggleMark(editor, format)}
      title={format.charAt(0).toUpperCase() + format.slice(1)}
    />
  );
};

// Block button component
const BlockButton = ({ format, icon: Icon }: { format: string; icon: React.ComponentType<{ className?: string }> }) => {
  const editor = useSlate();
  const isActive = isBlockActive(editor, format);

  return (
    <ToolbarButton
      icon={Icon}
      isActive={isActive}
      onClick={() => toggleBlock(editor, format)}
      title={format.charAt(0).toUpperCase() + format.slice(1)}
    />
  );
};

// Undo/Redo buttons - must be inside Slate context
const UndoRedoButtons = ({ editor }: { editor: SlateEditor }) => {
  const handleUndo = () => {
    HistoryEditor.undo(editor);
  };

  const handleRedo = () => {
    HistoryEditor.redo(editor);
  };

  return (
    <>
      <ToolbarButton
        icon={Undo}
        isActive={false}
        onClick={handleUndo}
        title="Undo"
      />
      <ToolbarButton
        icon={Redo}
        isActive={false}
        onClick={handleRedo}
        title="Redo"
      />
    </>
  );
};

// Check if mark is active
const isMarkActive = (editor: SlateEditor, format: string) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format as keyof typeof marks] === true : false;
};

// Toggle mark
const toggleMark = (editor: SlateEditor, format: string) => {
  const isActive = isMarkActive(editor, format);
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

// Check if block is active
const isBlockActive = (editor: SlateEditor, format: string) => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
    })
  );

  return !!match;
};

// Toggle block
const toggleBlock = (editor: Editor, format: string) => {
  const isActive = isBlockActive(editor, format);
  const isList = format === "bulleted-list" || format === "numbered-list";

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n.type === "bulleted-list" || n.type === "numbered-list"),
    split: true,
  });

  let newProperties: Partial<CustomElement>;
  if (format === "list-item") {
    newProperties = {
      type: isActive ? "paragraph" : "list-item",
    };
  } else if (isList) {
    newProperties = {
      type: isActive ? "paragraph" : "list-item",
    };
    Transforms.wrapNodes(editor, {
      type: format as CustomElement["type"],
      children: [],
    } as CustomElement);
  } else {
    newProperties = {
      type: isActive ? "paragraph" : (format as CustomElement["type"]),
    };
  }

  Transforms.setNodes<SlateElement>(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format as CustomElement["type"], children: [] };
    Transforms.wrapNodes(editor, block as CustomElement);
  }
};

// Render element
const Element = ({ attributes, children, element }: RenderElementProps) => {
  const style = { textAlign: element.align };

  switch (element.type) {
    case "heading":
      return (
        <h2 style={style} {...attributes} className="text-2xl font-bold mb-4">
          {children}
        </h2>
      );
    case "bulleted-list":
      return (
        <ul style={style} {...attributes} className="list-disc list-inside mb-4">
          {children}
        </ul>
      );
    case "numbered-list":
      return (
        <ol style={style} {...attributes} className="list-decimal list-inside mb-4">
          {children}
        </ol>
      );
    case "list-item":
      return (
        <li style={style} {...attributes}>
          {children}
        </li>
      );
    case "link":
      return (
        <a href={element.url} {...attributes} className="text-blue-600 underline">
          {children}
        </a>
      );
    default:
      return (
        <p style={style} {...attributes} className="mb-4">
          {children}
        </p>
      );
  }
};

// Render leaf
const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }
  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  if (leaf.underline) {
    children = <u>{children}</u>;
  }
  if (leaf.highlight) {
    children = <mark className="bg-yellow-200">{children}</mark>;
  }
  if (leaf.color) {
    children = <span style={{ color: leaf.color }}>{children}</span>;
  }

  return <span {...attributes}>{children}</span>;
};

export const DocumentEditor = ({
  document,
  signedUrl,
  isOpen,
  onClose,
  onSave,
}: DocumentEditorProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>("");
  const editor = useMemo(() => withHistory(withReact(createEditor())) as SlateEditor, []);

  // Load document content when opened
  useEffect(() => {
    if (!isOpen || !signedUrl || !document) {
      setDocumentContent("");
      return;
    }

    const loadDocument = async () => {
      try {
        if (isPdf(document.mimeType)) {
          // For PDFs, extract text using pdfjs-dist
          const response = await fetch(signedUrl);
          const arrayBuffer = await response.arrayBuffer();
          
          try {
            // Use pdfjs-dist to extract text
            const pdfjs = await import("pdfjs-dist");
            // Use local worker file (copied to public folder) or fallback to CDN
            if (typeof window !== "undefined") {
              pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
            }
            
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            // Extract text with position information to preserve structure
            const nodes: Descendant[] = [];
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              
              // Group text items by y-position (with tolerance for slight variations)
              const lineMap = new Map<number, any[]>();
              const yTolerance = 3; // Pixels tolerance for grouping lines
              
              textContent.items.forEach((item: any) => {
                const y = Math.round(item.transform[5] / yTolerance) * yTolerance; // Round to nearest tolerance
                if (!lineMap.has(y)) {
                  lineMap.set(y, []);
                }
                lineMap.get(y)!.push(item);
              });
              
              // Sort lines by y-position (top to bottom) and items by x-position (left to right)
              const sortedLines = Array.from(lineMap.entries())
                .sort((a, b) => b[0] - a[0]) // Higher y = top of page
                .map(([y, items]) => ({
                  y,
                  items: items.sort((a: any, b: any) => a.transform[4] - b.transform[4]), // Sort by x
                }));
              
              // Process lines and detect structure (paragraphs, tables, spacing)
              let currentParagraph: string[] = [];
              let lastY = -1;
              const lineSpacing = 8; // Threshold for detecting new paragraphs
              
              for (let i = 0; i < sortedLines.length; i++) {
                const line = sortedLines[i];
                const lineText = line.items
                  .map((item: any) => {
                    // Preserve spacing - add spaces between items that are far apart
                    return item.str;
                  })
                  .join(" ")
                  .trim();
                
                if (!lineText) continue;
                
                // Detect table-like structure (multiple items on same line with gaps)
                const hasTableStructure = line.items.length > 2 && 
                  line.items.some((item: any, idx: number) => {
                    if (idx === 0) return false;
                    const prevX = line.items[idx - 1].transform[4];
                    const currX = item.transform[4];
                    const gap = currX - (prevX + (line.items[idx - 1].width || 50));
                    return gap > 30; // Significant gap suggests table column
                  });
                
                // Detect if this is a new paragraph based on spacing
                const isNewParagraph = lastY !== -1 && 
                  (Math.abs(line.y - lastY) > lineSpacing || hasTableStructure);
                
                if (isNewParagraph && currentParagraph.length > 0) {
                  // Save current paragraph
                  const paraText = currentParagraph.join("\n");
                  if (paraText.trim()) {
                    // Detect if it's a heading (larger font, bold, or all caps)
                    const firstItem = sortedLines[i - 1]?.items?.[0];
                    const isHeading = firstItem && (
                      (firstItem.height && firstItem.height > 14) ||
                      (firstItem.fontName && firstItem.fontName.includes("Bold")) ||
                      (paraText === paraText.toUpperCase() && paraText.length < 100 && paraText.split(" ").length < 10)
                    );
                    
                    nodes.push({
                      type: isHeading ? "heading" : "paragraph",
                      children: [{ text: paraText.trim() }],
                    } as Descendant);
                  }
                  currentParagraph = [];
                }
                
                // For table-like structures, preserve spacing with tabs
                if (hasTableStructure) {
                  const tableRow = line.items
                    .map((item: any, idx: number) => {
                      if (idx === 0) return item.str;
                      const prevX = line.items[idx - 1].transform[4];
                      const currX = item.transform[4];
                      const prevWidth = line.items[idx - 1].width || 0;
                      const gap = currX - (prevX + prevWidth);
                      // Use tab character for significant gaps, spaces for smaller ones
                      if (gap > 50) {
                        return "\t" + item.str;
                      } else if (gap > 20) {
                        return "  " + item.str; // Two spaces
                      } else {
                        return " " + item.str; // Single space
                      }
                    })
                    .join("");
                  currentParagraph.push(tableRow);
                } else {
                  // For regular text, preserve original spacing between items
                  const spacedLine = line.items
                    .map((item: any, idx: number) => {
                      if (idx === 0) return item.str;
                      const prevX = line.items[idx - 1].transform[4];
                      const currX = item.transform[4];
                      const prevWidth = line.items[idx - 1].width || 0;
                      const gap = currX - (prevX + prevWidth);
                      // Add spacing based on actual gap
                      if (gap > 5) {
                        const spaces = Math.max(1, Math.floor(gap / 5));
                        return " ".repeat(spaces) + item.str;
                      }
                      return " " + item.str;
                    })
                    .join("");
                  currentParagraph.push(spacedLine);
                }
                
                lastY = line.y;
              }
              
              // Add remaining paragraph
              if (currentParagraph.length > 0) {
                const paraText = currentParagraph.join("\n");
                if (paraText.trim()) {
                  nodes.push({
                    type: "paragraph",
                    children: [{ text: paraText.trim() }],
                  } as Descendant);
                }
              }
              
              // Add page break indicator between pages
              if (pageNum < pdf.numPages) {
                nodes.push({
                  type: "paragraph",
                  children: [{ text: "" }], // Empty line for spacing
                } as Descendant);
              }
            }
            
            // If no nodes extracted, use initial value
            if (nodes.length === 0) {
              nodes.push(...initialValue);
            }
            
            // Store original PDF for reference
            setDocumentContent(JSON.stringify({ isPdf: true }));
            
            Transforms.removeNodes(editor, { at: [0] });
            Transforms.insertNodes(editor, nodes);
          } catch (pdfErr) {
            console.error("Failed to extract PDF text", pdfErr);
            // Fallback: initialize with empty content
            setDocumentContent(JSON.stringify({ isPdf: true }));
            Transforms.removeNodes(editor, { at: [0] });
            Transforms.insertNodes(editor, initialValue);
          }
        } else {
          // For text-based documents, fetch and parse
          const response = await fetch(signedUrl);
          const text = await response.text();
          setDocumentContent(text);
          
          // Parse text into Slate format (simplified)
          const paragraphs = text.split("\n\n").filter((p) => p.trim());
          const nodes: Descendant[] = paragraphs.length > 0
            ? paragraphs.map((p) => ({
                type: "paragraph" as const,
                children: [{ text: p }],
              }))
            : initialValue;
          
          Transforms.removeNodes(editor, { at: [0] });
          Transforms.insertNodes(editor, nodes);
        }
      } catch (err) {
        console.error("Failed to load document", err);
        setDocumentContent("");
      }
    };

    loadDocument();
  }, [isOpen, signedUrl, document, editor]);

  const handleSave = async () => {
    if (!document) return;

    setIsSaving(true);
    try {
      if (isPdf(document.mimeType)) {
        // For PDFs, convert Slate content to PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]); // US Letter size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 12;
        const margin = 72;
        let yPosition = page.getHeight() - margin;
        
        // Get all text from Slate editor
        const extractText = (nodes: Descendant[]): string[] => {
          const texts: string[] = [];
          for (const node of nodes) {
            if (Text.isText(node)) {
              texts.push(node.text);
            } else if (SlateElement.isElement(node)) {
              texts.push(...extractText(node.children));
            }
          }
          return texts;
        };
        
        const allText = extractText(editor.children).join(" ");
        const lines = allText.split("\n").filter(line => line.trim());
        
        // Add text to PDF page
        for (const line of lines) {
          if (yPosition < margin) {
            // Add new page if needed
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
          yPosition -= fontSize + 4; // Line spacing
        }
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        // Convert Uint8Array to ArrayBuffer for Blob
        const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const fileName = document.path.split("/").pop() || "document.pdf";
        const file = new File([blob], fileName, { type: "application/pdf" });
        
        await onSave(file);
      } else {
        // For text-based documents, convert to HTML
        const html = serializeToHtml(editor);
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

  // Serialize Slate content to HTML
  const serializeToHtml = (editor: Editor): string => {
    const children = editor.children;
    return children.map((node) => serializeNode(node)).join("");
  };

  const serializeNode = (node: Descendant): string => {
    if (Text.isText(node)) {
      let text = node.text;
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.underline) text = `<u>${text}</u>`;
      if (node.highlight) text = `<mark>${text}</mark>`;
      return text;
    }

    const children = node.children.map((n) => serializeNode(n)).join("");

    switch (node.type) {
      case "heading":
        return `<h2>${children}</h2>`;
      case "bulleted-list":
        return `<ul>${children}</ul>`;
      case "numbered-list":
        return `<ol>${children}</ol>`;
      case "list-item":
        return `<li>${children}</li>`;
      case "link":
        return `<a href="${node.url}">${children}</a>`;
      default:
        return `<p>${children}</p>`;
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
          <Slate editor={editor} initialValue={initialValue}>
            {/* Toolbar - inside Slate context */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2 flex-wrap sticky top-0 z-10">
              <UndoRedoButtons editor={editor} />
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <FormatButton format="bold" icon={Bold} />
              <FormatButton format="italic" icon={Italic} />
              <FormatButton format="underline" icon={Underline} />
              <FormatButton format="highlight" icon={Highlighter} />
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <BlockButton format="heading" icon={Type} />
              <BlockButton format="bulleted-list" icon={List} />
              <BlockButton format="numbered-list" icon={ListOrdered} />
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <BlockButton format="left" icon={AlignLeft} />
              <BlockButton format="center" icon={AlignCenter} />
              <BlockButton format="right" icon={AlignRight} />
            </div>
            
            {/* Editor */}
            <div className="p-8 flex-1">
              <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 min-h-full">
                <Editable
                  renderElement={Element}
                  renderLeaf={Leaf}
                  placeholder="Start typing..."
                  className="outline-none prose prose-lg max-w-none"
                  style={{ minHeight: "500px" }}
                />
              </div>
            </div>
          </Slate>
        </div>
      </div>
    </div>
  );
};
