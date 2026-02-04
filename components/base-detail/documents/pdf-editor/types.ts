/**
 * PDF Editor Types
 * Shared TypeScript interfaces for the PDF editor
 */

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

// Tool types available in the editor
export type Tool = "select" | "pan" | "highlight" | "text" | "signature" | "edit" | "signatureField" | "initialsField" | "dateField";

// Annotation types
export type AnnotationType = "highlight" | "textBox" | "textEdit" | "signature" | "signatureField";

// Base annotation interface
export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageIndex: number; // 0-based page index
  x: number; // PDF coordinates (not screen)
  y: number;
  width: number;
  height: number;
}

// Highlight annotation (yellow transparent rectangle)
export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  color: string;
}

// Text box annotation (new text added to PDF)
export interface TextBoxAnnotation extends BaseAnnotation {
  type: "textBox";
  content: string;
  fontSize: number;
  color: string;
}

// Text edit annotation (modification of existing PDF text)
export interface TextEditAnnotation extends BaseAnnotation {
  type: "textEdit";
  content: string;
  originalText: string;
  originalX: number;
  originalY: number;
  fontSize: number;
  color: string;
}

// Signature annotation (embedded image)
export interface SignatureAnnotation extends BaseAnnotation {
  type: "signature";
  imageData: string; // Base64 PNG data URL
}

// Signature field marker (for signature requests)
export interface SignatureFieldAnnotation extends BaseAnnotation {
  type: "signatureField";
  label: string;
  fieldType: "signature" | "initial" | "date" | "text";
  isRequired: boolean;
  assignedTo?: string; // Signer identifier
}

// Union type for all annotations
export type Annotation =
  | HighlightAnnotation
  | TextBoxAnnotation
  | TextEditAnnotation
  | SignatureAnnotation
  | SignatureFieldAnnotation;

// Text item extracted from PDF
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  transform: number[];
}

// PDF loader state
export interface PdfLoaderState {
  status: "idle" | "loading" | "ready" | "error";
  document: PDFDocumentProxy | null;
  bytes: ArrayBuffer | null;
  numPages: number;
  error: string | null;
}

// PDF page render state
export interface PdfPageState {
  status: "idle" | "rendering" | "ready" | "error";
  pageNumber: number;
  viewport: { width: number; height: number } | null;
  textItems: TextItem[];
}

// Signer data type for signature requests
export interface SignerData {
  id: string;
  email: string;
  name: string;
  role: "signer" | "viewer" | "approver";
  signOrder: number;
}

// Request metadata for signature requests
export interface RequestMetadata {
  title: string;
  message: string;
  expiresAt: string;
}

// Status column configuration for auto-updating records
export interface StatusConfig {
  fieldId: string;
  valueOnComplete: string;
  valueOnDecline: string;
}

// Signature request data passed from PDF Editor
export interface SignatureRequestData {
  signatureFields: SignatureFieldAnnotation[];
  signers: SignerData[];
  fieldAssignments: Record<string, string>; // fieldId -> signerId
  // Enhanced metadata
  title: string;
  message?: string;
  expiresAt?: string;
  statusConfig?: StatusConfig;
}

// Field definition for record context
export interface FieldDefinition {
  id: string;
  name: string;
  type: string;
  options?: Record<string, { name?: string; label?: string }>;
}

// Editor props (same interface as old PdfEditor for compatibility)
export interface PdfEditorProps {
  document: {
    path: string;
    mimeType?: string;
  } | null;
  signedUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
  onRequestSignature?: (data: SignatureRequestData) => void;
  // Record context for enhanced features
  recordId?: string | null;
  availableFields?: FieldDefinition[];
  recordValues?: Record<string, unknown>;
}

// Zoom configuration
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export const DEFAULT_ZOOM_INDEX = 2; // 100%

// Point type for coordinates
export interface Point {
  x: number;
  y: number;
}

// Rectangle type for bounds
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Text formatting options
export interface TextFormatting {
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline" | "line-through";
  color: string;
  backgroundColor: string;
}

// Default text formatting
export const DEFAULT_TEXT_FORMATTING: TextFormatting = {
  fontFamily: "Arial",
  fontSize: 14,
  fontWeight: "normal",
  fontStyle: "normal",
  textDecoration: "none",
  color: "#000000",
  backgroundColor: "transparent",
};

// Available font families
export const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Comic Sans MS",
  "Impact",
  "Palatino Linotype",
] as const;

// Available font sizes
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72] as const;
