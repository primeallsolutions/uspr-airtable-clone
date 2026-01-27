import { NextRequest, NextResponse } from "next/server";
import { ESignatureService } from "@/lib/services/esign-service";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * POST /api/esignature/webhook
 * Handle webhooks for signature status updates
 * This can be called by external services or used internally for real-time updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, requestId, signerId, status, data } = body;

    // Verify webhook signature if configured
    const signature = request.headers.get("x-signature");
    const webhookSecret = process.env.ESIGNATURE_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const expectedSignature = createHmac("sha256", webhookSecret)
        .update(JSON.stringify(body))
        .digest("hex");

      // Use constant-time comparison
      const expectedBuffer = Buffer.from(expectedSignature);
      const receivedBuffer = Buffer.from(signature);
      if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Handle different event types
    switch (event) {
      case "signer.viewed":
        if (signerId) {
          await ESignatureService.updateSignerStatus(signerId, "viewed", {
            viewed_at: new Date().toISOString(),
          });
          if (requestId) {
            await ESignatureService.checkAndUpdateRequestCompletion(requestId);
          }
        }
        break;

      case "signer.signed":
        if (signerId) {
          await ESignatureService.updateSignerStatus(signerId, "signed", {
            signed_at: new Date().toISOString(),
            signed_document_path: data?.signed_document_path,
          });
          if (requestId) {
            await ESignatureService.checkAndUpdateRequestCompletion(requestId);
          }
        }
        break;

      case "signer.declined":
        if (signerId) {
          await ESignatureService.updateSignerStatus(signerId, "declined", {
            declined_at: new Date().toISOString(),
            decline_reason: data?.decline_reason,
          });
          if (requestId) {
            await ESignatureService.checkAndUpdateRequestCompletion(requestId);
          }
        }
        break;

      case "request.completed":
        if (requestId) {
          await ESignatureService.updateRequestStatus(requestId, "completed", {
            completed_at: new Date().toISOString(),
            completion_certificate_path: data?.completion_certificate_path,
          });
        }
        break;

      default:
        console.warn(`Unknown webhook event: ${event}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}



