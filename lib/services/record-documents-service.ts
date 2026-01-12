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
   */
  async getSignedUrl(documentPath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(documentPath, expiresIn);

    if (error) {
      console.error("Failed to create signed URL:", error);
      throw new Error(error.message);
    }

    return data.signedUrl;
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
