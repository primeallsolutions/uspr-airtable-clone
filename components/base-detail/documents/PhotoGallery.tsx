"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Upload,
  Grid,
  Rows,
  Loader2,
  ZoomIn,
} from "lucide-react";
import type { StoredDocument } from "@/lib/services/documents-service";
import { DocumentsService } from "@/lib/services/documents-service";
import { DocumentActivityService } from "@/lib/services/document-activity-service";
import { toast } from "sonner";

type PhotoGalleryProps = {
  baseId: string;
  tableId?: string | null;
  documents: StoredDocument[];
  onUpload: (files: FileList | null) => void;
  onRefresh: () => void;
  loading?: boolean;
};

// Check if a document is an image
const isImage = (mimeType: string) => {
  return mimeType.startsWith("image/");
};

export const PhotoGallery = ({
  baseId,
  tableId,
  documents,
  onUpload,
  onRefresh,
  loading = false,
}: PhotoGalleryProps) => {
  const [viewMode, setViewMode] = useState<"grid" | "masonry">("masonry");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filter only image documents
  const photos = useMemo(() => {
    return documents.filter((doc) => isImage(doc.mimeType));
  }, [documents]);

  // Load signed URL for a photo
  const loadSignedUrl = useCallback(
    async (path: string) => {
      if (signedUrls.has(path) || loadingUrls.has(path)) return;

      setLoadingUrls((prev) => new Set(prev).add(path));
      try {
        const url = await DocumentsService.getSignedUrl(baseId, tableId ?? null, path);
        setSignedUrls((prev) => new Map(prev).set(path, url));
      } catch (err) {
        console.error("Failed to load photo URL:", err);
      } finally {
        setLoadingUrls((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [baseId, tableId, signedUrls, loadingUrls]
  );

  // Load URLs for visible photos
  const loadVisibleUrls = useCallback(async () => {
    const toLoad = photos.filter((p) => !signedUrls.has(p.path) && !loadingUrls.has(p.path));
    await Promise.all(toLoad.map((p) => loadSignedUrl(p.path)));
  }, [photos, signedUrls, loadingUrls, loadSignedUrl]);

  // Load URLs on mount and when photos change
  useState(() => {
    loadVisibleUrls();
  });

  // Handle photo deletion
  const handleDelete = async (photo: StoredDocument) => {
    const fileName = photo.path.split("/").pop() || photo.path;
    if (!window.confirm(`Delete "${fileName}"?`)) return;

    setDeleting(photo.path);
    try {
      await DocumentsService.deleteDocument(baseId, tableId ?? null, photo.path);

      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId,
        action: "delete",
        documentPath: photo.path,
        documentName: fileName,
      });

      toast.success("Photo deleted");
      onRefresh();
    } catch (err) {
      console.error("Failed to delete photo:", err);
      toast.error("Failed to delete photo");
    } finally {
      setDeleting(null);
    }
  };

  // Lightbox navigation
  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;
  const selectedUrl = selectedPhoto ? signedUrls.get(selectedPhoto.path) : null;

  const goToPrevious = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  // Handle keyboard navigation in lightbox
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "Escape") closeLightbox();
    },
    [selectedIndex]
  );

  // Handle file input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onUpload(e.target.files);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Photos</h3>
          <span className="text-sm text-gray-500">({photos.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("masonry")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "masonry" ? "bg-white shadow-sm" : "hover:bg-gray-200"
              }`}
              title="Masonry view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-white shadow-sm" : "hover:bg-gray-200"
              }`}
              title="Grid view"
            >
              <Rows className="w-4 h-4" />
            </button>
          </div>

          {/* Upload Button */}
          <label className="cursor-pointer px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
            <Upload className="w-4 h-4" />
            Upload Photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </label>
        </div>
      </div>

      {/* Gallery Content */}
      <div className="flex-1 overflow-auto p-4">
        {photos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No photos yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload photos to see them displayed in the gallery.
            </p>
            <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </label>
          </div>
        ) : viewMode === "masonry" ? (
          /* Masonry Grid Layout */
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {photos.map((photo, index) => {
              const url = signedUrls.get(photo.path);
              const isLoading = loadingUrls.has(photo.path);
              const fileName = photo.path.split("/").pop() || "Photo";

              // Trigger URL load if not loaded
              if (!url && !isLoading) {
                loadSignedUrl(photo.path);
              }

              return (
                <div
                  key={photo.path}
                  className="break-inside-avoid mb-4 group relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                  onClick={() => setSelectedIndex(index)}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={fileName}
                      className="w-full h-auto object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-square flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* File Name */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs text-white truncate">{fileName}</p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo);
                    }}
                    disabled={deleting === photo.path}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting === photo.path ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard Grid Layout */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((photo, index) => {
              const url = signedUrls.get(photo.path);
              const isLoading = loadingUrls.has(photo.path);
              const fileName = photo.path.split("/").pop() || "Photo";

              // Trigger URL load if not loaded
              if (!url && !isLoading) {
                loadSignedUrl(photo.path);
              }

              return (
                <div
                  key={photo.path}
                  className="aspect-square group relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                  onClick={() => setSelectedIndex(index)}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={fileName}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* File Name */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs text-white truncate">{fileName}</p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo);
                    }}
                    disabled={deleting === photo.path}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting === photo.path ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation - Previous */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedUrl}
                alt={selectedPhoto.path.split("/").pop() || "Photo"}
                className="max-w-full max-h-[85vh] object-contain"
              />
            ) : (
              <div className="w-96 h-96 flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-white" />
              </div>
            )}

            {/* Photo Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white font-medium">
                {selectedPhoto.path.split("/").pop()}
              </p>
              <p className="text-sm text-gray-300">
                {selectedIndex + 1} of {photos.length} • {(selectedPhoto.size / 1024).toFixed(1)} KB
              </p>
            </div>

            {/* Action Buttons */}
            <div className="absolute top-4 left-4 flex gap-2">
              {selectedUrl && (
                <a
                  href={selectedUrl}
                  download={selectedPhoto.path.split("/").pop()}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(selectedPhoto);
                  closeLightbox();
                }}
                className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation - Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
