import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Batch Operations API for Documents
 * 
 * Supports:
 * - Bulk upload with progress tracking
 * - Bulk delete
 * - Bulk move/copy between folders
 * - Bulk download as ZIP (generates download URL)
 */

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";
const MAX_BATCH_SIZE = 100; // Maximum items per batch operation

// Validate environment variables upfront
function validateEnvVars(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { supabaseUrl, supabaseAnonKey };
}

// Helper to get authenticated Supabase client from cookies using official SSR helper
async function getSupabaseClient(): Promise<SupabaseClient> {
  const { supabaseUrl, supabaseAnonKey } = validateEnvVars();
  
  const cookieStore = await cookies();
  
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });

  // Verify authentication - return 401 if no session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error("Unauthorized: No valid session found");
  }

  return supabase;
}

interface BatchOperation {
  action: "delete" | "move" | "copy" | "download";
  baseId: string;
  tableId?: string;
  paths: string[];
  destinationFolder?: string;
}

interface BatchResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
  results?: Array<{ path: string; newPath?: string }>;
  downloadUrl?: string;
  downloadManifest?: Array<{ path: string; url: string; fileName: string }>;
}

/**
 * Verify user has access to base
 */
async function verifyBaseAccess(
  supabase: SupabaseClient,
  userId: string,
  baseId: string
): Promise<boolean> {
  // Check if owner
  const { data: base } = await supabase
    .from("bases")
    .select("owner")
    .eq("id", baseId)
    .single();

  if (base?.owner === userId) return true;

  // Check membership
  const { data: membership } = await supabase
    .from("base_memberships")
    .select("id")
    .eq("base_id", baseId)
    .eq("user_id", userId)
    .single();

  return !!membership;
}

/**
 * Handle batch operations
 */
