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

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

/**
 * GET /api/emails/templates/[templateId]
 * Get a single template by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { templateId } = await params;

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

    const template = await RecordEmailService.getTemplate(templateId);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check user has access to workspace
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", template.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/emails/templates/[templateId]
 * Update a template
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { templateId } = await params;

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

    // Get existing template to check permissions
    const existingTemplate = await RecordEmailService.getTemplate(templateId);
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check user has edit access to workspace
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", existingTemplate.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { name, subject, body_html, body_text, category, placeholders, is_default, is_active } = body;

    // Re-extract placeholders if content changed
    let updatedPlaceholders = placeholders;
    if ((subject || body_html || body_text) && !placeholders) {
      updatedPlaceholders = RecordEmailService.extractPlaceholders(
        `${subject || existingTemplate.subject} ${body_html || existingTemplate.body_html} ${body_text || existingTemplate.body_text || ""}`
      );
    }

    const template = await RecordEmailService.updateTemplate(templateId, {
      name,
      subject,
      body_html,
      body_text,
      category,
      placeholders: updatedPlaceholders,
      is_default,
      is_active,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/templates/[templateId]
 * Delete a template
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { templateId } = await params;

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

    // Get existing template to check permissions
    const existingTemplate = await RecordEmailService.getTemplate(templateId);
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check user has edit access to workspace
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", existingTemplate.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await RecordEmailService.deleteTemplate(templateId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
