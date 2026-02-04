"use client";

import { supabase } from "@/lib/supabaseClient";

// Types
export type RecordDocument = {
  id: string;
  record_id: string;
  base_id: string;
  table_id: string | null;
  document_path: string;
  document_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AttachDocumentParams = {
  recordId: string;
  baseId: string;
  tableId?: string | null;
  documentPath: string;
  documentName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type UploadAndAttachParams = {
  recordId: string;
  baseId: string;
  tableId?: string | null;
  file: File;
};

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

// Helper to build the full storage path for record-scoped documents
const buildRecordStoragePath = (baseId: string, recordId: string, relativePath: string): string => {
  return `bases/${baseId}/records/${recordId}/${relativePath}`;
};

// Helper to build the full storage path for table-scoped documents
const buildTableStoragePath = (baseId: string, tableId: string | null, relativePath: string): string => {
  if (tableId) {
    return `bases/${baseId}/tables/${tableId}/${relativePath}`;
  }
  return `bases/${baseId}/${relativePath}`;
};

/**
 * Service for managing documents attached to individual records
 */
export const RecordDocumentsService = {
  /**
   * Get all documents attached to a specific record
   */
  async getRecordDocuments(recordId: string): Promise<RecordDocument[]> {
    const { data, error } = await supabase
      .from("record_documents")
      .select("*")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch record documents:", error);
      throw new Error(error.message);
    }

    return data || [];
  },

  /**
   * Attach an existing document to a record
   */
  async attachDocument(params: AttachDocumentParams): Promise<RecordDocument> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Verify user exists in profiles table
    let uploadedBy: string | null = null;
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();
      
      uploadedBy = profile?.id || null;
    }

    const { data, error } = await supabase
      .from("record_documents")
      .insert({
        record_id: params.recordId,
        base_id: params.baseId,
        table_id: params.tableId || null,
        document_path: params.documentPath,
        document_name: params.documentName,
        mime_type: params.mimeType || null,
        size_bytes: params.sizeBytes || null,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to attach document:", error);
      throw new Error(error.message);
    }

    return data;
  },

  /**
   * Upload a file and attach it to a record
   */
  async uploadAndAttach(params: UploadAndAttachParams): Promise<RecordDocument> {
    const { recordId, baseId, tableId, file } = params;

    // Build storage path: bases/{baseId}/records/{recordId}/{filename}
    const prefix = `bases/${baseId}/records/${recordId}/`;
    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/[\s\u2013\u2014]+/g, "-")
      .replace(/[^\w.\-()+]/g, "")
      .replace(/-+/g, "-")
      .replace(/\.+/g, ".")
      .trim() || "file";
    const finalName = `${timestamp}-${sanitizedName}`;
    const fullPath = `${prefix}${finalName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fullPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Failed to upload file:", uploadError);
      throw new Error(uploadError.message);
    }

    // Create record document entry
    try {
      return await this.attachDocument({
        recordId,
        baseId,
        tableId,
        documentPath: fullPath,
        documentName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    } catch (err) {
      // Clean up uploaded file if db insert fails
      await supabase.storage.from(BUCKET).remove([fullPath]).catch(() => {});
      throw err;
    }
  },

  /**
   * Detach (remove) a document from a record
   * Optionally delete the file from storage as well
   */
  async detachDocument(
    id: string,
    options: { deleteFile?: boolean } = {}
  ): Promise<void> {
    // Get the document first
    const { data: doc, error: fetchError } = await supabase
      .from("record_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      console.error("Failed to fetch document for detachment:", fetchError);
      throw new Error(fetchError?.message || "Document not found");
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from("record_documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to detach document:", deleteError);
      throw new Error(deleteError.message);
    }

    // Optionally delete the file from storage
    if (options.deleteFile && doc.document_path) {
      await supabase.storage.from(BUCKET).remove([doc.document_path]).catch((err) => {
        console.warn("Failed to delete file from storage:", err);
      });
    }
  },

  /**
   * Get a signed URL for viewing/downloading a record document
   * @param documentPath - The document path (can be full path starting with "bases/" or relative path)
   * @param expiresIn - URL expiration time in seconds (default: 3600)
   * @param options - Optional baseId, recordId, and tableId to construct full path for relative paths
   */
  async getSignedUrl(
    documentPath: string, 
    expiresIn = 3600,
    options?: { baseId?: string; recordId?: string; tableId?: string | null }
  ): Promise<string> {
    // Clean up the path - remove leading slash if present
    let cleanPath = documentPath.startsWith("/") ? documentPath.slice(1) : documentPath;
    
    // Normalize path: remove double slashes
    cleanPath = cleanPath.replace(/\/+/g, "/");

    // Build list of paths to try
    const pathsToTry: string[] = [];
    
    // If the path already starts with "bases/", use it as-is
    if (cleanPath.startsWith("bases/")) {
      pathsToTry.push(cleanPath);
    } else if (options?.baseId) {
      // For relative paths, try multiple possible storage locations
      // 1. Record-scoped path (most common for record documents)
      if (options.recordId) {
        pathsToTry.push(buildRecordStoragePath(options.baseId, options.recordId, cleanPath));
      }
      // 2. Table-scoped path (if document was originally table-level)
      pathsToTry.push(buildTableStoragePath(options.baseId, options.tableId ?? null, cleanPath));
    } else {
      // No options provided, just use the path as-is
      pathsToTry.push(cleanPath);
    }

    console.log(`[RecordDocuments] Getting signed URL for: "${documentPath}"`);
    console.log(`[RecordDocuments] Paths to try:`, pathsToTry);

    // Try each path until one works
    let lastError: Error | null = null;
    for (const fullPath of pathsToTry) {
      console.log(`[RecordDocuments] Trying path: "${fullPath}"`);
      
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(fullPath, expiresIn);

      if (!error && data?.signedUrl) {
        console.log(`[RecordDocuments] Success! Found document at: "${fullPath}"`);
        return data.signedUrl;
      }

      // Log the error for this path
      const errorMsg = error?.message || "Unknown error";
      console.warn(`[RecordDocuments] Path "${fullPath}" failed: ${errorMsg}`);
      lastError = new Error(errorMsg);
    }

    // All paths failed - log details and throw error
    console.error(`[RecordDocuments] Failed to create signed URL - all paths exhausted`);
    console.error(`  - Original document path: "${documentPath}"`);
    console.error(`  - Paths tried:`, pathsToTry);
    console.error(`  - Bucket: "${BUCKET}"`);
    console.error(`  - Last error: "${lastError?.message || 'Unknown'}"`);
    
    // Provide more helpful error message
    const errorMsg = lastError?.message || "Unknown storage error";
    if (errorMsg.includes("not found") || errorMsg.includes("Object not found") || errorMsg === "Not Found") {
      throw new Error(
        `Document not found in storage. The file may have been deleted or moved. Path: ${documentPath}`
      );
    }
    throw new Error(errorMsg || `Failed to get signed URL for: ${documentPath}`);
  },

  /**
   * Check if a document is already attached to a record
   */
  async isDocumentAttached(recordId: string, documentPath: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("record_documents")
      .select("id")
      .eq("record_id", recordId)
      .eq("document_path", documentPath)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows found", which is expected
      console.error("Failed to check document attachment:", error);
    }

    return !!data;
  },

  /**
   * Check if a document file exists in storage
   */
  async documentExists(documentPath: string): Promise<boolean> {
    try {
      // Try to get file metadata - if it fails with "not found", file doesn't exist
      const cleanPath = documentPath.startsWith("/") ? documentPath.slice(1) : documentPath;
      const normalizedPath = cleanPath.replace(/\/+/g, "/");
      
      // Extract folder and filename from path
      const lastSlash = normalizedPath.lastIndexOf("/");
      const folder = lastSlash >= 0 ? normalizedPath.slice(0, lastSlash) : "";
      const filename = lastSlash >= 0 ? normalizedPath.slice(lastSlash + 1) : normalizedPath;
      
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, {
          search: filename,
          limit: 1,
        });

      if (error) {
        console.warn("Failed to check document existence:", error);
        return false;
      }

      return data?.some(f => f.name === filename) ?? false;
    } catch (err) {
      console.warn("Error checking document existence:", err);
      return false;
    }
  },

  /**
   * Remove orphaned document record (DB entry without corresponding storage file)
   */
  async removeOrphanedRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from("record_documents")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to remove orphaned document record:", error);
      throw new Error(error.message);
    }
  },

  /**
   * Get count of documents attached to a record
   */
  async getDocumentCount(recordId: string): Promise<number> {
    const { count, error } = await supabase
      .from("record_documents")
      .select("*", { count: "exact", head: true })
      .eq("record_id", recordId);

    if (error) {
      console.error("Failed to get document count:", error);
      return 0;
    }

    return count || 0;
  },
};
