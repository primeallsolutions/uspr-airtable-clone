/**
 * useAnnotationStore Hook
 * Zustand store for managing PDF annotations
 * Provides CRUD operations and persistence across page changes
 */

"use client";

import { create } from "zustand";
import type {
  Annotation,
  HighlightAnnotation,
  TextBoxAnnotation,
  TextEditAnnotation,
  SignatureAnnotation,
  Rect,
  Point,
} from "../types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface AnnotationStore {
  annotations: Annotation[];
  
  // Add annotations
  addHighlight: (pageIndex: number, rect: Rect, color?: string) => string;
  addTextBox: (pageIndex: number, position: Point, content: string, fontSize?: number) => string;
  addTextEdit: (
    pageIndex: number,
    originalX: number,
    originalY: number,
    width: number,
    height: number,
    originalText: string,
    newContent: string,
    fontSize: number
  ) => string;
  addSignature: (pageIndex: number, position: Point, imageData: string, width?: number, height?: number) => string;
  
  // Update annotations
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  moveAnnotation: (id: string, x: number, y: number) => void;
  
  // Remove annotations
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  
  // Query annotations
  getAnnotationsForPage: (pageIndex: number) => Annotation[];
  getAnnotationById: (id: string) => Annotation | undefined;
  findTextEdit: (pageIndex: number, originalText: string, originalX: number, originalY: number) => TextEditAnnotation | undefined;
  
  // State
  hasChanges: () => boolean;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],

  addHighlight: (pageIndex, rect, color = "rgba(255, 255, 0, 0.3)") => {
    const id = generateId();
    const annotation: HighlightAnnotation = {
      id,
      type: "highlight",
      pageIndex,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      color,
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  addTextBox: (pageIndex, position, content, fontSize = 14) => {
    const id = generateId();
    const annotation: TextBoxAnnotation = {
      id,
      type: "textBox",
      pageIndex,
      x: position.x,
      y: position.y,
      width: Math.max(content.length * fontSize * 0.6, 100),
      height: fontSize * 1.5,
      content,
      fontSize,
      color: "#000000",
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  addTextEdit: (pageIndex, originalX, originalY, width, height, originalText, newContent, fontSize) => {
    const id = generateId();
    const annotation: TextEditAnnotation = {
      id,
      type: "textEdit",
      pageIndex,
      x: originalX,
      y: originalY,
      width,
      height,
      content: newContent,
      originalText,
      originalX,
      originalY,
      fontSize,
      color: "#000000",
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  addSignature: (pageIndex, position, imageData, width = 200, height = 50) => {
    const id = generateId();
    const annotation: SignatureAnnotation = {
      id,
      type: "signature",
      pageIndex,
      x: position.x,
      y: position.y,
      width,
      height,
      imageData,
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } as Annotation : ann
      ),
    }));
  },

  moveAnnotation: (id, x, y) => {
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, x, y } : ann
      ),
    }));
  },

  removeAnnotation: (id) => {
    set((state) => ({
      annotations: state.annotations.filter((ann) => ann.id !== id),
    }));
  },

  clearAnnotations: () => {
    set({ annotations: [] });
  },

  getAnnotationsForPage: (pageIndex) => {
    return get().annotations.filter((ann) => ann.pageIndex === pageIndex);
  },

  getAnnotationById: (id) => {
    return get().annotations.find((ann) => ann.id === id);
  },

  findTextEdit: (pageIndex, originalText, originalX, originalY) => {
    const tolerance = 5;
    return get().annotations.find(
      (ann) =>
        ann.type === "textEdit" &&
        ann.pageIndex === pageIndex &&
        ann.originalText === originalText &&
        Math.abs(ann.originalX - originalX) < tolerance &&
        Math.abs(ann.originalY - originalY) < tolerance
    ) as TextEditAnnotation | undefined;
  },

  hasChanges: () => {
    return get().annotations.length > 0;
  },
}));

// Hook to use the store in components
export function useAnnotations() {
  return useAnnotationStore();
}
