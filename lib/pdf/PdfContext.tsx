"use client";

/**
 * PDF Context Provider
 * 
 * Provides a centralized PDF.js infrastructure to avoid:
 * - Multiple worker initializations
 * - Redundant document loading
 * - Inconsistent error handling
 * 
 * Usage:
 * 1. Wrap your app/page with <PdfProvider>
 * 2. Use usePdf() hook to access PDF utilities
 * 3. Use usePdfDocument(url) to load and cache documents
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Types
export interface PdfContextValue {
  isInitialized: boolean;
  initializePdfJs: () => Promise<typeof import("pdfjs-dist")>;
  loadDocument: (url: string, options?: PdfLoadOptions) => Promise<PDFDocumentProxy>;
  getCachedDocument: (url: string) => PDFDocumentProxy | null;
  clearCache: (url?: string) => void;
  preloadDocument: (url: string) => void;
  acquireDocument: (url: string) => void;
  releaseDocument: (url: string) => void;
}

export interface PdfLoadOptions {
  /** Force reload even if cached */
  forceReload?: boolean;
  /** Include credentials in request */
  withCredentials?: boolean;
  /** Disable auto-fetch for large documents */
  disableAutoFetch?: boolean;
  /** Cache the document after loading */
  cache?: boolean;
}

export interface PdfProviderProps {
  children: ReactNode;
  /** Maximum number of documents to cache */
  maxCacheSize?: number;
  /** Worker source path */
  workerSrc?: string;
}

interface CachedDocument {
  document: PDFDocumentProxy;
  loadedAt: number;
  url: string;
  refCount: number; // Track active usage
}

// Context
const PdfContext = createContext<PdfContextValue | null>(null);

// Singleton state for PDF.js initialization
let pdfJsInstance: typeof import("pdfjs-dist") | null = null;
let initializationPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Initialize PDF.js with worker - singleton pattern
 */
async function initPdfJs(workerSrc?: string): Promise<typeof import("pdfjs-dist")> {
  if (pdfJsInstance) {
    return pdfJsInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const pdfjs = await import("pdfjs-dist");
    
    // Set worker source only once
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc || "/pdf.worker.min.mjs";
    }
    
    pdfJsInstance = pdfjs;
    return pdfjs;
  })();

  return initializationPromise;
}

/**
 * PDF Provider Component
 */
export function PdfProvider({
  children,
  maxCacheSize = 5,
  workerSrc,
}: PdfProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const cacheRef = useRef<Map<string, CachedDocument>>(new Map());
  const loadingRef = useRef<Map<string, Promise<PDFDocumentProxy>>>(new Map());

  // Initialize PDF.js on mount
  useEffect(() => {
    initPdfJs(workerSrc).then(() => {
      setIsInitialized(true);
    }).catch((err) => {
      console.error("Failed to initialize PDF.js:", err);
    });
  }, [workerSrc]);

  /**
   * Get PDF.js instance, initializing if needed
   */
  const initializePdfJs = useCallback(async () => {
    return initPdfJs(workerSrc);
  }, [workerSrc]);

  /**
   * Get cached document if available
   */
  const getCachedDocument = useCallback((url: string): PDFDocumentProxy | null => {
    const cached = cacheRef.current.get(url);
    return cached?.document || null;
  }, []);

  /**
   * Acquire a document - increment ref count to prevent eviction
   */
  const acquireDocument = useCallback((url: string) => {
    const cached = cacheRef.current.get(url);
    if (cached) {
      cached.refCount = (cached.refCount || 0) + 1;
    }
  }, []);

  /**
   * Release a document - decrement ref count
   */
  const releaseDocument = useCallback((url: string) => {
    const cached = cacheRef.current.get(url);
    if (cached && cached.refCount > 0) {
      cached.refCount--;
    }
  }, []);

  /**
   * Manage cache size - remove oldest entries that are not in use
   */
  const trimCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= maxCacheSize) return;

    // Sort by loadedAt and remove oldest, but skip entries still in use
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    
    // Filter out entries that are actively in use (refCount > 0)
    const evictable = entries.filter(([_, value]) => !value.refCount || value.refCount === 0);
    const toRemove = evictable.slice(0, Math.max(0, cache.size - maxCacheSize));
    
    toRemove.forEach(([key, value]) => {
      // Destroy the document to free memory
      value.document.destroy().catch(() => {});
      cache.delete(key);
    });
  }, [maxCacheSize]);

  /**
   * Load a PDF document with caching
   */
  const loadDocument = useCallback(async (
    url: string,
    options: PdfLoadOptions = {}
  ): Promise<PDFDocumentProxy> => {
    const { forceReload = false, withCredentials = false, disableAutoFetch = false, cache = true } = options;

    // Check cache first
    if (!forceReload) {
      const cached = cacheRef.current.get(url);
      if (cached) {
        return cached.document;
      }
    }

    // Check if already loading
    const existingLoad = loadingRef.current.get(url);
    if (existingLoad && !forceReload) {
      return existingLoad;
    }

    // Start loading - create promise and store it immediately
    // Use a helper to avoid TypeScript self-reference error
    let promiseRef: Promise<PDFDocumentProxy> | undefined;
    const loadPromise = (async () => {
      const pdfjs = await initPdfJs(workerSrc);
      
      const loadingTask = pdfjs.getDocument({
        url,
        withCredentials,
        disableAutoFetch,
      });

      const document = await loadingTask.promise;

      // Cache the document
      if (cache) {
        cacheRef.current.set(url, {
          document,
          loadedAt: Date.now(),
          url,
          refCount: 0,
        });
        trimCache();
      }

      // Only remove from loading map if this is still the current load for this URL
      // This prevents a race condition when forceReload starts a new load before this one completes
      // Use promiseRef to avoid self-reference
      const currentLoadPromise = loadingRef.current.get(url);
      if (currentLoadPromise && promiseRef && currentLoadPromise === promiseRef) {
        loadingRef.current.delete(url);
      }

      return document;
    })();
    
    // Store reference for comparison
    promiseRef = loadPromise;

    // Store the promise in the map immediately
    loadingRef.current.set(url, loadPromise);
    return loadPromise;
  }, [workerSrc, trimCache]);

  /**
   * Preload a document in the background
   */
  const preloadDocument = useCallback((url: string) => {
    // Don't preload if already cached or loading
    if (cacheRef.current.has(url) || loadingRef.current.has(url)) {
      return;
    }

    loadDocument(url, { cache: true }).catch((err) => {
      console.warn("Failed to preload document:", err);
    });
  }, [loadDocument]);

  /**
   * Clear cache - optionally just one document
   */
  const clearCache = useCallback((url?: string) => {
    if (url) {
      const cached = cacheRef.current.get(url);
      if (cached) {
        cached.document.destroy().catch(() => {});
        cacheRef.current.delete(url);
      }
    } else {
      // Clear all
      cacheRef.current.forEach((cached) => {
        cached.document.destroy().catch(() => {});
      });
      cacheRef.current.clear();
    }
  }, []);

  const value: PdfContextValue = {
    isInitialized,
    initializePdfJs,
    loadDocument,
    getCachedDocument,
    clearCache,
    preloadDocument,
    acquireDocument,
    releaseDocument,
  };

  return (
    <PdfContext.Provider value={value}>
      {children}
    </PdfContext.Provider>
  );
}

