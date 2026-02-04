/**
 * Coordinate Utilities
 * Handle conversion between PDF coordinates and screen coordinates
 * 
 * PDF coordinate system: origin at bottom-left, Y increases upward
 * Screen coordinate system: origin at top-left, Y increases downward
 */

import type { Point, Rect } from "../types";

/**
 * Convert PDF coordinates to screen coordinates
 * @param pdfX - X coordinate in PDF space
 * @param pdfY - Y coordinate in PDF space
 * @param pageHeight - Height of the PDF page in PDF units
 * @param zoom - Current zoom level (1 = 100%)
 * @returns Screen coordinates
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  pageHeight: number,
  zoom: number
): Point {
  return {
    x: pdfX * zoom,
    y: (pageHeight - pdfY) * zoom,
  };
}

/**
 * Convert screen coordinates to PDF coordinates
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @param pageHeight - Height of the PDF page in PDF units
 * @param zoom - Current zoom level (1 = 100%)
 * @returns PDF coordinates
 */
export function screenToPdf(
  screenX: number,
  screenY: number,
  pageHeight: number,
  zoom: number
): Point {
  return {
    x: screenX / zoom,
    y: pageHeight - screenY / zoom,
  };
}

/**
 * Convert a rectangle from PDF coordinates to screen coordinates
 */
export function pdfRectToScreen(
  rect: Rect,
  pageHeight: number,
  zoom: number
): Rect {
  const topLeft = pdfToScreen(rect.x, rect.y + rect.height, pageHeight, zoom);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: rect.width * zoom,
    height: rect.height * zoom,
  };
}

/**
 * Convert a rectangle from screen coordinates to PDF coordinates
 */
export function screenRectToPdf(
  rect: Rect,
  pageHeight: number,
  zoom: number
): Rect {
  const pdfX = rect.x / zoom;
  const pdfWidth = rect.width / zoom;
  const pdfHeight = rect.height / zoom;
  const pdfY = pageHeight - rect.y / zoom - pdfHeight;
  
  return {
    x: pdfX,
    y: pdfY,
    width: pdfWidth,
    height: pdfHeight,
  };
}

/**
 * Get mouse position relative to canvas in PDF coordinates
 */
export function getMousePdfPosition(
  event: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  pageHeight: number,
  zoom: number
): Point {
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  return screenToPdf(screenX, screenY, pageHeight, zoom);
}

/**
 * Check if a point is inside a rectangle (PDF coordinates)
 */
export function isPointInRect(point: Point, rect: Rect, margin = 0): boolean {
  return (
    point.x >= rect.x - margin &&
    point.x <= rect.x + rect.width + margin &&
    point.y >= rect.y - margin &&
    point.y <= rect.y + rect.height + margin
  );
}

/**
 * Transform text item coordinates from pdfjs format to our format
 * pdfjs returns transform matrix [scaleX, skewX, skewY, scaleY, translateX, translateY]
 */
export function transformTextItem(
  transform: number[],
  str: string,
  width: number | undefined,
  pageHeight: number
): { x: number; y: number; width: number; height: number; fontSize: number } {
  const fontSize = Math.abs(transform[0]) || 12;
  const x = transform[4];
  const y = transform[5];
  
  // Calculate width based on string length if not provided
  const calculatedWidth = width || str.length * fontSize * 0.6;
  
  // Convert from PDF bottom-left origin to top-left
  const screenY = pageHeight - y - fontSize;
  
  return {
    x,
    y: screenY,
    width: calculatedWidth,
    height: fontSize * 1.2,
    fontSize,
  };
}
