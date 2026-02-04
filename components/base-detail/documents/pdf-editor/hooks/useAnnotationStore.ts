/**
 * useAnnotationStore Hook
 * Zustand store for managing PDF annotations
 * Provides CRUD operations and persistence across page changes
 * Includes undo/redo functionality
 */

"use client";

import { create } from "zustand";
import type {
  Annotation,
  HighlightAnnotation,
  TextBoxAnnotation,
  TextEditAnnotation,
  SignatureAnnotation,
  SignatureFieldAnnotation,
  TextFormatting,
  Rect,
  Point,
} from "../types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Deep clone annotations for history
function cloneAnnotations(annotations: Annotation[]): Annotation[] {
  return JSON.parse(JSON.stringify(annotations));
}

const MAX_HISTORY_SIZE = 50;

interface AnnotationStore {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  
  // History for undo/redo
  undoStack: Annotation[][];
  redoStack: Annotation[][];
  
  // Selection
  selectAnnotation: (id: string | null) => void;
  getSelectedAnnotation: () => Annotation | null;
  
  // Add annotations
  addHighlight: (pageIndex: number, rect: Rect, color?: string) => string;
  addTextBox: (pageIndex: number, position: Point, content: string, formatting?: Partial<TextFormatting>) => string;
  addTextEdit: (
    pageIndex: number,
    originalX: number,
    originalY: number,
    width: number,
    height: number,
    originalText: string,
    newContent: string,
    fontSize: number,
    formatting?: Partial<TextFormatting>
  ) => string;
  addSignature: (pageIndex: number, position: Point, imageData: string, width?: number, height?: number) => string;
  addSignatureField: (
    pageIndex: number,
    position: Point,
    fieldType?: "signature" | "initial" | "date" | "text",
    label?: string,
    isRequired?: boolean
  ) => string;
  getSignatureFields: () => SignatureFieldAnnotation[];
  
  // Update annotations
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  moveAnnotation: (id: string, x: number, y: number) => void;
  
  // Remove annotations
  removeAnnotation: (id: string) => void;
  removeSelectedAnnotation: () => void;
  clearAnnotations: () => void;
  
  // Query annotations
  getAnnotationsForPage: (pageIndex: number) => Annotation[];
  getAnnotationById: (id: string) => Annotation | undefined;
  findTextEdit: (pageIndex: number, originalText: string, originalX: number, originalY: number) => TextEditAnnotation | undefined;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // State
  hasChanges: () => boolean;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  selectedAnnotationId: null,
  undoStack: [],
  redoStack: [],

  selectAnnotation: (id) => {
    set({ selectedAnnotationId: id });
  },

  getSelectedAnnotation: () => {
    const { annotations, selectedAnnotationId } = get();
    if (!selectedAnnotationId) return null;
    return annotations.find((ann) => ann.id === selectedAnnotationId) || null;
  },

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
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  addTextBox: (pageIndex, position, content, formatting) => {
    const id = generateId();
    const fontSize = formatting?.fontSize ?? 14;
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
      color: formatting?.color ?? "#000000",
      fontFamily: formatting?.fontFamily,
      fontWeight: formatting?.fontWeight,
      fontStyle: formatting?.fontStyle,
      textDecoration: formatting?.textDecoration,
      backgroundColor: formatting?.backgroundColor,
    };
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  addTextEdit: (pageIndex, originalX, originalY, width, height, originalText, newContent, fontSize, formatting) => {
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
      fontSize: formatting?.fontSize ?? fontSize,
      color: formatting?.color ?? "#000000",
      fontFamily: formatting?.fontFamily,
      fontWeight: formatting?.fontWeight,
      fontStyle: formatting?.fontStyle,
      textDecoration: formatting?.textDecoration,
      backgroundColor: formatting?.backgroundColor,
    };
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
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
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  addSignatureField: (pageIndex, position, fieldType = "signature", label = "Signature", isRequired = true) => {
    const id = generateId();
    const annotation: SignatureFieldAnnotation = {
      id,
      type: "signatureField",
      pageIndex,
      x: position.x,
      y: position.y,
      width: fieldType === "date" ? 120 : 200,
      height: 50,
      fieldType,
      label,
      isRequired,
    };
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
      annotations: [...state.annotations, annotation],
    }));
    return id;
  },

  getSignatureFields: () => {
    return get().annotations.filter(
      (ann): ann is SignatureFieldAnnotation => ann.type === "signatureField"
    );
  },

  updateAnnotation: (id, updates) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } as Annotation : ann
      ),
    }));
  },

  moveAnnotation: (id, x, y) => {
    // Note: moveAnnotation is called frequently during drag, so we don't push to history here
    // History will be saved when drag ends (via another action or selection)
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, x, y } : ann
      ),
    }));
  },

  removeAnnotation: (id) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: [],
      annotations: state.annotations.filter((ann) => ann.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    }));
  },

  removeSelectedAnnotation: () => {
    const { selectedAnnotationId } = get();
    if (selectedAnnotationId) {
      set((state) => ({
        undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
        redoStack: [],
        annotations: state.annotations.filter((ann) => ann.id !== selectedAnnotationId),
        selectedAnnotationId: null,
      }));
    }
  },

  clearAnnotations: () => {
    const { annotations } = get();
    if (annotations.length > 0) {
      set((state) => ({
        undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
        redoStack: [],
        annotations: [],
        selectedAnnotationId: null,
      }));
    } else {
      set({ annotations: [], selectedAnnotationId: null, undoStack: [], redoStack: [] });
    }
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

  undo: () => {
    const { undoStack, annotations } = get();
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    set((state) => ({
      redoStack: [...state.redoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      undoStack: state.undoStack.slice(0, -1),
      annotations: previousState,
      selectedAnnotationId: null,
    }));
  },

  redo: () => {
    const { redoStack, annotations } = get();
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY_SIZE + 1), cloneAnnotations(state.annotations)],
      redoStack: state.redoStack.slice(0, -1),
      annotations: nextState,
      selectedAnnotationId: null,
    }));
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },

  canRedo: () => {
    return get().redoStack.length > 0;
  },

  hasChanges: () => {
    return get().annotations.length > 0;
  },
}));

// Hook to use the store in components
export function useAnnotations() {
  return useAnnotationStore();
}
