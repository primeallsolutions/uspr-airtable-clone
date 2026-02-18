import { NextResponse } from "next/server";
import crypto from "crypto";
import { RecordEmailService } from "@/lib/services/record-email-service";
import type { InboundEmailPayload, EmailEventType } from "@/lib/types/base-detail";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/**
 * Verify Resend webhook signature
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!RESEND_WEBHOOK_SECRET || !signature) {
    // In development, allow without signature
    if (process.env.NODE_ENV === "development") {
      console.warn("Webhook signature verification skipped in development");
      return true;
    }
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", RESEND_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extract metadata from webhook request for tracking
 */
function extractTrackingMetadata(data: Record<string, unknown>): {
  ip_address?: string;
  user_agent?: string;
  location?: Record<string, string>;
} {
  return {
    ip_address: data.ip as string | undefined,
    user_agent: data.user_agent as string | undefined,
    location: data.location as Record<string, string> | undefined,
  };
}

/**
 * POST /api/emails/inbound
 * Webhook endpoint for receiving inbound emails and email events from Resend
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("svix-signature") || 
                      request.headers.get("x-resend-signature");

    // Verify webhook signature
    if (!verifySignature(rawBody, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);

    // Handle different event types from Resend
    const eventType = body.type;
    const eventData = body.data || {};
    const messageId = eventData.email_id || eventData.message_id || eventData.id;

    console.log(`Processing webhook event: ${eventType}`, { messageId });

    switch (eventType) {
      case "email.received":
      case "email.inbound": {
        // Process inbound email
        const emailData = body.data;
        
        // Parse the email payload
        const payload: InboundEmailPayload = {
          from: emailData.from?.email || emailData.from,
          from_name: emailData.from?.name,
          to: Array.isArray(emailData.to) 
            ? emailData.to[0]?.email || emailData.to[0]
            : emailData.to?.email || emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
          message_id: emailData.message_id || emailData.id,
          in_reply_to: emailData.in_reply_to,
          attachments: emailData.attachments?.map((att: {
            filename?: string;
            content_type?: string;
            size?: number;
          }) => ({
            filename: att.filename,
            content_type: att.content_type,
            size: att.size,
          })),
          headers: emailData.headers,
        };

        const result = await RecordEmailService.processInboundEmail(payload);

        if (result) {
          console.log("Inbound email processed:", result.id);
          return NextResponse.json({
            success: true,
            email_id: result.id,
          });
        } else {
          // Email address not found or duplicate
          return NextResponse.json({
            success: true,
            message: "Email not linked to any record",
          });
        }
      }

      case "email.sent": {
        // Record sent event
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "sent" as EmailEventType,
            { timestamp: eventData.created_at },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      case "email.delivered": {
        // Record delivered event with tracking
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "delivered" as EmailEventType,
            { timestamp: eventData.created_at },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      case "email.opened": {
        // Record open event with detailed tracking
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "opened" as EmailEventType,
            { 
              timestamp: eventData.created_at,
              raw_event: eventData,
            },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      case "email.clicked": {
        // Record click event with link URL
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "clicked" as EmailEventType,
            { 
              timestamp: eventData.created_at,
              url: eventData.link || eventData.url,
              raw_event: eventData,
            },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      case "email.bounced": {
        // Record bounce event with error details
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "bounced" as EmailEventType,
            { 
              timestamp: eventData.created_at,
              bounce_type: eventData.bounce_type,
              error: eventData.error || eventData.message,
              raw_event: eventData,
            },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      case "email.complained": {
        // Record spam complaint event
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "complained" as EmailEventType,
            { 
              timestamp: eventData.created_at,
              raw_event: eventData,
            },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      case "email.delivery_failed": {
        // Record failed delivery event
        if (messageId) {
          await RecordEmailService.recordEmailEvent(
            messageId,
            "failed" as EmailEventType,
            { 
              timestamp: eventData.created_at,
              error: eventData.error || eventData.message,
              raw_event: eventData,
            },
            extractTrackingMetadata(eventData)
          );
        }
        return NextResponse.json({ success: true });
      }

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
        return NextResponse.json({
          success: true,
          message: `Event type ${eventType} acknowledged`,
        });
    }
  } catch (error) {
    console.error("Error processing inbound email webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emails/inbound
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "inbound email webhook",
    supported_events: [
      "email.received",
      "email.inbound",
      "email.sent",
      "email.delivered",
      "email.opened",
      "email.clicked",
      "email.bounced",
      "email.complained",
      "email.delivery_failed",
    ],
    timestamp: new Date().toISOString(),
  });
}
