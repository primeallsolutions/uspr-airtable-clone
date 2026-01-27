"use client";

import { supabase } from "@/lib/supabaseClient";

// Types
export type DocumentVersion = {
  id: string;
  document_path: string;
  base_id: string;
  table_id: string | null;
  version_number: number;
  version_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
  notes: string | null;
  is_current: boolean;
};

export type CreateVersionParams = {
  documentPath: string;
  baseId: string;
  tableId?: string | null;
  file: File;
  notes?: string;
};

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

/**
 * Service for managing document version history
 */
export const DocumentVersionService = {
  /**
   * Get all versions of a document
   */
  async getVersions(
    documentPath: string,
    baseId: string
  ): Promise<DocumentVersion[]> {
    const { data, error } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_path", documentPath)
      .eq("base_id", baseId)
      .order("version_number", { ascending: false });

    if (error) {
      console.error("Failed to fetch document versions:", error);
      throw new Error(error.message);
    }

    return data || [];
  },

  /**
   * Get the current (latest) version of a document
   */
  async getCurrentVersion(
    documentPath: string,
    baseId: string
  ): Promise<DocumentVersion | null> {
    const { data, error } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_path", documentPath)
      .eq("base_id", baseId)
      .eq("is_current", true)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Failed to fetch current version:", error);
      throw new Error(error.message);
    }

    return data || null;
  },

  /**
   * Create a new version of a document
   */
  async createVersion(params: CreateVersionParams): Promise<DocumentVersion> {
    const { documentPath, baseId, tableId, file, notes } = params;
    const { data: user } = await supabase.auth.getUser();

    // Build version storage path
    const pathParts = documentPath.split("/");
    const fileName = pathParts.pop() || file.name;
    const basePath = pathParts.join("/");
    const timestamp = Date.now();
    const versionPath = `${basePath}/.versions/${timestamp}-${fileName}`;

    // Upload the versioned file
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(versionPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Failed to upload version file:", uploadError);
      throw new Error(uploadError.message);
    }

    // Create version record (trigger will handle version_number and is_current)
    const { data, error } = await supabase
      .from("document_versions")
      .insert({
        document_path: documentPath,
        base_id: baseId,
        table_id: tableId || null,
        version_path: versionPath,
        file_name: fileName,
        mime_type: file.type,
        size_bytes: file.size,
        created_by: user?.user?.id || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create version record:", error);
      // Clean up uploaded file
      await supabase.storage.from(BUCKET).remove([versionPath]).catch(() => {});
      throw new Error(error.message);
    }

    return data;
  },

  /**
   * Restore a previous version as the current version
   * This copies the version file back to the original path
   */
  async restoreVersion(versionId: string): Promise<DocumentVersion> {
    // Get the version to restore
    const { data: version, error: fetchError } = await supabase
      .from("document_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (fetchError || !version) {
      throw new Error("Version not found");
    }

    // Download the version file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(version.version_path);

    if (downloadError) {
      console.error("Failed to download version file:", downloadError);
      throw new Error(downloadError.message);
    }

    // Create a File object from the blob
    const file = new File([fileData], version.file_name, {
      type: version.mime_type || "application/octet-stream",
    });

    // Create a new version (which will become current)
    return this.createVersion({
      documentPath: version.document_path,
      baseId: version.base_id,
      tableId: version.table_id,
      file,
      notes: `Restored from version ${version.version_number}`,
    });
  },

  /**
   * Delete a specific version (not the current version)
   */
  async deleteVersion(versionId: string): Promise<void> {
    // Get the version to delete
    const { data: version, error: fetchError } = await supabase
      .from("document_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (fetchError || !version) {
      throw new Error("Version not found");
    }

    // Prevent deleting current version
    if (version.is_current) {
      throw new Error("Cannot delete the current version");
    }

    // Delete the version record
    const { error: deleteError } = await supabase
      .from("document_versions")
      .delete()
      .eq("id", versionId);

    if (deleteError) {
      console.error("Failed to delete version:", deleteError);
      throw new Error(deleteError.message);
    }

    // Clean up the version file from storage
    await supabase.storage
      .from(BUCKET)
      .remove([version.version_path])
      .catch((err) => {
        console.warn("Failed to delete version file:", err);
      });
  },

  /**
   * Get a signed URL for viewing/downloading a version
   */
  async getVersionSignedUrl(
    versionPath: string,
    expiresIn = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(versionPath, expiresIn);

    if (error) {
      console.error("Failed to create signed URL:", error);
      throw new Error(error.message);
    }

    return data.signedUrl;
  },

  /**
   * Get the version count for a document
   */
  async getVersionCount(documentPath: string, baseId: string): Promise<number> {
    const { count, error } = await supabase
      .from("document_versions")
      .select("*", { count: "exact", head: true })
      .eq("document_path", documentPath)
      .eq("base_id", baseId);

    if (error) {
      console.error("Failed to get version count:", error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Compare two versions (returns metadata for comparison UI)
   */
  async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<{ version1: DocumentVersion; version2: DocumentVersion; url1: string; url2: string }> {
    const [result1, result2] = await Promise.all([
      supabase.from("document_versions").select("*").eq("id", versionId1).single(),
      supabase.from("document_versions").select("*").eq("id", versionId2).single(),
    ]);

    if (result1.error || result2.error || !result1.data || !result2.data) {
      throw new Error("One or both versions not found");
    }

    const [url1, url2] = await Promise.all([
      this.getVersionSignedUrl(result1.data.version_path),
      this.getVersionSignedUrl(result2.data.version_path),
    ]);

    return {
      version1: result1.data,
      version2: result2.data,
      url1,
      url2,
    };
  },
};
