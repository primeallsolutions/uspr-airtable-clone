import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RecordEmailService } from "@/lib/services/record-email-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RouteParams {
  params: Promise<{ recordId: string }>;
}

/**
 * GET /api/emails/address/[recordId]
 * Get or create the unique email address for a record
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { recordId } = await params;

    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify user with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Validate record ID
    if (!recordId) {
      return NextResponse.json(
        { error: "Record ID is required" },
        { status: 400 }
      );
    }

    // Verify the record exists
    const { data: record, error: recordError } = await supabase
      .from("records")
      .select("id")
      .eq("id", recordId)
      .single();

    if (recordError || !record) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    // Get or create the email address for this record
    const emailAddress = await RecordEmailService.generateRecordEmailAddress(recordId);

    return NextResponse.json({
      email_address: emailAddress.email_address,
      record_id: emailAddress.record_id,
      is_active: emailAddress.is_active,
      created_at: emailAddress.created_at,
    });
  } catch (error) {
    console.error("Error getting record email address:", error);
    return NextResponse.json(
      { error: "Failed to get email address" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/emails/address/[recordId]
 * Update the email address status (activate/deactivate)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { recordId } = await params;

    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify user with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Update active status
    if (typeof body.is_active === "boolean") {
      const { data, error } = await supabase
        .from("record_email_addresses")
        .update({ is_active: body.is_active })
        .eq("record_id", recordId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to update email address" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        email_address: data.email_address,
        record_id: data.record_id,
        is_active: data.is_active,
      });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating record email address:", error);
    return NextResponse.json(
      { error: "Failed to update email address" },
      { status: 500 }
    );
  }
}
