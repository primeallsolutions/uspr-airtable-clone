"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

export type ThumbnailStatus = "idle" | "loading" | "success" | "error";

export type ThumbnailResult = {
  status: ThumbnailStatus;
  url: string | null;
  error: string | null;
};

// In-memory cache for thumbnails
const thumbnailCache = new Map<string, string>();

/**
 * Hook to get or generate a thumbnail for a document
 */
export function useThumbnail(
  documentPath: string | null,
  baseId: string,
  tableId?: string | null,
  signedUrl?: string | null
): ThumbnailResult {
  const [status, setStatus] = useState<ThumbnailStatus>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateThumbnail = useCallback(async () => {
    if (!documentPath || !signedUrl) return;

    // Check memory cache first
    const cacheKey = `${baseId}:${tableId || ""}:${documentPath}`;
    if (thumbnailCache.has(cacheKey)) {
      setUrl(thumbnailCache.get(cacheKey) || null);
      setStatus("success");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      // Determine file type
      const extension = documentPath.split(".").pop()?.toLowerCase() || "";
      const isPdf = extension === "pdf";
      const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension);

      if (isImage) {
        // For images, use the signed URL directly
        thumbnailCache.set(cacheKey, signedUrl);
        setUrl(signedUrl);
        setStatus("success");
        return;
      }

      if (!isPdf) {
        // Non-supported file type
        setStatus("error");
        setError("Thumbnail not supported for this file type");
        return;
      }

      // For PDFs, generate thumbnail from first page
      const thumbnailDataUrl = await generatePdfThumbnail(signedUrl);
      
      if (thumbnailDataUrl) {
        thumbnailCache.set(cacheKey, thumbnailDataUrl);
        setUrl(thumbnailDataUrl);
        setStatus("success");
      } else {
        setStatus("error");
        setError("Failed to generate thumbnail");
      }
    } catch (err) {
      console.error("Thumbnail generation error:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [documentPath, baseId, tableId, signedUrl]);

  useEffect(() => {
    if (documentPath && signedUrl) {
      generateThumbnail();
    }
  }, [documentPath, signedUrl, generateThumbnail]);

  return { status, url, error };
}

/**
 * Generate a thumbnail from the first page of a PDF using pdfjs-dist
 */
async function generatePdfThumbnail(pdfUrl: string): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    
    // Set worker source
    if (typeof window !== "undefined") {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }

    // Load PDF
    const loadingTask = pdfjs.getDocument({ url: pdfUrl });
    const pdf = await loadingTask.promise;

    if (pdf.numPages === 0) {
      return null;
    }

    // Get first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    // Calculate scale to fit thumbnail dimensions
    const thumbWidth = 150;
    const thumbHeight = 200;
    const scaleX = thumbWidth / viewport.width;
    const scaleY = thumbHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledViewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    // Render page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
      canvas,
    };

    await page.render(renderContext as any).promise;

    // Convert to data URL
    const dataUrl = canvas.toDataURL("image/png", 0.8);

    // Clean up
    pdf.destroy();

    return dataUrl;
  } catch (err) {
    console.error("Error generating PDF thumbnail:", err);
    return null;
  }
}

/**
 * Service for batch thumbnail operations
 */
export const ThumbnailService = {
  /**
   * Get thumbnail URL from storage if it exists
   */
  async getThumbnailUrl(
    documentPath: string,
    baseId: string,
    tableId?: string | null
  ): Promise<string | null> {
    try {
      const prefix = tableId
        ? `bases/${baseId}/tables/${tableId}/`
        : `bases/${baseId}/`;
      const fileName = documentPath.split("/").pop() || "document";
      const thumbnailFileName = `thumb_${fileName.replace(/\.[^.]+$/, ".png")}`;
      const thumbnailPath = `${prefix}.thumbnails/${thumbnailFileName}`;

      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(thumbnailPath, 3600);

      return data?.signedUrl || null;
    } catch {
      return null;
    }
  },

  /**
   * Upload a generated thumbnail to storage for caching
   */
  async uploadThumbnail(
    documentPath: string,
    baseId: string,
    tableId: string | null,
    thumbnailDataUrl: string
  ): Promise<string | null> {
    try {
      const prefix = tableId
        ? `bases/${baseId}/tables/${tableId}/`
        : `bases/${baseId}/`;
      const fileName = documentPath.split("/").pop() || "document";
      const thumbnailFileName = `thumb_${fileName.replace(/\.[^.]+$/, ".png")}`;
      const thumbnailPath = `${prefix}.thumbnails/${thumbnailFileName}`;

      // Convert data URL to blob
      const response = await fetch(thumbnailDataUrl);
      const blob = await response.blob();

      // Upload to storage
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(thumbnailPath, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (error) {
        console.error("Failed to upload thumbnail:", error);
        return null;
      }

      // Get signed URL
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(thumbnailPath, 3600);

      return data?.signedUrl || null;
    } catch (err) {
      console.error("Error uploading thumbnail:", err);
      return null;
    }
  },

  /**
   * Clear thumbnail cache for a document
   */
  clearCache(documentPath: string, baseId: string, tableId?: string | null) {
    const cacheKey = `${baseId}:${tableId || ""}:${documentPath}`;
    thumbnailCache.delete(cacheKey);
  },

  /**
   * Clear all cached thumbnails
   */
  clearAllCache() {
    thumbnailCache.clear();
  },
};
