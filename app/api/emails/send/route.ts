import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RecordEmailService } from "@/lib/services/record-email-service";
import type { SendEmailPayload, EmailRecipient } from "@/lib/types/base-detail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SendEmailRequest {
  record_id: string;
  to: string;
  to_name?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  in_reply_to?: string;
  template_id?: string;
  attachment_ids?: string[]; // Document IDs to attach
}

/**
 * POST /api/emails/send
 * Send an email from a record (with optional attachments)
 */
export async function POST(request: Request) {
  try {
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

    const userId = userData.user.id;

    // Parse request body
    const body = await request.json() as SendEmailRequest;

    // Validate required fields
    if (!body.record_id) {
      return NextResponse.json(
        { error: "record_id is required" },
        { status: 400 }
      );
    }

    if (!body.to || !body.to.includes("@")) {
      return NextResponse.json(
        { error: "Valid recipient email (to) is required" },
        { status: 400 }
      );
    }

    if (!body.subject?.trim()) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    if (!body.body_html?.trim()) {
      return NextResponse.json(
        { error: "Email body (body_html) is required" },
        { status: 400 }
      );
    }

    // Verify user has access to the record
    const { data: record, error: recordError } = await supabase
      .from("records")
      .select(`
        id,
        table_id,
        tables!inner (
          base_id,
          bases!inner (
            workspace_id
          )
        )
      `)
      .eq("id", body.record_id)
      .single();

    if (recordError || !record) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    // Build the payload
    const payload: SendEmailPayload = {
      record_id: body.record_id,
      to: body.to.trim(),
      to_name: body.to_name,
      subject: body.subject.trim(),
      body_html: body.body_html,
      body_text: body.body_text,
      cc: body.cc,
      bcc: body.bcc,
      in_reply_to: body.in_reply_to,
      template_id: body.template_id,
    };

    // Send the email (with or without attachments)
    let email;
    if (body.attachment_ids && body.attachment_ids.length > 0) {
      // Validate total attachment size (10MB limit for UI)
      const { data: docs } = await supabase
        .from("record_documents")
        .select("size")
        .in("id", body.attachment_ids);

      if (docs) {
        const totalSize = docs.reduce((sum, d) => sum + (d.size || 0), 0);
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (totalSize > maxSize) {
          return NextResponse.json(
            { error: `Total attachment size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds 10MB limit` },
            { status: 400 }
          );
        }
      }

      email = await RecordEmailService.sendEmailWithAttachments(
        payload,
        body.attachment_ids,
        userId
      );
    } else {
      email = await RecordEmailService.sendEmail(payload, userId);
    }

    return NextResponse.json({
      success: true,
      email: {
        id: email.id,
        message_id: email.message_id,
        status: email.status,
        attachment_count: email.attachment_count || 0,
        created_at: email.created_at,
      },
    });
  } catch (error) {
    console.error("Error sending email:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for specific error types
    if (errorMessage.includes("RESEND_API_KEY")) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Failed to send email: ${errorMessage}` },
      { status: 500 }
    );
  }
}
