/**
 * Document Search Service
 * 
 * Provides full-text search capabilities for documents.
 * Uses PostgreSQL full-text search for efficient queries.
 */

import { supabase } from "@/lib/supabaseClient";

export interface SearchResult {
  documentPath: string;
  fileName: string;
  mimeType: string;
  contentPreview?: string;
  highlightedPreview?: string;
  rank: number;
  indexedAt: Date;
  tableId?: string;
  recordId?: string;
}

export interface SearchOptions {
  tableId?: string;
  mimeType?: string;
  limit?: number;
  offset?: number;
  includeHighlights?: boolean;
}

export interface SearchSuggestion {
  suggestion: string;
  documentCount: number;
}

/**
 * Document Search Service
 */
export class DocumentSearchService {
  /**
   * Search documents by query
   */
  static async search(
    baseId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      tableId,
      mimeType,
      limit = 20,
      offset = 0,
      includeHighlights = false,
    } = options;

    try {
      if (includeHighlights) {
        const { data, error } = await supabase.rpc(
          "search_documents_with_highlights",
          {
            p_base_id: baseId,
            p_query: query,
            p_limit: limit,
          }
        );

        if (error) {
          console.error("Search error:", error);
          throw error;
        }

        return (data || []).map((row: any) => ({
          documentPath: row.document_path,
          fileName: row.file_name,
          mimeType: row.mime_type,
          highlightedPreview: row.highlighted_preview,
          rank: row.rank,
          indexedAt: new Date(),
        }));
      } else {
        const { data, error } = await supabase.rpc("search_documents", {
          p_base_id: baseId,
          p_query: query,
          p_table_id: tableId || null,
          p_mime_type: mimeType || null,
          p_limit: limit,
          p_offset: offset,
        });

        if (error) {
          console.error("Search error:", error);
          throw error;
        }

        return (data || []).map((row: any) => ({
          documentPath: row.document_path,
          fileName: row.file_name,
          mimeType: row.mime_type,
          contentPreview: row.content_preview,
          rank: row.rank,
          indexedAt: row.indexed_at ? new Date(row.indexed_at) : new Date(),
          tableId: row.table_id,
          recordId: row.record_id,
        }));
      }
    } catch (e) {
      console.error("Document search failed:", e);
      throw e;
    }
  }

  /**
   * Get search suggestions (autocomplete)
   */
  static async getSuggestions(
    baseId: string,
    prefix: string,
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    try {
      const { data, error } = await supabase.rpc(
        "get_document_search_suggestions",
        {
          p_base_id: baseId,
          p_prefix: prefix,
          p_limit: limit,
        }
      );

      if (error) {
        console.error("Suggestion error:", error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        suggestion: row.suggestion,
        documentCount: row.document_count,
      }));
    } catch (e) {
      console.error("Failed to get suggestions:", e);
      return [];
    }
  }

  /**
   * Index a document
   */
  static async indexDocument(params: {
    documentPath: string;
    baseId: string;
    tableId?: string;
    recordId?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    contentText?: string;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc("index_document", {
        p_document_path: params.documentPath,
        p_base_id: params.baseId,
        p_table_id: params.tableId || null,
        p_record_id: params.recordId || null,
        p_file_name: params.fileName || null,
        p_mime_type: params.mimeType || null,
        p_file_size: params.fileSize || null,
        p_content_text: params.contentText || null,
      });

      if (error) {
        console.error("Indexing error:", error);
        throw error;
      }

      return data;
    } catch (e) {
      console.error("Failed to index document:", e);
      return null;
    }
  }

  /**
   * Remove document from index
   */
  static async removeFromIndex(
    documentPath: string,
    baseId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc("remove_document_from_index", {
        p_document_path: documentPath,
        p_base_id: baseId,
      });

      if (error) {
        console.error("Remove from index error:", error);
        throw error;
      }

      return data === true;
    } catch (e) {
      console.error("Failed to remove document from index:", e);
      return false;
    }
  }

  /**
   * Extract text from a PDF (client-side)
   * Uses pdf.js to extract text content
   */
  static async extractPdfText(pdfUrl: string): Promise<string> {
    try {
      const pdfjs = await import("pdfjs-dist");
      
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n\n";
      }
      
      return fullText.trim();
    } catch (e) {
      console.error("PDF text extraction failed:", e);
      return "";
    }
  }

  /**
   * Index a PDF document with text extraction
   */
  static async indexPdfDocument(params: {
    documentPath: string;
    baseId: string;
    pdfUrl: string;
    tableId?: string;
    recordId?: string;
    fileName?: string;
    fileSize?: number;
  }): Promise<string | null> {
    try {
      // Extract text from PDF
      const contentText = await this.extractPdfText(params.pdfUrl);
      
      // Index the document
      return await this.indexDocument({
        ...params,
        mimeType: "application/pdf",
        contentText,
      });
    } catch (e) {
      console.error("PDF indexing failed:", e);
      return null;
    }
  }

  /**
   * Batch index multiple documents
   */
  static async batchIndex(
    baseId: string,
    documents: Array<{
      documentPath: string;
      fileName: string;
      mimeType?: string;
      fileSize?: number;
      tableId?: string;
      recordId?: string;
    }>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const total = documents.length;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      try {
        await this.indexDocument({
          documentPath: doc.documentPath,
          baseId,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          tableId: doc.tableId,
          recordId: doc.recordId,
        });
        success++;
      } catch (e) {
        console.error(`Failed to index ${doc.documentPath}:`, e);
        failed++;
      }
      onProgress?.(i + 1, total);
    }

    return { success, failed };
  }

  /**
   * Check if a document is indexed
   */
  static async isIndexed(
    documentPath: string,
    baseId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("document_search_index")
        .select("id")
        .eq("document_path", documentPath)
        .eq("base_id", baseId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      return !!data;
    } catch (e) {
      console.error("Index check failed:", e);
      return false;
    }
  }

  /**
   * Get index statistics for a base
   */
  static async getIndexStats(baseId: string): Promise<{
    totalDocuments: number;
    indexedDocuments: number;
    withContent: number;
    byMimeType: Record<string, number>;
  }> {
    try {
      const { data, error } = await supabase
        .from("document_search_index")
        .select("mime_type, content_text")
        .eq("base_id", baseId);

      if (error) throw error;

      const documents = data || [];
      const byMimeType: Record<string, number> = {};
      let withContent = 0;

      documents.forEach((doc: any) => {
        if (doc.mime_type) {
          byMimeType[doc.mime_type] = (byMimeType[doc.mime_type] || 0) + 1;
        }
        if (doc.content_text) {
          withContent++;
        }
      });

      return {
        totalDocuments: 0, // Would need separate query to storage
        indexedDocuments: documents.length,
        withContent,
        byMimeType,
      };
    } catch (e) {
      console.error("Failed to get index stats:", e);
      return {
        totalDocuments: 0,
        indexedDocuments: 0,
        withContent: 0,
        byMimeType: {},
      };
    }
  }
}

export default DocumentSearchService;

