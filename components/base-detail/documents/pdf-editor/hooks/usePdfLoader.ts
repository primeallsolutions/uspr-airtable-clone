/**
 * usePdfLoader Hook
 * Handles loading PDF documents from URL
 * Manages both pdfjs-dist document and raw bytes for pdf-lib
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfLoaderState } from "../types";

const initialState: PdfLoaderState = {
  status: "idle",
  document: null,
  bytes: null,
  numPages: 0,
  error: null,
};

export function usePdfLoader(signedUrl: string | null) {
  const [state, setState] = useState<PdfLoaderState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingTaskRef = useRef<any>(null);

  const reset = useCallback(() => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Cancel pdfjs loading task
    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy();
      loadingTaskRef.current = null;
    }
    
    // Destroy existing document
    if (state.document) {
      state.document.destroy();
    }
    
    setState(initialState);
  }, [state.document]);

  useEffect(() => {
    if (!signedUrl) {
      reset();
      return;
    }

    const loadPdf = async () => {
      // Reset previous state
      setState((prev) => ({
        ...initialState,
        status: "loading",
      }));

      // Create new abort controller for this load
      abortControllerRef.current = new AbortController();

      try {
        // Fetch PDF bytes
        const response = await fetch(signedUrl, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Make a copy for pdf-lib (pdfjs may detach the buffer)
        const bytesForPdfLib = arrayBuffer.slice(0);

        // Load with pdfjs-dist
        const pdfjs = await import("pdfjs-dist");
        
        // Configure worker
        if (typeof window !== "undefined") {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        // Use another copy for pdfjs to avoid detachment issues
        const bytesForPdfjs = arrayBuffer.slice(0);
        const loadingTask = pdfjs.getDocument({ data: bytesForPdfjs });
        loadingTaskRef.current = loadingTask;

        const document = await loadingTask.promise;

        // Check if we were aborted during loading
        if (abortControllerRef.current?.signal.aborted) {
          document.destroy();
          return;
        }

        setState({
          status: "ready",
          document,
          bytes: bytesForPdfLib,
          numPages: document.numPages,
          error: null,
        });
      } catch (err: any) {
        // Ignore abort errors
        if (err.name === "AbortError") {
          return;
        }

        console.error("Failed to load PDF:", err);
        setState({
          status: "error",
          document: null,
          bytes: null,
          numPages: 0,
          error: err.message || "Failed to load PDF document",
        });
      }
    };

    loadPdf();

    // Cleanup on unmount or URL change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl]);

  // Cleanup document on unmount
  useEffect(() => {
    return () => {
      if (state.document) {
        state.document.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    reset,
  };
}