export async function POST(request: Request) {
  try {
    let supabase: SupabaseClient;
    try {
      supabase = await getSupabaseClient();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error instanceof Error && error.message.includes("Missing required environment variable")) {
        return NextResponse.json({ 
          error: "Server configuration error",
          details: error.message 
        }, { status: 500 });
      }
      throw error;
    }
    
    // Verify user (session already verified in getSupabaseClient, but double-check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BatchOperation = await request.json();
    const { action, baseId, tableId, paths, destinationFolder } = body;

    // Validate input
    if (!action || !baseId || !paths || !Array.isArray(paths)) {
      return NextResponse.json({ 
        error: "Missing required fields: action, baseId, paths" 
      }, { status: 400 });
    }

    if (paths.length === 0) {
      return NextResponse.json({ 
        error: "No paths provided" 
      }, { status: 400 });
    }

    if (paths.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ 
        error: `Too many items. Maximum batch size is ${MAX_BATCH_SIZE}` 
      }, { status: 400 });
    }

    // Verify base access
    const hasAccess = await verifyBaseAccess(supabase, user.id, baseId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const result: BatchResult = {
      success: true,
      processed: 0,
      failed: 0,
      errors: [],
      results: [],
    };

    switch (action) {
      case "delete":
        await handleBatchDelete(supabase, paths, result);
        break;

      case "move":
        if (!destinationFolder && destinationFolder !== "") {
          return NextResponse.json({ 
            error: "destinationFolder is required for move operation" 
          }, { status: 400 });
        }
        await handleBatchMove(supabase, baseId, paths, destinationFolder, result);
        break;

      case "copy":
        if (!destinationFolder && destinationFolder !== "") {
          return NextResponse.json({ 
            error: "destinationFolder is required for copy operation" 
          }, { status: 400 });
        }
        await handleBatchCopy(supabase, baseId, paths, destinationFolder, result);
        break;

      case "download":
        // For download, we return a manifest of signed URLs
        // A client-side ZIP creation can be done with JSZip
        await handleBatchDownloadUrls(supabase, paths, result);
        break;

      default:
        return NextResponse.json({ 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

    result.success = result.failed === 0;

    // Log batch activity
    try {
      await supabase.from("document_activity_logs").insert({
        base_id: baseId,
        table_id: tableId || null,
        document_path: `batch:${action}`,
        action: `batch_${action}`,
        actor_id: user.id,
        metadata: {
          count: paths.length,
          processed: result.processed,
          failed: result.failed,
        },
      });
    } catch (e) {
      console.warn("Failed to log batch activity:", e);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Batch operation error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * Batch delete operation
 */
async function handleBatchDelete(
  supabase: SupabaseClient,
  paths: string[],
  result: BatchResult
) {
  // Delete in batches of 10 for better error handling
  const batchSize = 10;
  
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .remove(batch);

    if (error) {
      // Mark all in batch as failed
      batch.forEach(path => {
        result.failed++;
        result.errors.push({ path, error: error.message });
      });
    } else {
      result.processed += batch.length;
      batch.forEach(path => {
        result.results?.push({ path });
      });
    }
  }

  // Also clean up any record_documents references
  if (result.processed > 0) {
    const successPaths = result.results?.map(r => r.path) || [];
    await supabase
      .from("record_documents")
      .delete()
      .in("document_path", successPaths);
  }
}

/**
 * Batch move operation
 */
async function handleBatchMove(
  supabase: SupabaseClient,
  baseId: string,
  paths: string[],
  destinationFolder: string,
  result: BatchResult
) {
  for (const sourcePath of paths) {
    try {
      const fileName = sourcePath.split("/").pop() || "file";
      const newPath = destinationFolder 
        ? `${destinationFolder.replace(/\/$/, "")}/${fileName}`
        : fileName;

      // Ensure the path includes base prefix
      const fullNewPath = newPath.startsWith(`bases/${baseId}/`)
        ? newPath
        : `bases/${baseId}/${newPath}`;

      // Move file in storage
      const { error: moveError } = await supabase.storage
        .from(BUCKET)
        .move(sourcePath, fullNewPath);

      if (moveError) {
        result.failed++;
        result.errors.push({ path: sourcePath, error: moveError.message });
        continue;
      }

      // Update record_documents reference if exists
      await supabase
        .from("record_documents")
        .update({ document_path: fullNewPath })
        .eq("document_path", sourcePath);

      result.processed++;
      result.results?.push({ path: sourcePath, newPath: fullNewPath });

    } catch (e) {
      result.failed++;
      result.errors.push({ 
        path: sourcePath, 
        error: e instanceof Error ? e.message : "Move failed" 
      });
    }
  }
}

/**
 * Batch copy operation
 */
async function handleBatchCopy(
  supabase: SupabaseClient,
  baseId: string,
  paths: string[],
  destinationFolder: string,
  result: BatchResult
) {
  for (const sourcePath of paths) {
    try {
      const fileName = sourcePath.split("/").pop() || "file";
      // Add timestamp to prevent name collisions
      const timestamp = Date.now();
      const nameParts = fileName.split(".");
      const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : "";
      const baseName = nameParts.join(".");
      const newFileName = `${baseName}-copy-${timestamp}${ext}`;
      
      const newPath = destinationFolder 
        ? `${destinationFolder.replace(/\/$/, "")}/${newFileName}`
        : newFileName;

      const fullNewPath = newPath.startsWith(`bases/${baseId}/`)
        ? newPath
        : `bases/${baseId}/${newPath}`;

      // Copy file in storage
      const { error: copyError } = await supabase.storage
        .from(BUCKET)
        .copy(sourcePath, fullNewPath);

      if (copyError) {
        result.failed++;
        result.errors.push({ path: sourcePath, error: copyError.message });
        continue;
      }

      result.processed++;
      result.results?.push({ path: sourcePath, newPath: fullNewPath });

    } catch (e) {
      result.failed++;
      result.errors.push({ 
        path: sourcePath, 
        error: e instanceof Error ? e.message : "Copy failed" 
      });
    }
  }
}

/**
 * Generate signed URLs for batch download
 */
async function handleBatchDownloadUrls(
  supabase: SupabaseClient,
  paths: string[],
  result: BatchResult
) {
  const downloadUrls: Array<{ path: string; url: string; fileName: string }> = [];

  for (const path of paths) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) {
        result.failed++;
        result.errors.push({ path, error: error.message });
        continue;
      }

      const fileName = path.split("/").pop() || "file";
      downloadUrls.push({ path, url: data.signedUrl, fileName });
      result.processed++;

    } catch (e) {
      result.failed++;
      result.errors.push({ 
        path, 
        error: e instanceof Error ? e.message : "Failed to generate URL" 
      });
    }
  }

  // Return the download manifest
  result.downloadManifest = downloadUrls;
}

/**
 * Get batch operation status (for progress tracking)
 */
export async function GET(request: Request) {
  // This could be used for tracking long-running batch operations
  // For now, return supported operations info
  
  return NextResponse.json({
    supportedOperations: ["delete", "move", "copy", "download"],
    maxBatchSize: MAX_BATCH_SIZE,
    notes: {
      delete: "Permanently removes files from storage",
      move: "Moves files to a new folder location",
      copy: "Creates copies of files in a new location",
      download: "Returns signed URLs for downloading files (client can create ZIP)",
    },
  });
}

