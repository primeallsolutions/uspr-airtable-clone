"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Scissors, Check, Loader2, ChevronLeft, ChevronRight, File, Folder } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { DocumentActivityService } from "@/lib/services/document-activity-service";
import { DocumentsService } from "@/lib/services/documents-service";

type PdfSplitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId?: string | null;
  recordId?: string | null; // Add recordId support
  document: {
    path: string;
    name: string;
  };
  signedUrl: string;
  onSplitComplete: () => void;
};

type PageSelection = {
  pageNumber: number;
  selected: boolean;
};

export const PdfSplitModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  recordId, // Add recordId
  document,
  signedUrl,
  onSplitComplete,
}: PdfSplitModalProps) => {
  const [loading, setLoading] = useState(true);
  const [splitting, setSplitting] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSelections, setPageSelections] = useState<PageSelection[]>([]);
  const [outputFileName, setOutputFileName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>(""); // Folder path
  const [availableFolders, setAvailableFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load available folders
  useEffect(() => {
    const loadFolders = async () => {
      if (!isOpen) return;
      
      try {
        setLoadingFolders(true);
        const folders = recordId
          ? await DocumentsService.listRecordFolders(baseId, recordId)
          : await DocumentsService.listFolders(baseId, tableId ?? null, null, true);
        
        setAvailableFolders(folders || []);
        
        // Auto-select first folder if available
        if (folders && folders.length > 0 && !selectedFolder) {
          setSelectedFolder(folders[0].path);
        }
      } catch (err) {
        console.error("Failed to load folders:", err);
        toast.error("Failed to load folders");
      } finally {
        setLoadingFolders(false);
      }
    };

    loadFolders();
  }, [isOpen, baseId, tableId, recordId, selectedFolder]);

  // Generate default output filename
  useEffect(() => {
    if (document.name) {
      const baseName = document.name.replace(/\.pdf$/i, "");
      setOutputFileName(`${baseName}_extracted`);
    }
  }, [document.name]);

  // Load PDF document
  const loadPdf = useCallback(async () => {
    if (!signedUrl) return;

    try {
      setLoading(true);
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument({ url: signedUrl });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);

      // Initialize page selections
      const selections: PageSelection[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        selections.push({ pageNumber: i, selected: false });
      }
      setPageSelections(selections);
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load PDF:", err);
      toast.error("Failed to load PDF document");
    } finally {
      setLoading(false);
    }
  }, [signedUrl]);

  useEffect(() => {
    if (isOpen && signedUrl) {
      loadPdf();
    }
  }, [isOpen, signedUrl, loadPdf]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any existing render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore cancellation errors
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.0 });

      // Calculate scale to fit within container
      const containerWidth = 400;
      const containerHeight = 500;
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY, 1.5);

      const scaledViewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
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
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage();
    }

    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, renderPage]);

  // Toggle page selection
  const togglePageSelection = (pageNumber: number) => {
    setPageSelections((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p
      )
    );
  };

  // Toggle current page selection
  const toggleCurrentPage = () => {
    togglePageSelection(currentPage);
  };

  // Get selected page count
  const selectedCount = pageSelections.filter((p) => p.selected).length;

  // Get page ranges from selections (for API)
  const getPageRanges = (): { start: number; end: number }[] => {
    const selectedPages = pageSelections
      .filter((p) => p.selected)
      .map((p) => p.pageNumber)
      .sort((a, b) => a - b);

    if (selectedPages.length === 0) return [];

    // Group consecutive pages into ranges
    const ranges: { start: number; end: number }[] = [];
    let rangeStart = selectedPages[0];
    let rangeEnd = selectedPages[0];

    for (let i = 1; i < selectedPages.length; i++) {
      if (selectedPages[i] === rangeEnd + 1) {
        rangeEnd = selectedPages[i];
      } else {
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = selectedPages[i];
        rangeEnd = selectedPages[i];
      }
    }
    ranges.push({ start: rangeStart, end: rangeEnd });

    return ranges;
  };

  // Handle split
  const handleSplit = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one page to extract");
      return;
    }

    if (!outputFileName.trim()) {
      toast.error("Please enter an output file name");
      return;
    }

    if (!selectedFolder) {
      toast.error("Please select a folder");
      return;
    }

    try {
      setSplitting(true);

      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const pageRanges = getPageRanges();

      const response = await fetch("/api/documents/split", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          baseId,
          tableId,
          recordId, // Pass recordId to API
          documentPath: document.path,
          pageRanges,
          outputFileName: outputFileName.trim(),
          folderPath: selectedFolder, // Pass selected folder path
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to split PDF");
      }

      const result = await response.json();

      // Log activity
      await DocumentActivityService.logActivity({
        baseId,
        tableId,
        action: "edit",
        documentPath: result.documentPath,
        documentName: result.fileName,
        metadata: {
          operation: "split",
          sourceDocument: document.name,
          extractedPages: selectedCount,
        },
      });

      toast.success("PDF split successfully", {
        description: `Extracted ${result.pageCount} pages to "${result.fileName}"`,
      });

      onSplitComplete();
      onClose();
    } catch (err) {
      console.error("Failed to split PDF:", err);
      toast.error("Failed to split PDF", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSplitting(false);
    }
  };

  // Select all / deselect all
  const selectAll = () => {
    setPageSelections((prev) => prev.map((p) => ({ ...p, selected: true })));
  };

  const deselectAll = () => {
    setPageSelections((prev) => prev.map((p) => ({ ...p, selected: false })));
  };

  // Select range
  const selectRange = (start: number, end: number) => {
    setPageSelections((prev) =>
      prev.map((p) => ({
        ...p,
        selected: p.pageNumber >= start && p.pageNumber <= end,
      }))
    );
  };

  if (!isOpen) return null;

  const isCurrentPageSelected = pageSelections.find(
    (p) => p.pageNumber === currentPage
  )?.selected;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Scissors className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Split PDF - {document.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview Panel */}
          <div className="flex-1 flex flex-col border-r border-gray-200 p-4">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {/* Page Preview */}
                <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden relative">
                  <canvas ref={canvasRef} className="max-w-full max-h-full" />
                  
                  {/* Selection indicator */}
                  {isCurrentPageSelected && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Selected
                    </div>
                  )}
                </div>

                {/* Page Navigation */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {numPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(numPages, p + 1))
                    }
                    disabled={currentPage === numPages}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Toggle Current Page */}
                <div className="flex justify-center mt-2">
                  <button
                    onClick={toggleCurrentPage}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrentPageSelected
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {isCurrentPageSelected ? "Deselect Page" : "Select Page"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Page Selection Panel */}
          <div className="w-72 flex flex-col p-4">
            <h3 className="font-medium text-gray-900 mb-3">Select Pages</h3>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={selectAll}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Page Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2">
                {pageSelections.map((page) => (
                  <button
                    key={page.pageNumber}
                    onClick={() => {
                      togglePageSelection(page.pageNumber);
                      setCurrentPage(page.pageNumber);
                    }}
                    className={`aspect-square flex items-center justify-center text-xs font-medium rounded-md transition-colors ${
                      page.selected
                        ? "bg-blue-600 text-white"
                        : page.pageNumber === currentPage
                        ? "bg-blue-100 text-blue-600 border-2 border-blue-400"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {page.pageNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Count */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">
                Selected: <span className="font-medium">{selectedCount}</span>{" "}
                of {numPages} pages
              </div>
              {selectedCount > 0 && (
                <div className="text-xs text-gray-500">
                  Pages:{" "}
                  {pageSelections
                    .filter((p) => p.selected)
                    .map((p) => p.pageNumber)
                    .join(", ")}
                </div>
              )}
            </div>

            {/* Output Filename */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output File Name
              </label>
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={outputFileName}
                  onChange={(e) => setOutputFileName(e.target.value)}
                  placeholder="extracted_pages"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-500">.pdf</span>
              </div>
            </div>

            {/* Folder Selection */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination Folder <span className="text-red-500">*</span>
              </label>
              {loadingFolders ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading folders...
                </div>
              ) : availableFolders.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg bg-gray-50">
                  No folders available. The file will be saved to the root.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-gray-400" />
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a folder...</option>
                    {availableFolders.map((folder) => (
                      <option key={folder.path} value={folder.path}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={splitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={splitting || selectedCount === 0 || !outputFileName.trim() || !selectedFolder}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {splitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                Extract {selectedCount} Page{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
