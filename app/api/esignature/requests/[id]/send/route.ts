import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

  // Try cookies as fallback
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
 * POST /api/esignature/requests/[id]/send
 * Send signature request to all signers
 */
export async function POST(
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

    if (!signatureRequest.signers || signatureRequest.signers.length === 0) {
      return NextResponse.json(
        { error: "No signers added to this request" },
        { status: 400 }
      );
    }

    // Send emails to all signers (handle errors individually so some can succeed even if others fail)
    const emailResults = await Promise.allSettled(
      signatureRequest.signers.map(async (signer) => {
        try {
          await ESignatureService.sendSignatureRequestEmail(
            { ...signer, signature_request_id: id },
            signatureRequest
          );
          // Update signer status to "sent" only if email was sent successfully
          await ESignatureService.updateSignerStatus(signer.id!, "sent", undefined, supabase);
          return { success: true, signer: signer.email };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to send email to ${signer.email}:`, errorMessage);
          // Don't update status if email failed - keep as "pending"
          return { success: false, signer: signer.email, error: errorMessage };
        }
      })
    );

    // Check if at least one email was sent successfully
    const successfulSends = emailResults.filter(
      (result) => result.status === "fulfilled" && result.value.success
    );

    if (successfulSends.length === 0) {
      // Collect error messages for better debugging
      const failedSends = emailResults.filter(
        (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.success)
      );
      const errorMessages = failedSends.map((result) => {
        if (result.status === "rejected") {
          return result.reason?.message || String(result.reason);
        }
        return result.value.error || "Unknown error";
      }).join("; ");

      return NextResponse.json(
        { 
          error: "Failed to send emails to all signers. Please check your email configuration.",
          details: errorMessages || "No error details available"
        },
        { status: 500 }
      );
    }

    // Log any failures
    const failedSends = emailResults.filter(
      (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.success)
    );
    if (failedSends.length > 0) {
      const failureDetails = failedSends.map((result) => {
        if (result.status === "rejected") {
          return `${result.reason?.message || String(result.reason)}`;
        }
        return `${result.value.signer}: ${result.value.error || "Unknown error"}`;
      }).join("; ");
      console.warn(`${failedSends.length} email(s) failed to send: ${failureDetails}`);
    }

    // Update request status to "sent"
    await ESignatureService.updateRequestStatus(id, "sent", undefined, supabase);

    // Try to get the updated request, but don't fail if this errors
    // since the emails have already been sent successfully
    let updatedRequest = null;
    try {
      updatedRequest = await ESignatureService.getSignatureRequest(id, supabase);
    } catch (fetchError) {
      console.warn("Failed to fetch updated request after send, but emails were sent:", fetchError);
    }

    return NextResponse.json({ 
      request: updatedRequest,
      success: true,
      emailsSent: successfulSends.length,
      emailsFailed: failedSends.length,
    });
  } catch (error: any) {
    console.error("Failed to send signature request:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: errorMessage || "Failed to send signature request",
        details: errorStack ? errorStack.split("\n")[0] : undefined
      },
      { status: 500 }
    );
  }
}







