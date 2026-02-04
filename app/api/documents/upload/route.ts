import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Document Upload API with Server-Side Validation
 * 
 * Features:
 * - File type whitelist validation
 * - Max file size enforcement
 * - Malware scanning integration point
 * - Rate limiting ready
 */

// Configuration
const MAX_FILE_SIZE = parseInt(process.env.DOCUMENT_MAX_SIZE_MB || "50") * 1024 * 1024; // 50MB default
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

// Helper to get authenticated Supabase client from cookies
async function getSupabaseClient(): Promise<SupabaseClient> {
  // Validate environment variables and throw descriptive errors if missing
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. Please ensure this variable is set in your environment configuration.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. Please ensure this variable is set in your environment configuration.");
  }
  
  try {
    const cookieStore = await cookies();
    
    // Supabase stores access token in cookies with pattern: sb-<project-ref>-auth-token
    // Extract project ref from URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    // Try different cookie name patterns
    const cookieNames = projectRef 
      ? [
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ]
      : [];
    
    // Also check for any cookie starting with 'sb-'
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter(c => c.name.startsWith('sb-') && c.name.includes('auth'));
    
    let accessToken: string | null = null;
    
    // Try to find access token in cookies
    for (const cookieName of cookieNames) {
      const cookie = cookieStore.get(cookieName);
      if (cookie?.value) {
        try {
          const tokenData = JSON.parse(cookie.value);
          accessToken = tokenData?.access_token || tokenData?.accessToken || tokenData;
          if (accessToken) break;
        } catch {
          // Try as direct token
          accessToken = cookie.value;
          if (accessToken && accessToken.length > 50) break; // Likely a token
        }
      }
    }
    
    // If not found in named cookies, try auth cookies
    if (!accessToken && authCookies.length > 0) {
      for (const cookie of authCookies) {
        try {
          const tokenData = JSON.parse(cookie.value);
          accessToken = tokenData?.access_token || tokenData?.accessToken || tokenData;
          if (accessToken) break;
        } catch {
          if (cookie.value.length > 50) {
            accessToken = cookie.value;
            break;
          }
        }
      }
    }
    
    if (accessToken) {
      return createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
  } catch (cookieError) {
    console.warn("Failed to read cookies:", cookieError);
  }

  // Fallback: create client without auth (will fail RLS checks)
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Allowed file types (MIME types)
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/tiff",
  "image/bmp",
  
  // Archives (optional - can be disabled)
  "application/zip",
  "application/x-zip-compressed",
]);

// Blocked file extensions (even if MIME type is spoofed)
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".dll", ".bat", ".cmd", ".sh", ".ps1",
  ".msi", ".vbs", ".js", ".jar", ".py", ".php",
  ".asp", ".aspx", ".jsp", ".cgi", ".scr", ".pif",
]);

// Magic bytes for common file types (for additional validation)
const MAGIC_BYTES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  "image/gif": [0x47, 0x49, 0x46],
  "application/zip": [0x50, 0x4B, 0x03, 0x04],
};

/**
 * Validate file type using magic bytes
 */
async function validateMagicBytes(buffer: ArrayBuffer, mimeType: string): Promise<boolean> {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return true; // No magic bytes check for this type
  
  const bytes = new Uint8Array(buffer.slice(0, expected.length));
  return expected.every((byte, i) => bytes[i] === byte);
}

/**
 * Sanitize filename for storage
 */
function sanitizeFileName(name: string): string {
  const fallback = "file";
  const base = (name || fallback)
    .replace(/[\s\u2013\u2014]+/g, "-")
    .replace(/[^\w.\-()+]/g, "")
    .replace(/-+/g, "-")
    .replace(/\.+/g, ".")
    .trim();
  return base.length > 0 ? base : fallback;
}

/**
 * Get file extension
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
}

/**
 * Normalize and validate folder path to prevent path traversal attacks
 */
function normalizeFolderPath(folderPath: string): string {
  if (!folderPath) return "";
  
  // Convert backslashes to forward slashes and strip leading slashes
  let normalized = folderPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  
  // Split into segments and filter out ".." and empty segments
  const segments = normalized.split("/").filter(segment => {
    // Reject ".." segments and empty segments
    return segment !== ".." && segment !== "." && segment.length > 0;
  });
  
  // Rejoin the path
  normalized = segments.join("/");
  
  // Final safety check: reject if the path still contains ".." anywhere
  if (normalized.includes("..")) {
    return "";
  }
  
  return normalized;
}

/**
 * Build storage path for document
 */
function buildStoragePath(params: {
  baseId: string;
  tableId?: string | null;
  recordId?: string | null;
  folderPath?: string;
  fileName: string;
  preserveName?: boolean;
}): string {
  const { baseId, tableId, recordId, folderPath = "", fileName, preserveName = false } = params;
  
  // Build prefix based on context
  let prefix: string;
  if (recordId) {
    prefix = `bases/${baseId}/records/${recordId}/`;
  } else if (tableId) {
    prefix = `bases/${baseId}/tables/${tableId}/`;
  } else {
    prefix = `bases/${baseId}/`;
  }
  
  // Normalize and validate folderPath to prevent path traversal
  const normalizedFolder = normalizeFolderPath(folderPath);
  const safeFolder = normalizedFolder ? `${normalizedFolder}/` : "";
  const safeName = sanitizeFileName(fileName);
  
  // Add timestamp prefix unless preserving name
  const finalName = preserveName 
    ? safeName 
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
  
  return `${prefix}${safeFolder}${finalName}`;
}

