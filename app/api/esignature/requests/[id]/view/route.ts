import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ESignatureService } from "@/lib/services/esign-service";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

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

  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

    const cookieNames = projectRef
      ? [
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ]
      : [];

    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter(
      (c) => c.name.startsWith("sb-") && c.name.includes("auth")
    );

    let tokenFromCookie: string | null = null;

    for (const cookieName of cookieNames) {
      const cookie = cookieStore.get(cookieName);
      if (cookie?.value) {
        try {
          const tokenData = JSON.parse(cookie.value);
          tokenFromCookie =
            tokenData?.access_token || tokenData?.accessToken || tokenData;
          if (tokenFromCookie) break;
        } catch {
          tokenFromCookie = cookie.value;
          if (tokenFromCookie && tokenFromCookie.length > 50) break;
        }
      }
    }

    if (!tokenFromCookie && authCookies.length > 0) {
      for (const cookie of authCookies) {
        try {
          const tokenData = JSON.parse(cookie.value);
          tokenFromCookie =
            tokenData?.access_token || tokenData?.accessToken || tokenData;
          if (tokenFromCookie) break;
        } catch {
          if (cookie.value.length > 50) {
            tokenFromCookie = cookie.value;
            break;
          }
        }
      }
    }

    if (tokenFromCookie) {
      return createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${tokenFromCookie}`,
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
    console.warn("Failed to read cookies for auth:", cookieError);
  }

  return supabaseAdmin;
}

/**
 * GET /api/esignature/requests/[id]/view
 * Get signed URL for viewing the signed document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient(request);
    const { id } = await params;

    const signatureRequest = await ESignatureService.getSignatureRequest(id, supabase);

    if (!signatureRequest) {
      return NextResponse.json({ error: "Signature request not found" }, { status: 404 });
    }

    // Check if request is completed or has signed documents
    if (signatureRequest.status !== "completed" && signatureRequest.status !== "in_progress") {
      return NextResponse.json(
        { error: "Document is not yet signed" },
        { status: 400 }
      );
    }

    // Get the document path (for completed requests, this is the signed document)
    const documentPath = signatureRequest.document_path;

    if (!documentPath) {
      return NextResponse.json(
        { error: "Document path not found" },
        { status: 404 }
      );
    }

    // Create signed URL for the document (valid for 1 hour)
    const { data: urlData, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(documentPath, 3600);

    if (error || !urlData) {
      console.error("Failed to create signed URL:", error);
      return NextResponse.json(
        { error: "Failed to get document URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentUrl: urlData.signedUrl,
      documentPath: documentPath,
      title: signatureRequest.title,
      status: signatureRequest.status,
    });
  } catch (error: any) {
    console.error("Failed to get signed document URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get signed document URL" },
      { status: 500 }
    );
  }
}



