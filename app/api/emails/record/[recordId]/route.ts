import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RecordEmailService } from "@/lib/services/record-email-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RouteParams {
  params: Promise<{ recordId: string }>;
}

/**
 * GET /api/emails/record/[recordId]
 * Get all emails for a specific record
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

    // Parse query parameters
    const url = new URL(request.url);
    const direction = url.searchParams.get("direction") as "inbound" | "outbound" | null;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Get emails for the record
    const emails = await RecordEmailService.getRecordEmails(recordId, {
      direction: direction || undefined,
      limit,
      offset,
    });

    // Get total count
    const totalCount = await RecordEmailService.getEmailCount(recordId);

    // Get record email address if it exists
    const emailAddress = await RecordEmailService.getRecordEmailAddress(recordId);

    return NextResponse.json({
      emails,
      total: totalCount,
      limit,
      offset,
      record_email_address: emailAddress?.email_address || null,
    });
  } catch (error) {
    console.error("Error fetching record emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/emails/record/[recordId]
 * Mark emails as read or update email status
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

    // Handle mark as read
    if (body.action === "mark_read" && body.email_id) {
      await RecordEmailService.markAsRead(body.email_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating email:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/record/[recordId]
 * Delete an email from a record
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

    // Get email ID from query params
    const url = new URL(request.url);
    const emailId = url.searchParams.get("email_id");

    if (!emailId) {
      return NextResponse.json(
        { error: "email_id is required" },
        { status: 400 }
      );
    }

    // Verify the email belongs to this record
    const { data: email } = await supabase
      .from("record_emails")
      .select("record_id")
      .eq("id", emailId)
      .single();

    if (!email || email.record_id !== recordId) {
      return NextResponse.json(
        { error: "Email not found for this record" },
        { status: 404 }
      );
    }

    await RecordEmailService.deleteEmail(emailId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email:", error);
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}
