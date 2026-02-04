import { supabase } from "../supabaseClient";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

// Base prefix for base/table-level documents
const basePrefix = (baseId: string, tableId?: string | null) =>
  tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;

// Record-scoped prefix for record-level documents
const recordPrefix = (baseId: string, recordId: string) =>
  `bases/${baseId}/records/${recordId}/`;

// Supabase Storage keys must be URL-safe; strip/replace unsafe chars and normalize.
const sanitizeFileName = (name: string) => {
  const fallback = "file";
  const base = (name || fallback)
    // Replace spaces and unicode dashes with hyphens
    .replace(/[\s\u2013\u2014]+/g, "-")
    // Drop characters that are commonly rejected in paths
    .replace(/[^\w.\-()+]/g, "")
    // Collapse duplicate separators
    .replace(/-+/g, "-")
    .replace(/\.+/g, ".")
    .trim();
  return base.length > 0 ? base : fallback;
};

export type StoredDocument = {
  path: string; // relative to prefix (includes folder segments and file name)
  size: number;
  mimeType: string;
  createdAt: string;
};

export const DocumentsService = {
  /**
   * List documents for a base/table or filtered by record
   * When recordId is provided, returns only documents linked to that specific record
   */
  async listDocuments(baseId: string, tableId?: string | null, recordId?: string | null): Promise<StoredDocument[]> {
    // If recordId is provided, use record-scoped logic
    if (recordId) {
      return this.listRecordDocuments(baseId, recordId);
    }
    
    const prefix = basePrefix(baseId, tableId);
    
    // Recursively list all files in the prefix and subdirectories
    const allFiles: StoredDocument[] = [];
    
    const listRecursive = async (currentPrefix: string): Promise<void> => {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).list(currentPrefix, {
          limit: 1000,
          offset: 0,
          sortBy: { column: "name", order: "asc" }
        });
        
        if (error) {
          // If folder doesn't exist, just return (don't throw)
          if (error.message?.includes("not found") || error.message?.includes("404")) {
            return;
          }
          throw error;
        }
        if (!data) return;

        for (const item of data) {
          if (!item.name || item.name.trim().length === 0) continue;
          
          // Check if it's a folder (folders typically have id === null or no metadata)
          // Files have metadata with size
          const isFolderItem = item.id === null || item.metadata === null || 
                              (item.metadata && !("size" in item.metadata));
          
          if (isFolderItem && !item.name.endsWith(".keep")) {
            // It's a folder, recurse into it
            const folderPath = currentPrefix.endsWith("/") 
              ? `${currentPrefix}${item.name}/` 
              : `${currentPrefix}/${item.name}/`;
            await listRecursive(folderPath);
          } else {
            // It's a file (or .keep file)
            // Make path relative to the base prefix
            const relativePath = currentPrefix === prefix 
              ? item.name 
              : `${currentPrefix.slice(prefix.length)}${item.name}`;
            
            allFiles.push({
              path: relativePath,
              size: item.metadata?.size ?? 0,
              mimeType: (item.metadata as any)?.mimetype || "application/octet-stream",
              createdAt: item.created_at || new Date().toISOString()
            });
          }
        }
      } catch (err) {
        // Log but don't throw - allow partial results
        console.warn(`Failed to list directory ${currentPrefix}:`, err);
      }
    };

    await listRecursive(prefix);
    return allFiles;
  },

  /**
   * List documents linked to a specific record from record_documents table
   */
  async listRecordDocuments(baseId: string, recordId: string): Promise<StoredDocument[]> {
    // Get all document links from record_documents table
    const { data: recordDocs, error } = await supabase
      .from("record_documents")
      .select("document_path, document_name, mime_type, size_bytes, created_at")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch record documents:", error);
      throw new Error(error.message);
    }

    if (!recordDocs || recordDocs.length === 0) {
      return [];
    }

    // Convert to StoredDocument format
    // Extract relative path from full storage path for display
    const prefix = recordPrefix(baseId, recordId);
    return recordDocs.map((doc) => {
      // The document_path is the full storage path, make it relative for display
      let relativePath = doc.document_path;
      if (relativePath.startsWith(prefix)) {
        relativePath = relativePath.slice(prefix.length);
      }
      
      return {
        path: relativePath,
        size: doc.size_bytes || 0,
        mimeType: doc.mime_type || "application/octet-stream",
        createdAt: doc.created_at || new Date().toISOString(),
      };
    });
  },

  /**
   * List folders for a record (from record_documents paths)
   */
  async listRecordFolders(baseId: string, recordId: string): Promise<Array<{ name: string; path: string; parent_path: string | null }>> {
    // Query document_folders scoped to record
    const { data, error } = await supabase
      .from("document_folders")
      .select("name, path, parent_path")
      .eq("base_id", baseId)
      .eq("record_id", recordId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch record folders:", error);
      return [];
    }

    return data || [];
  },

  async uploadDocument(params: {
    baseId: string;
    tableId?: string | null;
    recordId?: string | null; // When provided, uploads to record-scoped path and links to record
    folderPath?: string;
    file: File;
    preserveName?: boolean; // If true, keeps the original filename without timestamp prefix
  }): Promise<string> {
    const { baseId, tableId, recordId, folderPath = "", file, preserveName = false } = params;
    if (!file || file.size === 0) {
      throw new Error("Empty file or missing file data");
    }
    
    // Use record-scoped prefix if recordId is provided
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    const safeFolder = folderPath ? (folderPath.endsWith("/") ? folderPath : `${folderPath}/`) : "";
    const safeName = sanitizeFileName(file.name);
    
    // Use original name if preserveName is true, otherwise add timestamp prefix
    const finalName = preserveName ? safeName : `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
    const fullPath = `${prefix}${safeFolder}${finalName}`;

    const { error } = await supabase.storage.from(BUCKET).upload(fullPath, file, {
      cacheControl: "3600",
      upsert: preserveName, // Allow overwrite when preserving name
      contentType: file.type || "application/octet-stream"
    });
    if (error) throw error;
    
    // If recordId is provided, also link the document to the record
    if (recordId) {
      await this.linkDocumentToRecord({
        recordId,
        baseId,
        tableId,
        documentPath: fullPath,
        documentName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    }
    
    return `${safeFolder}${finalName}`;
  },
  
  /**
   * Link an uploaded document to a record in record_documents table
   */
  async linkDocumentToRecord(params: {
    recordId: string;
    baseId: string;
    tableId?: string | null;
    documentPath: string;
    documentName: string;
    mimeType?: string;
    sizeBytes?: number;
  }): Promise<void> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    let uploadedBy: string | null = null;
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();
      uploadedBy = profile?.id || null;
    }

    const { error } = await supabase
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
      });

    if (error) {
      console.error("Failed to link document to record:", error);
      // Don't throw - the file is already uploaded, just log the error
    }
  },

  async createFolder(baseId: string, tableId: string | null, parentPath: string, name: string, recordId?: string | null): Promise<string> {
    // Use record-scoped prefix if recordId is provided
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    const safeParent = parentPath ? (parentPath.endsWith("/") ? parentPath : `${parentPath}/`) : "";
    const safeName = sanitizeFileName(name);
    const fullPath = `${prefix}${safeParent}${safeName}/.keep`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fullPath, new Blob([""], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
    if (error) throw error;
    
    // persist folder metadata for richer permissions/sharing
    // Check if folder already exists first, then insert or ignore
    const folderPath = `${safeParent}${safeName}/`;
    
    // Check if this folder already exists
    let existingQuery = supabase
      .from("document_folders")
      .select("id")
      .eq("base_id", baseId)
      .eq("path", folderPath);
    
    if (recordId) {
      existingQuery = existingQuery.eq("record_id", recordId);
    } else if (tableId) {
      existingQuery = existingQuery.eq("table_id", tableId).is("record_id", null);
    } else {
      existingQuery = existingQuery.is("table_id", null).is("record_id", null);
    }
    
    const { data: existing } = await existingQuery.single();
    
    // If folder already exists, just return the path
    if (existing) {
      return folderPath;
    }
    
    // Insert new folder
    const folderData: Record<string, unknown> = {
      base_id: baseId,
      table_id: tableId,
      path: folderPath,
      name: safeName,
      parent_path: safeParent || null,
    };
    if (recordId) {
      folderData.record_id = recordId;
    }
    
    const { error: insertError } = await supabase
      .from("document_folders")
      .insert(folderData);
    
    // Ignore duplicate key errors (folder was created by another request)
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }
    
    return folderPath;
  },

  async getSignedUrl(baseId: string, tableId: string | null, relativePath: string, expiresIn = 600, recordId?: string | null) {
    // Use record-scoped prefix if recordId is provided
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    
    // Ensure relativePath doesn't start with a slash (to avoid double slashes)
    const cleanPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
    const fullPath = `${prefix}${cleanPath}`;
    
    // Remove any trailing slashes (except for the prefix itself)
    const finalPath = fullPath.replace(/\/+$/, "") || fullPath;
    
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(finalPath, expiresIn);
      if (error) {
        console.error("Failed to create signed URL:", {
          fullPath: finalPath,
          relativePath,
          prefix,
          error: error.message
        });
        throw error;
      }
      return data.signedUrl;
    } catch (err: any) {
      console.error("Error creating signed URL:", {
        fullPath: finalPath,
        relativePath,
        prefix,
        error: err
      });
      throw err;
    }
  },

  async deleteDocument(baseId: string, tableId: string | null, relativePath: string, recordId?: string | null) {
    // Use record-scoped prefix if recordId is provided
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    const fullPath = `${prefix}${relativePath}`;
    
    const { error } = await supabase.storage.from(BUCKET).remove([fullPath]);
    if (error) throw error;
    
    // If recordId is provided, also remove the link from record_documents
    if (recordId) {
      await supabase
        .from("record_documents")
        .delete()
        .eq("record_id", recordId)
        .eq("document_path", fullPath)
        .throwOnError();
    }
  },

  async renameDocument(baseId: string, tableId: string | null, oldRelativePath: string, newRelativePath: string, recordId?: string | null) {
    // Use record-scoped prefix if recordId is provided
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    const oldFullPath = `${prefix}${oldRelativePath}`;
    const newFullPath = `${prefix}${newRelativePath}`;
    
    const { error } = await supabase.storage
      .from(BUCKET)
      .move(oldFullPath, newFullPath);
    if (error) throw error;
    
    // If recordId is provided, update the path in record_documents
    if (recordId) {
      const newName = newRelativePath.split("/").pop() || newRelativePath;
      await supabase
        .from("record_documents")
        .update({ document_path: newFullPath, document_name: newName })
        .eq("record_id", recordId)
        .eq("document_path", oldFullPath)
        .throwOnError();
    }
  },

  async listFolders(baseId: string, tableId: string | null, parentPath: string | null = null, includeAll: boolean = false, recordId?: string | null) {
    // If recordId is provided, use record-scoped folder listing
    if (recordId) {
      return this.listRecordFolders(baseId, recordId);
    }
    
    let query = supabase
      .from("document_folders")
      .select("name, path, parent_path")
      .eq("base_id", baseId);

    if (tableId) {
      query = query.eq("table_id", tableId);
    } else {
      query = query.is("table_id", null);
    }

    // If includeAll is true, return all folders regardless of parent_path
    if (!includeAll) {
      if (parentPath === null || parentPath === "") {
        // Root folders: parent_path is null
        query = query.is("parent_path", null);
      } else {
        query = query.eq("parent_path", parentPath);
      }
    }

    query = query.order("name", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async deleteFolder(baseId: string, tableId: string | null, folderPath: string) {
    const prefix = basePrefix(baseId, tableId);
    
    // Delete the .keep file from storage
    const keepFilePath = `${prefix}${folderPath}.keep`;
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([keepFilePath]);
    if (storageError) throw storageError;
    
    // Delete folder metadata from database
    let query = supabase
      .from("document_folders")
      .delete()
      .eq("base_id", baseId)
      .eq("path", folderPath);
    
    if (tableId) {
      query = query.eq("table_id", tableId);
    } else {
      query = query.is("table_id", null);
    }
    
    const { error: dbError } = await query;
    if (dbError) throw dbError;
  },

  async renameFolder(baseId: string, tableId: string | null, oldPath: string, newName: string) {
    const prefix = basePrefix(baseId, tableId);
    const safeName = sanitizeFileName(newName);
    
    // Extract parent path from old path
    const parentPath = oldPath.split("/").slice(0, -1).join("/");
    const newPath = parentPath ? `${parentPath}/${safeName}/` : `${safeName}/`;
    
    // Move the .keep file in storage
    const oldKeepPath = `${prefix}${oldPath}.keep`;
    const newKeepPath = `${prefix}${newPath}.keep`;
    
    const { error: moveError } = await supabase.storage
      .from(BUCKET)
      .move(oldKeepPath, newKeepPath);
    if (moveError) throw moveError;
    
    // Update folder metadata in database
    let query = supabase
      .from("document_folders")
      .update({
        name: safeName,
        path: newPath,
      })
      .eq("base_id", baseId)
      .eq("path", oldPath);
    
    if (tableId) {
      query = query.eq("table_id", tableId);
    } else {
      query = query.is("table_id", null);
    }
    
    const { error: updateError } = await query;
    if (updateError) throw updateError;
    
    // Update paths for all child folders (recursively)
    const { data: childFolders } = await supabase
      .from("document_folders")
      .select("path, parent_path")
      .eq("base_id", baseId)
      .like("path", `${oldPath}%`);
    
    if (childFolders && childFolders.length > 0) {
      for (const child of childFolders) {
        const newChildPath = child.path.replace(oldPath, newPath);
        // Calculate new parent_path: if parent was oldPath, it's now newPath, otherwise update the path segment
        const newParentPath = child.parent_path === oldPath 
          ? newPath 
          : child.parent_path?.replace(oldPath, newPath) || null;
        
        await supabase
          .from("document_folders")
          .update({ 
            path: newChildPath,
            parent_path: newParentPath
          })
          .eq("base_id", baseId)
          .eq("path", child.path);
      }
    }
    
    return newPath;
  },

  /**
   * Copy a document to a different folder
   */
  async copyDocument(params: {
    baseId: string;
    tableId?: string | null;
    recordId?: string | null;
    sourceRelativePath: string;
    targetFolderPath: string;
    newFileName?: string;
  }): Promise<string> {
    const { baseId, tableId, recordId, sourceRelativePath, targetFolderPath, newFileName } = params;
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    
    const sourceFullPath = `${prefix}${sourceRelativePath}`;
    
    // Extract filename from source if newFileName not provided
    const fileName = newFileName || sourceRelativePath.split("/").pop() || "copy";
    const targetFolder = targetFolderPath.endsWith("/") ? targetFolderPath : `${targetFolderPath}/`;
    const targetFullPath = `${prefix}${targetFolder}${fileName}`;
    
    // Download the source file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(sourceFullPath);
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download source document: ${downloadError?.message}`);
    }
    
    // Upload to target location
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(targetFullPath, fileData, {
        cacheControl: "3600",
        upsert: false,
        contentType: fileData.type || "application/octet-stream"
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload copied document: ${uploadError.message}`);
    }
    
    // If recordId is provided, also link the copied document to the record
    if (recordId) {
      const mimeType = (fileData as any).type || "application/octet-stream";
      await this.linkDocumentToRecord({
        recordId,
        baseId,
        tableId,
        documentPath: targetFullPath,
        documentName: fileName,
        mimeType,
        sizeBytes: fileData.size,
      });
    }
    
    return `${targetFolder}${fileName}`;
  },

  /**
   * Move a document to a different folder
   */
  async moveDocument(params: {
    baseId: string;
    tableId?: string | null;
    recordId?: string | null;
    sourceRelativePath: string;
    targetFolderPath: string;
    newFileName?: string;
  }): Promise<string> {
    const { baseId, tableId, recordId, sourceRelativePath, targetFolderPath, newFileName } = params;
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    
    const sourceFullPath = `${prefix}${sourceRelativePath}`;
    
    // Extract filename from source if newFileName not provided
    const fileName = newFileName || sourceRelativePath.split("/").pop() || "file";
    const targetFolder = targetFolderPath.endsWith("/") ? targetFolderPath : `${targetFolderPath}/`;
    const targetFullPath = `${prefix}${targetFolder}${fileName}`;
    
    // Move the file in storage
    const { error: moveError } = await supabase.storage
      .from(BUCKET)
      .move(sourceFullPath, targetFullPath);
    
    if (moveError) {
      throw new Error(`Failed to move document: ${moveError.message}`);
    }
    
    // If recordId is provided, update the path in record_documents
    if (recordId) {
      await supabase
        .from("record_documents")
        .update({ document_path: targetFullPath, document_name: fileName })
        .eq("record_id", recordId)
        .eq("document_path", sourceFullPath)
        .throwOnError();
    }
    
    return `${targetFolder}${fileName}`;
  },

  /**
   * Move a folder (and all its contents) to a different parent folder or to root
   * @param targetParentPath - The target parent folder path, or empty string/"" for root level
   */
  async moveFolder(params: {
    baseId: string;
    tableId?: string | null;
    recordId?: string | null;
    sourceFolderPath: string; // e.g., "Parent/Child/" or "Child/"
    targetParentPath: string; // e.g., "NewParent/" or "" for root
  }): Promise<string> {
    const { baseId, tableId, recordId, sourceFolderPath, targetParentPath } = params;
    const prefix = recordId ? recordPrefix(baseId, recordId) : basePrefix(baseId, tableId);
    
    // Extract the folder name from the source path
    const sourcePathNormalized = sourceFolderPath.endsWith("/") ? sourceFolderPath.slice(0, -1) : sourceFolderPath;
    const folderName = sourcePathNormalized.split("/").pop() || "";
    if (!folderName) {
      throw new Error("Invalid source folder path");
    }
    
    // Calculate the new path
    const targetParentNormalized = targetParentPath ? (targetParentPath.endsWith("/") ? targetParentPath : `${targetParentPath}/`) : "";
    const newFolderPath = `${targetParentNormalized}${folderName}/`;
    
    // Check if we're trying to move a folder into itself or its children
    if (newFolderPath.startsWith(sourceFolderPath)) {
      throw new Error("Cannot move a folder into itself or its subfolders");
    }
    
    // Check if target folder already exists (would cause conflict)
    let existingQuery = supabase
      .from("document_folders")
      .select("id")
      .eq("base_id", baseId)
      .eq("path", newFolderPath);
    
    if (recordId) {
      existingQuery = existingQuery.eq("record_id", recordId);
    } else if (tableId) {
      existingQuery = existingQuery.eq("table_id", tableId).is("record_id", null);
    } else {
      existingQuery = existingQuery.is("table_id", null).is("record_id", null);
    }
    
    const { data: existing } = await existingQuery.single();
    if (existing) {
      throw new Error(`A folder with name "${folderName}" already exists in the target location`);
    }
    
    // Move the .keep file in storage
    const sourceKeepPath = `${prefix}${sourceFolderPath}.keep`;
    const targetKeepPath = `${prefix}${newFolderPath}.keep`;
    
    const { error: moveError } = await supabase.storage
      .from(BUCKET)
      .move(sourceKeepPath, targetKeepPath);
    
    if (moveError) {
      throw new Error(`Failed to move folder: ${moveError.message}`);
    }
    
    // Update the folder's path and parent_path in the database
    let updateQuery = supabase
      .from("document_folders")
      .update({
        path: newFolderPath,
        parent_path: targetParentNormalized || null,
      })
      .eq("base_id", baseId)
      .eq("path", sourceFolderPath);
    
    if (recordId) {
      updateQuery = updateQuery.eq("record_id", recordId);
    } else if (tableId) {
      updateQuery = updateQuery.eq("table_id", tableId).is("record_id", null);
    } else {
      updateQuery = updateQuery.is("table_id", null).is("record_id", null);
    }
    
    const { error: updateError } = await updateQuery;
    if (updateError) {
      throw new Error(`Failed to update folder metadata: ${updateError.message}`);
    }
    
    // Update all child folders to have new paths
    let childQuery = supabase
      .from("document_folders")
      .select("id, path, parent_path")
      .eq("base_id", baseId)
      .like("path", `${sourceFolderPath}%`)
      .neq("path", sourceFolderPath);
    
    if (recordId) {
      childQuery = childQuery.eq("record_id", recordId);
    } else if (tableId) {
      childQuery = childQuery.eq("table_id", tableId).is("record_id", null);
    } else {
      childQuery = childQuery.is("table_id", null).is("record_id", null);
    }
    
    const { data: childFolders } = await childQuery;
    
    if (childFolders && childFolders.length > 0) {
      for (const child of childFolders) {
        // Calculate new child path by replacing the old root with new root
        const newChildPath = child.path.replace(sourceFolderPath, newFolderPath);
        const newChildParentPath = child.parent_path?.replace(sourceFolderPath, newFolderPath) || newFolderPath;
        
        // Move the .keep file for child folders
        const childSourceKeepPath = `${prefix}${child.path}.keep`;
        const childTargetKeepPath = `${prefix}${newChildPath}.keep`;
        
        await supabase.storage
          .from(BUCKET)
          .move(childSourceKeepPath, childTargetKeepPath);
        
        // Update the child folder metadata
        await supabase
          .from("document_folders")
          .update({
            path: newChildPath,
            parent_path: newChildParentPath === "" ? null : newChildParentPath,
          })
          .eq("id", child.id);
      }
    }
    
    // Move all documents within the folder to the new path
    // List all files in the source folder and subfolders recursively
    const listRecursive = async (currentPath: string): Promise<Array<{ oldPath: string; fileName: string; subPath: string }>> => {
      const files: Array<{ oldPath: string; fileName: string; subPath: string }> = [];
      const fullCurrentPath = `${prefix}${currentPath}`;
      
      try {
        const { data, error } = await supabase.storage.from(BUCKET).list(fullCurrentPath, {
          limit: 1000,
          sortBy: { column: "name", order: "asc" }
        });
        
        if (error || !data) return files;
        
        for (const item of data) {
          if (!item.name || item.name === ".keep") continue;
          
          const isFolder = item.id === null || item.metadata === null;
          
          if (isFolder) {
            // Recursively get files from subfolders
            const subFiles = await listRecursive(`${currentPath}${item.name}/`);
            files.push(...subFiles);
          } else {
            files.push({
              oldPath: `${currentPath}${item.name}`,
              fileName: item.name,
              subPath: currentPath.replace(sourceFolderPath, ""),
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to list directory ${currentPath}:`, err);
      }
      
      return files;
    };
    
    const filesToMove = await listRecursive(sourceFolderPath);
    
    for (const file of filesToMove) {
      const sourceFilePath = `${prefix}${file.oldPath}`;
      const targetFilePath = `${prefix}${newFolderPath}${file.subPath}${file.fileName}`;
      
      await supabase.storage
        .from(BUCKET)
        .move(sourceFilePath, targetFilePath);
      
      // If recordId is provided, update the path in record_documents
      if (recordId) {
        await supabase
          .from("record_documents")
          .update({ document_path: targetFilePath })
          .eq("record_id", recordId)
          .eq("document_path", sourceFilePath);
      }
    }
    
    return newFolderPath;
  }
};

