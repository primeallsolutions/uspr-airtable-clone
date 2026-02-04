/**
 * PDF Save Utility
 * Applies annotations to PDF and saves using pdf-lib
 */

import { PDFDocument, rgb, PDFPage } from "pdf-lib";
import type { Annotation, HighlightAnnotation, TextBoxAnnotation, TextEditAnnotation, SignatureAnnotation } from "../types";

/**
 * Apply all annotations to a PDF and return the modified bytes
 */
export async function savePdfWithAnnotations(
  originalBytes: ArrayBuffer,
  annotations: Annotation[]
): Promise<Blob> {
  // Load the PDF
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();

  // Embed font for text
  const helveticaFont = await pdfDoc.embedFont("Helvetica");

  // Apply each annotation
  for (const ann of annotations) {
    const page = pages[ann.pageIndex];
    if (!page) continue;

    const pageHeight = page.getHeight();

    switch (ann.type) {
      case "highlight":
        applyHighlight(page, ann, pageHeight);
        break;
      case "textBox":
        applyTextBox(page, ann, pageHeight, helveticaFont);
        break;
      case "textEdit":
        applyTextEdit(page, ann, pageHeight, helveticaFont);
        break;
      case "signature":
        await applySignature(pdfDoc, page, ann, pageHeight);
        break;
    }
  }

  // Save and return
  const modifiedBytes = await pdfDoc.save();
  // Convert Uint8Array to ArrayBuffer for Blob compatibility
  const arrayBuffer = modifiedBytes.buffer.slice(
    modifiedBytes.byteOffset,
    modifiedBytes.byteOffset + modifiedBytes.byteLength
  ) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

/**
 * Apply highlight annotation
 */
function applyHighlight(
  page: PDFPage,
  ann: HighlightAnnotation,
  pageHeight: number
): void {
  // Parse color from rgba string
  const color = parseColor(ann.color);

  page.drawRectangle({
    x: ann.x,
    y: pageHeight - ann.y - ann.height, // Convert from top-down to bottom-up
    width: ann.width,
    height: ann.height,
    color: rgb(color.r, color.g, color.b),
    opacity: color.a,
  });
}

/**
 * Apply text box annotation
 */
function applyTextBox(
  page: PDFPage,
  ann: TextBoxAnnotation,
  pageHeight: number,
  font: any
): void {
  const color = parseColor(ann.color);

  page.drawText(ann.content, {
    x: ann.x,
    y: pageHeight - ann.y - ann.fontSize, // Adjust for text baseline
    size: ann.fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
  });
}

/**
 * Apply text edit annotation
 * Covers original text with white and draws new text
 */
function applyTextEdit(
  page: PDFPage,
  ann: TextEditAnnotation,
  pageHeight: number,
  font: any
): void {
  const fontSize = ann.fontSize || 12;
  
  // Calculate cover dimensions
  const originalTextWidth = ann.originalText
    ? ann.originalText.length * fontSize * 0.65
    : ann.width;
  const newTextWidth = ann.content.length * fontSize * 0.65;
  const coverWidth = Math.max(ann.width, originalTextWidth, newTextWidth) + 10;
  const coverHeight = ann.height + 8;

  // Draw white rectangle to cover original text
  page.drawRectangle({
    x: ann.originalX - 2,
    y: pageHeight - ann.originalY - ann.height - 4,
    width: coverWidth,
    height: coverHeight,
    color: rgb(1, 1, 1), // White
    opacity: 1,
  });

  // Draw new text (if not empty)
  if (ann.content.trim()) {
    const color = parseColor(ann.color);
    page.drawText(ann.content, {
      x: ann.x,
      y: pageHeight - ann.y - fontSize,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  }
}

/**
 * Apply signature annotation
 */
async function applySignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  ann: SignatureAnnotation,
  pageHeight: number
): Promise<void> {
  try {
    // Extract base64 data from data URL
    const base64Data = ann.imageData.split(",")[1];
    if (!base64Data) {
      console.error("Invalid signature image data");
      return;
    }

    // Convert to bytes
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Embed image (assuming PNG)
    const image = await pdfDoc.embedPng(imageBytes);

    // Draw image on page
    page.drawImage(image, {
      x: ann.x,
      y: pageHeight - ann.y - ann.height,
      width: ann.width,
      height: ann.height,
    });
  } catch (err) {
    console.error("Failed to embed signature:", err);
  }
}

/**
 * Parse color string to RGB values
 * Handles hex (#RRGGBB), rgb(), and rgba() formats
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // Default to black
  let r = 0, g = 0, b = 0, a = 1;

  if (color.startsWith("#")) {
    // Hex format
    const hex = color.slice(1);
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  } else if (color.startsWith("rgba")) {
    // RGBA format
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      r = parseInt(match[1]) / 255;
      g = parseInt(match[2]) / 255;
      b = parseInt(match[3]) / 255;
      a = match[4] ? parseFloat(match[4]) : 1;
    }
  } else if (color.startsWith("rgb")) {
    // RGB format
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]) / 255;
      g = parseInt(match[2]) / 255;
      b = parseInt(match[3]) / 255;
    }
  }

  return { r, g, b, a };
}

/**
 * Download PDF bytes as file
 */
export function downloadPdf(bytes: ArrayBuffer, filename: string): void {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
