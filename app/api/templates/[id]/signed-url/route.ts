import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to get authenticated Supabase client from request
async function getSupabaseClient(request: NextRequest) {
  // If service role key is available, use admin client (bypasses RLS)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin;
  }

  // Otherwise, try to get user's auth token from Authorization header
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  
  if (accessToken) {
    // Create client with user's token
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

  // Fallback to admin client
  return supabaseAdmin;
}

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

const basePrefix = (baseId: string, tableId?: string | null) =>
  tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;

/**
 * GET /api/templates/[id]/signed-url
 * Get signed URL for template file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;
    
    const searchParams = request.nextUrl.searchParams;
    const baseId = searchParams.get("baseId");
    const tableId = searchParams.get("tableId");

    if (!baseId) {
      return NextResponse.json({ error: "baseId is required" }, { status: 400 });
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    // Get template to find file path
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("template_file_path")
      .eq("id", id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get signed URL
    const prefix = basePrefix(baseId, tableId || null);
    const cleanPath = template.template_file_path.startsWith("/") 
      ? template.template_file_path.slice(1) 
      : template.template_file_path;
    const fullPath = `${prefix}${cleanPath}`;
    const finalPath = fullPath.replace(/\/+$/, "") || fullPath;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(finalPath, 600);
    
    if (error) {
      console.error("Failed to create signed URL:", error);
      throw error;
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

