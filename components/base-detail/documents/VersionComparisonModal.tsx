"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  GitCompare,
  ArrowLeftRight,
  Calendar,
  FileText,
} from "lucide-react";
import { DocumentVersionService, DocumentVersion } from "@/lib/services/document-version-service";
import { toast } from "sonner";

type VersionComparisonModalProps = {
  isOpen: boolean;
  onClose: () => void;
  documentPath: string;
  baseId: string;
  tableId?: string | null;
};

export const VersionComparisonModal = ({
  isOpen,
  onClose,
  documentPath,
  baseId,
  tableId,
}: VersionComparisonModalProps) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [leftVersion, setLeftVersion] = useState<DocumentVersion | null>(null);
  const [rightVersion, setRightVersion] = useState<DocumentVersion | null>(null);
  const [leftUrl, setLeftUrl] = useState<string | null>(null);
  const [rightUrl, setRightUrl] = useState<string | null>(null);
  const [leftPage, setLeftPage] = useState(1);
  const [rightPage, setRightPage] = useState(1);
  const [leftTotalPages, setLeftTotalPages] = useState(0);
  const [rightTotalPages, setRightTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [syncScroll, setSyncScroll] = useState(true);
  
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftPdfRef = useRef<any>(null);
  const rightPdfRef = useRef<any>(null);
  const leftRenderTaskRef = useRef<any>(null);
  const rightRenderTaskRef = useRef<any>(null);

  // Load versions list
  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const versionList = await DocumentVersionService.getVersions(documentPath, baseId);
      setVersions(versionList);

      // Auto-select latest two versions if available
      if (versionList.length >= 2) {
        setRightVersion(versionList[0]); // Current (newest)
        setLeftVersion(versionList[1]); // Previous
      } else if (versionList.length === 1) {
        setRightVersion(versionList[0]);
      }
    } catch (error) {
      console.error("Failed to load versions:", error);
      toast.error("Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [documentPath, baseId]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  // Load PDFs when versions are selected
  const loadComparison = useCallback(async () => {
    if (!leftVersion || !rightVersion) return;

    try {
      setComparing(true);

      // Get comparison data
      const comparison = await DocumentVersionService.compareVersions(
        leftVersion.id,
        rightVersion.id
      );

      setLeftUrl(comparison.url1);
      setRightUrl(comparison.url2);

      // Load PDFs
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const [leftPdf, rightPdf] = await Promise.all([
        pdfjs.getDocument({ url: comparison.url1 }).promise,
        pdfjs.getDocument({ url: comparison.url2 }).promise,
      ]);

      leftPdfRef.current = leftPdf;
      rightPdfRef.current = rightPdf;
      setLeftTotalPages(leftPdf.numPages);
      setRightTotalPages(rightPdf.numPages);
      setLeftPage(1);
      setRightPage(1);
    } catch (error) {
      console.error("Failed to load comparison:", error);
      toast.error("Failed to load comparison");
    } finally {
      setComparing(false);
    }
  }, [leftVersion, rightVersion]);

  useEffect(() => {
    if (leftVersion && rightVersion) {
      loadComparison();
    }
  }, [leftVersion, rightVersion, loadComparison]);

  // Render pages
  const renderPage = useCallback(
    async (
      pdf: any,
      canvas: HTMLCanvasElement | null,
      pageNum: number,
      renderTaskRef: React.MutableRefObject<any>
    ) => {
      if (!pdf || !canvas) return;

      // Cancel existing render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });

        // Calculate scale to fit in container
        const containerWidth = 450;
        const containerHeight = 600;
        const scaleX = containerWidth / viewport.width;
        const scaleY = containerHeight / viewport.height;
        const baseScale = Math.min(scaleX, scaleY);
        const scale = baseScale * zoom;

        const scaledViewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Failed to render page:", err);
        }
        renderTaskRef.current = null;
      }
    },
    [zoom]
  );

  // Render left page
  useEffect(() => {
    if (leftPdfRef.current && leftCanvasRef.current) {
      renderPage(leftPdfRef.current, leftCanvasRef.current, leftPage, leftRenderTaskRef);
    }
  }, [leftPdfRef.current, leftPage, renderPage]);

  // Render right page
  useEffect(() => {
    if (rightPdfRef.current && rightCanvasRef.current) {
      renderPage(rightPdfRef.current, rightCanvasRef.current, rightPage, rightRenderTaskRef);
    }
  }, [rightPdfRef.current, rightPage, renderPage]);

  // Sync page navigation
  const handlePageChange = (side: "left" | "right", newPage: number) => {
    if (side === "left") {
      setLeftPage(newPage);
      if (syncScroll && newPage <= rightTotalPages) {
        setRightPage(newPage);
      }
    } else {
      setRightPage(newPage);
      if (syncScroll && newPage <= leftTotalPages) {
        setLeftPage(newPage);
      }
    }
  };

  // Swap versions
  const swapVersions = () => {
    const temp = leftVersion;
    setLeftVersion(rightVersion);
    setRightVersion(temp);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <GitCompare className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Version Comparison
              </h2>
              <p className="text-sm text-gray-500">
                Compare two versions side by side
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-1.5 hover:bg-white rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
                className="p-1.5 hover:bg-white rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Toggle */}
            <button
              onClick={() => setSyncScroll(!syncScroll)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                syncScroll
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Sync Pages
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/70 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Version Selectors */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-4">
          {/* Left Version Selector */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Older Version
            </label>
            <select
              value={leftVersion?.id || ""}
              onChange={(e) => {
                const v = versions.find((ver) => ver.id === e.target.value);
                setLeftVersion(v || null);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={loading}
            >
              <option value="">Select version...</option>
              {versions
                .filter((v) => v.id !== rightVersion?.id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} - {formatDate(v.created_at)}
                    {v.notes && ` (${v.notes})`}
                  </option>
                ))}
            </select>
          </div>

          {/* Swap Button */}
          <button
            onClick={swapVersions}
            disabled={!leftVersion || !rightVersion}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Swap versions"
          >
            <ArrowLeftRight className="w-5 h-5 text-gray-600" />
          </button>

          {/* Right Version Selector */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Newer Version
            </label>
            <select
              value={rightVersion?.id || ""}
              onChange={(e) => {
                const v = versions.find((ver) => ver.id === e.target.value);
                setRightVersion(v || null);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={loading}
            >
              <option value="">Select version...</option>
              {versions
                .filter((v) => v.id !== leftVersion?.id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} - {formatDate(v.created_at)}
                    {v.is_current && " (Current)"}
                    {v.notes && ` (${v.notes})`}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Comparison Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {loading || comparing ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : !leftVersion || !rightVersion ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <GitCompare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select two versions to compare</p>
              </div>
            </div>
          ) : (
            <>
              {/* Left Panel */}
              <div className="flex-1 flex flex-col border-r border-gray-200">
                {/* Version Info */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                      v{leftVersion.version_number}
                    </span>
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-600">
                      {formatDate(leftVersion.created_at)}
                    </span>
                  </div>
                  {leftVersion.notes && (
                    <p className="text-xs text-gray-500 mt-1">{leftVersion.notes}</p>
                  )}
                </div>

                {/* PDF View */}
                <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 p-4">
                  <canvas ref={leftCanvasRef} className="shadow-lg" />
                </div>

                {/* Page Navigation */}
                <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handlePageChange("left", leftPage - 1)}
                    disabled={leftPage <= 1}
                    className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {leftPage} / {leftTotalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange("left", leftPage + 1)}
                    disabled={leftPage >= leftTotalPages}
                    className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Panel */}
              <div className="flex-1 flex flex-col">
                {/* Version Info */}
                <div className="px-4 py-2 bg-purple-50 border-b border-gray-200">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-700 rounded-full text-xs font-medium">
                      v{rightVersion.version_number}
                      {rightVersion.is_current && " (Current)"}
                    </span>
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-600">
                      {formatDate(rightVersion.created_at)}
                    </span>
                  </div>
                  {rightVersion.notes && (
                    <p className="text-xs text-gray-500 mt-1">{rightVersion.notes}</p>
                  )}
                </div>

                {/* PDF View */}
                <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 p-4">
                  <canvas ref={rightCanvasRef} className="shadow-lg" />
                </div>

                {/* Page Navigation */}
                <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handlePageChange("right", rightPage - 1)}
                    disabled={rightPage <= 1}
                    className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {rightPage} / {rightTotalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange("right", rightPage + 1)}
                    disabled={rightPage >= rightTotalPages}
                    className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
