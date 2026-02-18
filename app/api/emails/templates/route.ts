import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RecordEmailService } from "@/lib/services/record-email-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getSupabaseAdmin = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * GET /api/emails/templates
 * List all email templates for a workspace
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active_only") !== "false";

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required" },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAdmin();

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check workspace membership
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const templates = await RecordEmailService.getTemplates(workspaceId, {
      category: category || undefined,
      activeOnly,
    });

    return NextResponse.json({
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/emails/templates
 * Create a new email template
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAdmin();

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, name, subject, body_html, body_text, category, placeholders, is_default } = body;

    if (!workspace_id || !name || !subject || !body_html) {
      return NextResponse.json(
        { error: "workspace_id, name, subject, and body_html are required" },
        { status: 400 }
      );
    }

    // Check workspace membership with edit permission
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Extract placeholders if not provided
    const detectedPlaceholders = placeholders || RecordEmailService.extractPlaceholders(
      `${subject} ${body_html} ${body_text || ""}`
    );

    const template = await RecordEmailService.createTemplate(
      workspace_id,
      {
        name,
        subject,
        body_html,
        body_text,
        category: category || "general",
        placeholders: detectedPlaceholders,
        is_default: is_default || false,
      },
      user.id
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
