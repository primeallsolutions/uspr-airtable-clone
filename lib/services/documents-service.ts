import { supabase } from "../supabaseClient";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

const basePrefix = (baseId: string, tableId?: string | null) =>
  tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;

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
  async listDocuments(baseId: string, tableId?: string | null): Promise<StoredDocument[]> {
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

  async uploadDocument(params: {
    baseId: string;
    tableId?: string | null;
    folderPath?: string;
    file: File;
    preserveName?: boolean; // If true, keeps the original filename without timestamp prefix
  }): Promise<string> {
    const { baseId, tableId, folderPath = "", file, preserveName = false } = params;
    if (!file || file.size === 0) {
      throw new Error("Empty file or missing file data");
    }
    const prefix = basePrefix(baseId, tableId);
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
    return `${safeFolder}${finalName}`;
  },

  async createFolder(baseId: string, tableId: string | null, parentPath: string, name: string): Promise<string> {
    const prefix = basePrefix(baseId, tableId);
    const safeParent = parentPath ? (parentPath.endsWith("/") ? parentPath : `${parentPath}/`) : "";
    const safeName = sanitizeFileName(name);
    const fullPath = `${prefix}${safeParent}${safeName}/.keep`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fullPath, new Blob([""], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
    if (error) throw error;
    // persist folder metadata for richer permissions/sharing
    await supabase
      .from("document_folders")
      .upsert(
        {
          base_id: baseId,
          table_id: tableId,
          path: `${safeParent}${safeName}/`,
          name: safeName,
          parent_path: safeParent || null
        },
        {
          onConflict: "base_id,table_id,path",
          ignoreDuplicates: true
        }
      )
      .throwOnError();
    return `${safeParent}${safeName}/`;
  },

  async getSignedUrl(baseId: string, tableId: string | null, relativePath: string, expiresIn = 600) {
    const prefix = basePrefix(baseId, tableId);
    
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

  async deleteDocument(baseId: string, tableId: string | null, relativePath: string) {
    const prefix = basePrefix(baseId, tableId);
    const { error } = await supabase.storage.from(BUCKET).remove([`${prefix}${relativePath}`]);
    if (error) throw error;
  },

  async renameDocument(baseId: string, tableId: string | null, oldRelativePath: string, newRelativePath: string) {
    const prefix = basePrefix(baseId, tableId);
    const { error } = await supabase.storage
      .from(BUCKET)
      .move(`${prefix}${oldRelativePath}`, `${prefix}${newRelativePath}`);
    if (error) throw error;
  },

  async listFolders(baseId: string, tableId: string | null, parentPath: string | null = null, includeAll: boolean = false) {
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
  }
};

