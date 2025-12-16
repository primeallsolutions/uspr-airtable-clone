import { NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "no-reply@localhost";

type InvitePayload = {
  email: string;
  token: string;
  role: string;
  workspaceId?: string | null;
  baseId?: string | null;
};

export async function POST(request: Request) {
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });
  }

  const body = (await request.json()) as InvitePayload;
  const { email, token, role, workspaceId, baseId } = body;

  if (!email || !token || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const acceptUrl = `${APP_BASE_URL}/invites/accept/${token}`;
  const scopeLabel = workspaceId ? "workspace" : baseId ? "base" : "workspace";

  const subject = `You're invited to a ${scopeLabel}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
      <h2 style="color: #111827; margin-bottom: 8px;">You've been invited</h2>
      <p style="margin: 4px 0;">You've been added as <strong>${role}</strong> to this ${scopeLabel}.</p>
      <p style="margin: 12px 0;">
        <a href="${acceptUrl}" style="background: #2563eb; color: #fff; padding: 12px 16px; border-radius: 8px; text-decoration: none; display: inline-block;">
          Accept invite
        </a>
      </p>
      <p style="margin-top: 12px; font-size: 13px; color: #6b7280;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <span style="color: #111827;">${acceptUrl}</span>
      </p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Failed to send invite email via Resend:", errorBody);
      return NextResponse.json({ error: "Failed to send invite email" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error sending invite email:", err);
    return NextResponse.json({ error: "Unexpected error sending invite email" }, { status: 500 });
  }
}
