import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Fail fast if SUPABASE_SERVICE_ROLE_KEY is missing - this is required for admin operations
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is required for signed URL generation. " +
    "Please set it in your environment variables."
  );
}

// Create admin client for server-side operations (only created after validating service role key exists)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to get authenticated Supabase client from request
// Returns null if no valid authentication is provided
async function getSupabaseClient(request: NextRequest): Promise<SupabaseClient | null> {
  // Try to get user's auth token from Authorization header
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  
  if (accessToken) {
    // Create client with user's token (respects RLS)
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // No valid authentication provided - return null to signal unauthenticated
  return null;
}

// Helper to get admin client for authenticated server-side operations
function getAdminClient(): SupabaseClient {
  return supabaseAdmin;
}

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

const basePrefix = (baseId: string, tableId?: string | null, recordId?: string | null) => {
  // Record-scoped documents are stored at bases/{baseId}/records/{recordId}/ 
  // regardless of tableId (matching documents-service.ts recordPrefix)
  if (recordId) {
    return `bases/${baseId}/records/${recordId}/`;
  }
  // Table/base-scoped documents
  return tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
};

/**
 * GET /api/documents/signed-url
 * Get signed URL for a document file
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseId = searchParams.get("baseId");
    const tableId = searchParams.get("tableId");
    const recordId = searchParams.get("recordId");
    const path = searchParams.get("path");
    
    // Validate and parse expiresIn with fallback to safe default
    const DEFAULT_EXPIRES_IN = 600;
    const expiresInParam = searchParams.get("expiresIn");
    let expiresIn = DEFAULT_EXPIRES_IN;
    
    if (expiresInParam !== null) {
      const parsed = parseInt(expiresInParam, 10);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: "expiresIn must be a positive integer" },
          { status: 400 }
        );
      }
      expiresIn = parsed;
    }

    if (!baseId) {
      return NextResponse.json({ error: "baseId is required" }, { status: 400 });
    }

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    // Verify user is authenticated
    const userClient = await getSupabaseClient(request);
    if (!userClient) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate the token and get the authenticated user
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      console.error("Auth validation failed:", authError);
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }
    const userId = userData.user.id;

    // Use admin client for authorization check and storage operations
    const supabase = getAdminClient();

    // Verify user has access to this base (must be owner or member)
    const { data: accessCheck, error: accessError } = await supabase
      .from("bases")
      .select(`
        id,
        owner,
        base_memberships!left(user_id)
      `)
      .eq("id", baseId)
      .single();

    if (accessError || !accessCheck) {
      console.error("Base access check failed:", accessError);
      return NextResponse.json(
        { error: "Base not found" },
        { status: 404 }
      );
    }

    // Check if user is owner or member
    const isOwner = accessCheck.owner === userId;
    const isMember = Array.isArray(accessCheck.base_memberships) && 
      accessCheck.base_memberships.some((m: { user_id: string }) => m.user_id === userId);

    if (!isOwner && !isMember) {
      console.error("User not authorized for base:", { userId, baseId });
      return NextResponse.json(
        { error: "You do not have access to this base" },
        { status: 403 }
      );
    }
    
    // Construct the full path
    const prefix = basePrefix(baseId, tableId || null, recordId || null);
    
    // Clean up the path - remove leading slash if present
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    
    // Check if the path already includes the prefix
    let fullPath: string;
    if (cleanPath.startsWith("bases/")) {
      // Path already includes the full path structure
      fullPath = cleanPath;
    } else {
      fullPath = `${prefix}${cleanPath}`;
    }
    
    // Remove any trailing slashes and double slashes
    fullPath = fullPath.replace(/\/+/g, "/").replace(/\/$/, "");

    console.log("Creating signed URL for:", { baseId, tableId, recordId, path, fullPath, expiresIn });

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(fullPath, expiresIn);
    
    if (error) {
      console.error("Failed to create signed URL:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create signed URL" },
        { status: 500 }
      );
    }

    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: "No signed URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error: any) {
    console.error("Failed to get signed URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get signed URL" },
      { status: 500 }
    );
  }
}

