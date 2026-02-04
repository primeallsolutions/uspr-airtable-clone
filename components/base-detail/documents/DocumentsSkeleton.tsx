"use client";

import { Loader2 } from "lucide-react";

// Deterministic width patterns for skeleton loading
const folderWidths = [92, 85, 98, 88, 95, 90, 87, 96, 84, 91];
const docWidths1 = [75, 82, 68, 90, 72, 85, 78, 88, 70, 80];
const docWidths2 = [50, 45, 55, 48, 52, 46, 58, 44, 56, 49];

/**
 * Shimmer effect CSS class for animated skeletons
 */
const shimmerClass = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent";

export const FolderSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`h-9 rounded-lg bg-gray-200 ${shimmerClass}`}
          style={{ 
            width: `${folderWidths[i % folderWidths.length]}%`,
            animationDelay: `${i * 100}ms`
          }}
        />
      ))}
    </div>
  );
};

export const DocumentSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0 ${shimmerClass}`} 
               style={{ animationDelay: `${i * 50}ms` }} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className={`h-4 bg-gray-200 rounded ${shimmerClass}`} 
                 style={{ width: `${docWidths1[i % docWidths1.length]}%`, animationDelay: `${i * 50 + 25}ms` }} />
            <div className={`h-3 bg-gray-100 rounded ${shimmerClass}`} 
                 style={{ width: `${docWidths2[i % docWidths2.length]}%`, animationDelay: `${i * 50 + 50}ms` }} />
          </div>
          <div className={`w-16 h-5 rounded bg-gray-100 flex-shrink-0 ${shimmerClass}`} 
               style={{ animationDelay: `${i * 50 + 75}ms` }} />
        </div>
      ))}
    </div>
  );
};

export const PreviewSkeleton = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`h-4 bg-gray-200 rounded w-3/4 ${shimmerClass}`} />
          <div className={`h-3 bg-gray-100 rounded w-1/2 ${shimmerClass}`} style={{ animationDelay: "100ms" }} />
        </div>
      </div>
      
      {/* Quick actions skeleton */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className={`w-20 h-4 bg-gray-200 rounded ${shimmerClass}`} />
          <div className={`w-28 h-7 bg-gray-200 rounded-lg ${shimmerClass}`} style={{ animationDelay: "50ms" }} />
          <div className={`w-16 h-7 bg-gray-200 rounded-lg ${shimmerClass}`} style={{ animationDelay: "100ms" }} />
          <div className={`w-20 h-7 bg-gray-200 rounded-lg ${shimmerClass}`} style={{ animationDelay: "150ms" }} />
        </div>
      </div>
      
      {/* Content skeleton - PDF page placeholder */}
      <div className="flex-1 min-h-0 bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className={`w-full max-w-md aspect-[8.5/11] bg-white rounded-lg shadow-md ${shimmerClass}`}>
          <div className="p-6 space-y-4">
            {/* Simulate document lines */}
            <div className={`h-6 bg-gray-200 rounded w-3/4 ${shimmerClass}`} />
            <div className={`h-4 bg-gray-100 rounded w-full ${shimmerClass}`} style={{ animationDelay: "50ms" }} />
            <div className={`h-4 bg-gray-100 rounded w-5/6 ${shimmerClass}`} style={{ animationDelay: "100ms" }} />
            <div className={`h-4 bg-gray-100 rounded w-full ${shimmerClass}`} style={{ animationDelay: "150ms" }} />
            <div className="h-4" /> {/* Spacer */}
            <div className={`h-4 bg-gray-100 rounded w-4/5 ${shimmerClass}`} style={{ animationDelay: "200ms" }} />
            <div className={`h-4 bg-gray-100 rounded w-full ${shimmerClass}`} style={{ animationDelay: "250ms" }} />
            <div className={`h-4 bg-gray-100 rounded w-3/4 ${shimmerClass}`} style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PDF Page Skeleton with signature field placeholders
 */
export const PdfPageSkeleton = ({ showFields = true }: { showFields?: boolean }) => {
  return (
    <div className="relative w-full aspect-[8.5/11] bg-white rounded-lg shadow-lg overflow-hidden">
      <div className={`absolute inset-0 ${shimmerClass}`}>
        <div className="p-8 space-y-4 h-full">
          {/* Header line */}
          <div className={`h-8 bg-gray-200 rounded w-1/2 mx-auto ${shimmerClass}`} />
          
          {/* Content lines */}
          <div className="space-y-3 mt-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={`h-3 bg-gray-100 rounded ${shimmerClass}`}
                style={{ 
                  width: `${70 + Math.sin(i) * 20}%`,
                  animationDelay: `${i * 30}ms`
                }}
              />
            ))}
          </div>
          
          {/* Signature field placeholders */}
          {showFields && (
            <div className="absolute bottom-16 right-8 left-8 flex justify-between">
              <div className={`w-32 h-12 border-2 border-dashed border-gray-300 rounded ${shimmerClass}`} />
              <div className={`w-32 h-12 border-2 border-dashed border-gray-300 rounded ${shimmerClass}`} style={{ animationDelay: "100ms" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Upload Progress Indicator
 */
export const UploadProgress = ({ 
  fileName,
  progress,
  status = "uploading",
}: { 
  fileName: string;
  progress: number;
  status?: "uploading" | "processing" | "complete" | "error";
}) => {
  const statusColors = {
    uploading: "bg-blue-500",
    processing: "bg-amber-500",
    complete: "bg-green-500",
    error: "bg-red-500",
  };

  const statusText = {
    uploading: "Uploading...",
    processing: "Processing...",
    complete: "Complete",
    error: "Failed",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Icon/Spinner */}
        <div className="flex-shrink-0">
          {status === "uploading" || status === "processing" ? (
            <Loader2 className={`w-5 h-5 animate-spin ${status === "uploading" ? "text-blue-500" : "text-amber-500"}`} />
          ) : status === "complete" ? (
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        
        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{fileName}</div>
          <div className="text-xs text-gray-500">{statusText[status]}</div>
        </div>
        
        {/* Progress percentage */}
        <div className="text-sm font-medium text-gray-600">
          {Math.round(progress)}%
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${statusColors[status]} transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Bulk Upload Progress Panel
 */
export const BulkUploadProgress = ({
  files,
  totalProgress,
  onCancel,
}: {
  files: Array<{ name: string; progress: number; status: "uploading" | "processing" | "complete" | "error" }>;
  totalProgress: number;
  onCancel?: () => void;
}) => {
  const completedCount = files.filter(f => f.status === "complete").length;
  const errorCount = files.filter(f => f.status === "error").length;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Uploading {files.length} file{files.length !== 1 ? "s" : ""}
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
      
      {/* Overall progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Overall Progress</span>
          <span>
            {completedCount}/{files.length} complete
            {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} failed)</span>}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>
      
      {/* Individual file progress */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {files.map((file, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            {/* Status indicator */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              file.status === "complete" ? "bg-green-500" :
              file.status === "error" ? "bg-red-500" :
              file.status === "processing" ? "bg-amber-500" :
              "bg-blue-500"
            }`} />
            
            {/* File name */}
            <span className="flex-1 truncate text-gray-700">{file.name}</span>
            
            {/* Progress or status */}
            <span className={`flex-shrink-0 ${
              file.status === "complete" ? "text-green-600" :
              file.status === "error" ? "text-red-600" :
              "text-gray-500"
            }`}>
              {file.status === "complete" ? "Done" :
               file.status === "error" ? "Failed" :
               `${Math.round(file.progress)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Document List Loading Skeleton with staggered animation
 */
export const DocumentListSkeleton = ({ 
  count = 8, 
  showHeader = true 
}: { 
  count?: number;
  showHeader?: boolean;
}) => {
  return (
    <div className="w-full">
      {/* Header skeleton */}
      {showHeader && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className={`h-5 w-32 bg-gray-200 rounded ${shimmerClass}`} />
          <div className="flex gap-2">
            <div className={`h-8 w-24 bg-gray-200 rounded-lg ${shimmerClass}`} />
            <div className={`h-8 w-8 bg-gray-200 rounded-lg ${shimmerClass}`} style={{ animationDelay: "50ms" }} />
          </div>
        </div>
      )}
      
      {/* Document items */}
      <DocumentSkeleton count={count} />
    </div>
  );
};

