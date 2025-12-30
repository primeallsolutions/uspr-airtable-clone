import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ESignatureService } from "@/lib/services/esign-service";

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
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin;
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (accessToken) {
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

  return supabaseAdmin;
}

/**
 * GET /api/esignature/requests/[id]/versions
 * Get version history for a signature request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient(request);
    const { id } = await params;

    const versions = await ESignatureService.getVersions(id);

    return NextResponse.json({ versions });
  } catch (error: any) {
    console.error("Failed to get versions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get versions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/esignature/requests/[id]/versions
 * Create a new version of a signature request document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient(request);
    const { id } = await params;
    const body = await request.json();
    const { document_path, change_description } = body;

    if (!document_path) {
      return NextResponse.json(
        { error: "document_path is required" },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const version = await ESignatureService.createVersion(id, {
      document_path,
      created_by: user.id,
      change_description,
    });

    return NextResponse.json({ version });
  } catch (error: any) {
    console.error("Failed to create version:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create version" },
      { status: 500 }
    );
  }
}








