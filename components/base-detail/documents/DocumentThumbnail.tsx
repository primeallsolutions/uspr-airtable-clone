"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Image as ImageIcon, File, Loader2 } from "lucide-react";
import { useThumbnail } from "@/lib/services/thumbnail-service";

type DocumentThumbnailProps = {
  documentPath: string;
  baseId: string;
  tableId?: string | null;
  signedUrl?: string | null;
  mimeType: string;
  fileName: string;
  className?: string;
};

// Type icons for fallback
const FileIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: ImageIcon,
  default: File,
};

export const DocumentThumbnail = ({
  documentPath,
  baseId,
  tableId,
  signedUrl,
  mimeType,
  fileName,
  className = "",
}: DocumentThumbnailProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Only generate thumbnail when visible
  const { status, url } = useThumbnail(
    isVisible ? documentPath : null,
    baseId,
    tableId,
    isVisible ? signedUrl : null
  );

  // Determine file type
  const extension = documentPath.split(".").pop()?.toLowerCase() || "";
  const isPdf = mimeType.includes("pdf") || extension === "pdf";
  const isImage = mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension);

  // Get icon type for fallback
  const getIconType = () => {
    if (isPdf) return "pdf";
    if (isImage) return "image";
    return "default";
  };

  const IconComponent = FileIcons[getIconType()];

  // Handle image load errors
  const handleImageError = useCallback(() => {
    setShowFallback(true);
  }, []);

  // Fallback UI
  const renderFallback = () => (
    <div className={`flex flex-col items-center justify-center h-full bg-gray-50 ${className}`}>
      <IconComponent 
        className={`w-8 h-8 ${
          isPdf ? "text-red-500" : 
          isImage ? "text-blue-500" : 
          "text-gray-400"
        }`} 
      />
      <span className="text-[10px] text-gray-400 mt-1 max-w-full truncate px-1">
        {extension.toUpperCase()}
      </span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-100 rounded ${className}`}
      style={{ minHeight: "60px" }}
    >
      {!isVisible ? (
        // Placeholder before intersection
        renderFallback()
      ) : status === "loading" ? (
        // Loading state
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : status === "success" && url && !showFallback ? (
        // Thumbnail image
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={fileName}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        // Fallback for error or unsupported types
        renderFallback()
      )}
    </div>
  );
};
