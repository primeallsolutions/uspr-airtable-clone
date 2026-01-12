import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ESignatureService, SignatureRequest } from "@/lib/services/esign-service";

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
  // Try to get user's auth token from Authorization header first
  const authHeader = request.headers.get("authorization");
  let accessToken = authHeader?.replace("Bearer ", "");

  // If no token in header, try cookies
  if (!accessToken) {
    try {
      const cookieStore = await cookies();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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

      for (const cookieName of cookieNames) {
        const cookie = cookieStore.get(cookieName);
        if (cookie?.value) {
          try {
            const tokenData = JSON.parse(cookie.value);
            accessToken = tokenData?.access_token || tokenData?.accessToken || tokenData;
            if (accessToken) break;
          } catch {
            accessToken = cookie.value;
            if (accessToken && accessToken.length > 50) break;
          }
        }
      }

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
    } catch (cookieError) {
      console.warn("Failed to read cookies for auth:", cookieError);
    }
  }

  if (accessToken) {
    // Create client with user's token (preferred - respects RLS)
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

  // Only use admin client if no user token found (and service role key exists)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin;
  }

  // No auth token found and no service role key
  throw new Error("No authentication token found");
}

/**
 * GET /api/esignature/requests
 * List signature requests for a base
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient(request);
    const { searchParams } = new URL(request.url);
    const baseId = searchParams.get("baseId");
    const tableId = searchParams.get("tableId");

    if (!baseId) {
      return NextResponse.json({ error: "baseId is required" }, { status: 400 });
    }

    const requests = await ESignatureService.listSignatureRequests(
      baseId,
      tableId || null,
      supabase
    );

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("Failed to list signature requests:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list signature requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/esignature/requests
 * Create a new signature request
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient(request);
    const body = await request.json();

    const {
      baseId,
      tableId,
      title,
      message,
      document_path,
      expires_at,
      signers,
      fields,
      packItems,
      // Status column update fields
      record_id,
      status_field_id,
      status_value_on_complete,
      status_value_on_decline,
    } = body;

    if (!baseId || !title || !document_path) {
      return NextResponse.json(
        { error: "baseId, title, and document_path are required" },
        { status: 400 }
      );
    }

    // Get current user from the authenticated client
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("Authentication failed:", userError?.message || "No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user profile exists in profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    
    // Use profile ID if exists, otherwise null (foreign key constraint allows null)
    const createdBy = profile?.id || null;

    // Create signature request
    let signatureRequest: SignatureRequest;
    if (packItems && packItems.length > 0) {
      // Create a pack
      signatureRequest = await ESignatureService.createPack(
        {
          base_id: baseId,
          table_id: tableId || null,
          title,
          message,
          document_path,
          expires_at,
          created_by: createdBy,
          // Status column update fields
          record_id: record_id || null,
          status_field_id: status_field_id || null,
          status_value_on_complete: status_value_on_complete || "Signed",
          status_value_on_decline: status_value_on_decline || "Declined",
        },
        packItems,
        supabase
      );
    } else {
      // Create regular request
      signatureRequest = await ESignatureService.createSignatureRequest({
        base_id: baseId,
        table_id: tableId || null,
        title,
        message,
        document_path,
        expires_at,
        created_by: createdBy,
        // Status column update fields
        record_id: record_id || null,
        status_field_id: status_field_id || null,
        status_value_on_complete: status_value_on_complete || "Signed",
        status_value_on_decline: status_value_on_decline || "Declined",
      }, supabase);
    }

    // Add signers if provided
    if (signers && signers.length > 0) {
      const createdSigners = await ESignatureService.addSigners(
        signatureRequest.id!,
        signers,
        supabase
      );
      signatureRequest.signers = createdSigners;

      // Add fields if provided
      if (fields && fields.length > 0) {
        // Map field signer references (by email) to signer IDs
        const fieldsWithSignerIds = fields.map((field: any) => {
          const signer = createdSigners.find((s) => s.email === field.signer_email);
          if (!signer) {
            throw new Error(`Signer with email ${field.signer_email} not found`);
          }
          return {
            ...field,
            signer_id: signer.id,
          };
        });

        await ESignatureService.addSignatureFields(
          signatureRequest.id!,
          fieldsWithSignerIds,
          supabase
        );
      }
    }

    // Get full request with relations
    const fullRequest = await ESignatureService.getSignatureRequest(signatureRequest.id!, supabase);

    return NextResponse.json({ request: fullRequest });
  } catch (error: any) {
    console.error("Failed to create signature request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create signature request" },
      { status: 500 }
    );
  }
}