/**
 * Hook to access PDF context
 */
export function usePdf(): PdfContextValue {
  const context = useContext(PdfContext);
  if (!context) {
    throw new Error("usePdf must be used within a PdfProvider");
  }
  return context;
}

/**
 * Hook to load and manage a PDF document
 */
export function usePdfDocument(url: string | null, options?: PdfLoadOptions) {
  const { loadDocument, getCachedDocument, clearCache, acquireDocument, releaseDocument } = usePdf();
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  
  // Extract stable option values to avoid infinite re-renders from inline objects
  const cacheOption = options?.cache;
  const forceReloadOption = options?.forceReload;
  const withCredentialsOption = options?.withCredentials;
  const disableAutoFetchOption = options?.disableAutoFetch;

  useEffect(() => {
    if (!url) {
      setDocument(null);
      setNumPages(0);
      setError(null);
      return;
    }

    // Check cache first
    const cached = getCachedDocument(url);
    if (cached) {
      setDocument(cached);
      setNumPages(cached.numPages);
      setLoading(false);
      setError(null);
      acquireDocument(url);
      return () => {
        releaseDocument(url);
      };
    }

    setLoading(true);
    setError(null);

    const stableOptions: PdfLoadOptions = {
      cache: cacheOption,
      forceReload: forceReloadOption,
      withCredentials: withCredentialsOption,
      disableAutoFetch: disableAutoFetchOption,
    };

    loadDocument(url, stableOptions)
      .then((doc) => {
        setDocument(doc);
        setNumPages(doc.numPages);
        setError(null);
        acquireDocument(url);
      })
      .catch((err) => {
        console.error("Failed to load PDF:", err);
        setError(err.message || "Failed to load PDF");
        setDocument(null);
        setNumPages(0);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (url) {
        releaseDocument(url);
      }
    };
  }, [url, loadDocument, getCachedDocument, acquireDocument, releaseDocument, cacheOption, forceReloadOption, withCredentialsOption, disableAutoFetchOption]);

  const reload = useCallback(() => {
    if (url) {
      clearCache(url);
      setLoading(true);
      setError(null);
      loadDocument(url, { ...options, forceReload: true })
        .then((doc) => {
          setDocument(doc);
          setNumPages(doc.numPages);
        })
        .catch((err) => {
          setError(err.message || "Failed to reload PDF");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [url, loadDocument, clearCache, options]);

  return {
    document,
    numPages,
    loading,
    error,
    reload,
  };
}

/**
 * Error Boundary for PDF components
 */
interface PdfErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface PdfErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PdfErrorBoundary extends React.Component<
  PdfErrorBoundaryProps,
  PdfErrorBoundaryState
> {
  constructor(props: PdfErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PdfErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PDF Error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 mb-4 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to load PDF
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {this.state.error?.message || "An error occurred while loading the document."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export types
export type { PDFDocumentProxy };