export async function POST(request: Request) {
  try {
    let supabase: SupabaseClient;
    try {
      supabase = await getSupabaseClient();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Missing required environment variable")) {
        return NextResponse.json({ 
          error: "Server configuration error",
          details: error.message 
        }, { status: 500 });
      }
      throw error;
    }
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const baseId = formData.get("baseId") as string | null;
    const tableId = formData.get("tableId") as string | null;
    const recordId = formData.get("recordId") as string | null;
    const folderPath = formData.get("folderPath") as string | null;
    const preserveName = formData.get("preserveName") === "true";

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!baseId) {
      return NextResponse.json({ error: "baseId is required" }, { status: 400 });
    }

    // Verify user has access to the base
    const { data: baseRecord, error: baseError } = await supabase
      .from("bases")
      .select("id, owner")
      .eq("id", baseId)
      .single();

    // Handle database error
    if (baseError) {
      console.error("Failed to fetch base:", baseError);
      return NextResponse.json({ error: "Failed to verify base access" }, { status: 500 });
    }

    // Base doesn't exist
    if (!baseRecord) {
      return NextResponse.json({ error: "Base not found" }, { status: 404 });
    }

    // Check authorization: owner has access, otherwise check membership
    if (baseRecord.owner !== user.id) {
      const { data: membership } = await supabase
        .from("base_memberships")
        .select("id")
        .eq("base_id", baseId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Access denied to this base" }, { status: 403 });
      }
    }

    // ===== FILE VALIDATION =====
    
    // 1. Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        code: "FILE_TOO_LARGE"
      }, { status: 413 });
    }

    if (file.size === 0) {
      return NextResponse.json({ 
        error: "Empty file not allowed",
        code: "EMPTY_FILE"
      }, { status: 400 });
    }

    // 2. Check MIME type
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ 
        error: `File type not allowed: ${mimeType}`,
        code: "INVALID_FILE_TYPE",
        allowedTypes: Array.from(ALLOWED_MIME_TYPES)
      }, { status: 415 });
    }

    // 3. Check file extension
    const extension = getExtension(file.name);
    if (BLOCKED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ 
        error: `File extension not allowed: ${extension}`,
        code: "BLOCKED_EXTENSION"
      }, { status: 415 });
    }

    // 4. Validate magic bytes for known file types
    const buffer = await file.arrayBuffer();
    const isMagicValid = await validateMagicBytes(buffer, mimeType);
    if (!isMagicValid) {
      return NextResponse.json({ 
        error: "File content does not match declared type",
        code: "CONTENT_TYPE_MISMATCH"
      }, { status: 415 });
    }

    // 5. TODO: Add malware scanning integration point
    // if (MALWARE_SCAN_ENABLED) {
    //   const scanResult = await scanForMalware(buffer);
    //   if (scanResult.infected) {
    //     return NextResponse.json({ error: "File rejected by security scan" }, { status: 400 });
    //   }
    // }

    // ===== UPLOAD FILE =====
    
    const storagePath = buildStoragePath({
      baseId,
      tableId,
      recordId,
      folderPath: folderPath || "",
      fileName: file.name,
      preserveName,
    });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        cacheControl: "3600",
        upsert: preserveName,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      const isProduction = process.env.NODE_ENV === "production";
      return NextResponse.json({ 
        error: "Failed to upload file",
        ...(isProduction ? {} : { details: uploadError.message })
      }, { status: 500 });
    }

    // ===== LINK TO RECORD (if applicable) =====
    
    if (recordId) {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      // Insert record document link
      const { error: linkError } = await supabase
        .from("record_documents")
        .insert({
          record_id: recordId,
          base_id: baseId,
          table_id: tableId || null,
          document_path: storagePath,
          document_name: file.name,
          mime_type: mimeType,
          size_bytes: file.size,
          uploaded_by: profile?.id || null,
        });

      if (linkError) {
        console.warn("Failed to link document to record:", linkError);
        // Don't fail the upload, just log the warning
      }
    }

    // ===== LOG ACTIVITY =====
    
    try {
      const { error: activityError } = await supabase
        .from("document_activity_logs")
        .insert({
          base_id: baseId,
          table_id: tableId || null,
          record_id: recordId || null,
          document_path: storagePath,
          action: "upload",
          actor_id: user.id,
          metadata: {
            file_name: file.name,
            file_size: file.size,
            mime_type: mimeType,
          },
        });

      if (activityError) {
        console.warn("Failed to log activity:", activityError);
      }
    } catch (e) {
      console.warn("Activity logging error:", e);
    }

    // Return success
    return NextResponse.json({
      success: true,
      path: storagePath,
      fileName: file.name,
      size: file.size,
      mimeType,
    });

  } catch (error) {
    console.error("Document upload error:", error);
    
    // Only include error details in non-production environments
    const isProduction = process.env.NODE_ENV === "production";
    return NextResponse.json({ 
      error: "Internal server error",
      ...(isProduction ? {} : { details: error instanceof Error ? error.message : "Unknown error" })
    }, { status: 500 });
  }
}

// Get upload configuration
export async function GET() {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
    allowedTypes: Array.from(ALLOWED_MIME_TYPES),
    blockedExtensions: Array.from(BLOCKED_EXTENSIONS),
  });
}

