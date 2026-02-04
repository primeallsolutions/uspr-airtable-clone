/**
 * Document Compression Service
 * 
 * Provides client-side compression and optimization for:
 * - Images (JPEG quality reduction, resize)
 * - PDFs (for signed documents)
 * - Thumbnail generation
 * 
 * Uses browser APIs for compression without server overhead.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for images
  format?: "jpeg" | "webp" | "png";
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  thumbnail?: Blob;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  format: "jpeg",
  generateThumbnail: false,
  thumbnailSize: 200,
};

/**
 * Document Compression Service
 */
export class DocumentCompressionService {
  /**
   * Compress an image file
   */
  static async compressImage(
    file: File | Blob,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const originalSize = file.size;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(url);

        // Calculate new dimensions
        let { width, height } = img;
        const maxW = opts.maxWidth || 2048;
        const maxH = opts.maxHeight || 2048;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas for compression
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format and MIME type
        const mimeType = opts.format === "webp" 
          ? "image/webp" 
          : opts.format === "png" 
            ? "image/png" 
            : "image/jpeg";

        // Convert to blob
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }

            const result: CompressionResult = {
              blob,
              width,
              height,
              originalSize,
              compressedSize: blob.size,
              compressionRatio: originalSize > 0 ? blob.size / originalSize : 1,
            };

            // Generate thumbnail if requested
            if (opts.generateThumbnail) {
              try {
                const thumbnail = await this.generateThumbnail(
                  img,
                  opts.thumbnailSize || 200
                );
                result.thumbnail = thumbnail;
              } catch (e) {
                console.warn("Failed to generate thumbnail:", e);
              }
            }

            resolve(result);
          },
          mimeType,
          opts.quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };

      img.src = url;
    });
  }

  /**
   * Generate a thumbnail from an image element
   */
  private static async generateThumbnail(
    img: HTMLImageElement,
    size: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Calculate thumbnail dimensions (maintain aspect ratio)
      let width = size;
      let height = size;
      
      if (img.width > img.height) {
        height = Math.round((img.height / img.width) * size);
      } else {
        width = Math.round((img.width / img.height) * size);
      }

      canvas.width = width;
      canvas.height = height;

      // Use better quality interpolation
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        "image/jpeg",
        0.8
      );
    });
  }

  /**
   * Compress multiple images in parallel
   */
  static async compressImages(
    files: File[],
    options: CompressionOptions = {},
    onProgress?: (processed: number, total: number) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const total = files.length;
    let processed = 0;

    // Process in parallel with a concurrency limit
    const concurrency = 3;
    const chunks: File[][] = [];
    
    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(file => this.compressImage(file, options))
      );
      results.push(...chunkResults);
      processed += chunk.length;
      onProgress?.(processed, total);
    }

    return results;
  }

  /**
   * Check if a file should be compressed based on size and type
   */
  static shouldCompress(file: File): boolean {
    // Don't compress small files (< 100KB)
    if (file.size < 100 * 1024) {
      return false;
    }

    // Only compress images
    const compressibleTypes = [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ];

    return compressibleTypes.includes(file.type.toLowerCase());
  }

  /**
   * Estimate compressed size before actual compression
   */
  static estimateCompressedSize(
    originalSize: number,
    mimeType: string,
    quality: number = 0.85
  ): number {
    // Rough estimates based on typical compression ratios
    const compressionRatios: Record<string, number> = {
      "image/png": 0.7,    // PNG to JPEG conversion
      "image/bmp": 0.1,    // BMP to JPEG
      "image/tiff": 0.15,  // TIFF to JPEG
      "image/jpeg": quality + 0.1, // Already JPEG, less compression
      "image/jpg": quality + 0.1,
      "image/webp": quality + 0.05, // WebP is efficient
    };

    const ratio = compressionRatios[mimeType.toLowerCase()] || 0.5;
    return Math.round(originalSize * ratio);
  }

  /**
   * Convert a file to a different format
   */
  static async convertFormat(
    file: File | Blob,
    targetFormat: "jpeg" | "webp" | "png"
  ): Promise<Blob> {
    const result = await this.compressImage(file, {
      format: targetFormat,
      quality: targetFormat === "png" ? 1 : 0.9, // PNG is lossless
      maxWidth: 4096, // Higher limit for conversion
      maxHeight: 4096,
    });
    return result.blob;
  }

  /**
   * Get optimal compression settings based on use case
   */
  static getRecommendedOptions(useCase: "upload" | "thumbnail" | "preview" | "archive"): CompressionOptions {
    switch (useCase) {
      case "upload":
        return {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.85,
          format: "jpeg",
          generateThumbnail: true,
          thumbnailSize: 200,
        };
      case "thumbnail":
        return {
          maxWidth: 200,
          maxHeight: 200,
          quality: 0.7,
          format: "jpeg",
          generateThumbnail: false,
        };
      case "preview":
        return {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 0.8,
          format: "webp",
          generateThumbnail: false,
        };
      case "archive":
        return {
          maxWidth: 4096,
          maxHeight: 4096,
          quality: 0.95,
          format: "jpeg",
          generateThumbnail: false,
        };
      default:
        return DEFAULT_OPTIONS;
    }
  }

  /**
   * Auto-compress a file based on its type and size
   */
  static async autoCompress(
    file: File,
    options: CompressionOptions = {}
  ): Promise<{ file: File; compressed: boolean; savings: number }> {
    // Check if compression is worthwhile
    if (!this.shouldCompress(file)) {
      return { file, compressed: false, savings: 0 };
    }

    try {
      const result = await this.compressImage(file, {
        ...this.getRecommendedOptions("upload"),
        ...options,
      });

      // Only use compressed version if it's actually smaller
      if (result.compressedSize >= file.size) {
        return { file, compressed: false, savings: 0 };
      }

      // Create new file from compressed blob
      const compressedFile = new File(
        [result.blob],
        file.name.replace(/\.[^.]+$/, ".jpg"), // Change extension to jpg
        { type: "image/jpeg" }
      );

      return {
        file: compressedFile,
        compressed: true,
        savings: file.size - result.compressedSize,
      };
    } catch (e) {
      console.warn("Auto-compression failed, using original:", e);
      return { file, compressed: false, savings: 0 };
    }
  }
}

export default DocumentCompressionService;

