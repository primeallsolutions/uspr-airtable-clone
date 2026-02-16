import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TemplateService } from "@/lib/services/template-service";
import { ChecklistTemplatesService } from "@/lib/services/checklist-templates-service";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

// Helper to get authenticated Supabase client
async function getSupabaseClient(request: NextRequest) {
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

  // Fallback to service role if available
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to copy a file in storage
async function copyFileInStorage(
  supabase: any,
  sourcePath: string,
  destPath: string
): Promise<void> {
  try {
    // Download the source file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(sourcePath);

    if (downloadError) {
      throw new Error(`Failed to download source file: ${downloadError.message}`);
    }

    // Upload to destination
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(destPath, fileData, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    if (uploadError) {
      throw new Error(`Failed to upload to destination: ${uploadError.message}`);
    }
  } catch (error: any) {
    console.error("Error copying file in storage:", error);
    throw error;
  }
}

// GET /api/templates/import?action=get-workspaces
// GET /api/templates/import?action=get-bases&workspaceId={workspaceId}
// GET /api/templates/import?action=get-templates&baseId={baseId}&type={documents|tasks}
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const supabase = await getSupabaseClient(request);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Action: Get all workspaces accessible to the user
    if (action === "get-workspaces") {
      // Get workspaces where user is a member
      const { data: workspaceMemberships, error: membershipError } = await supabase
        .from("workspace_memberships")
        .select("workspace_id, workspaces(id, name)")
        .eq("user_id", user.id);

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message },
          { status: 400 }
        );
      }

      // Get workspaces owned by the user
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("owner", user.id);

      if (ownedError) {
        return NextResponse.json(
          { error: ownedError.message },
          { status: 400 }
        );
      }

      // Combine and deduplicate workspaces
      const memberWorkspaces = (workspaceMemberships || [])
        .map((m: any) => m.workspaces)
        .filter(Boolean);
      
      const ownedWorkspacesList = ownedWorkspaces || [];
      
      // Create a map to deduplicate by id
      const workspaceMap = new Map();
      memberWorkspaces.forEach((ws: any) => {
        if (ws && ws.id) {
          workspaceMap.set(ws.id, ws);
        }
      });
      ownedWorkspacesList.forEach((ws: any) => {
        if (ws && ws.id) {
          workspaceMap.set(ws.id, ws);
        }
      });

      const workspaces = Array.from(workspaceMap.values())
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));

      return NextResponse.json({ workspaces });
    }

    // Action: Get all bases in a workspace
    if (action === "get-bases") {
      const workspaceId = searchParams.get("workspaceId");
      if (!workspaceId) {
        return NextResponse.json(
          { error: "workspaceId is required" },
          { status: 400 }
        );
      }

      // Only get bases the user has access to
      const { data: bases, error: basesError } = await supabase
        .from("bases")
        .select("id, name, workspace_id")
        .eq("workspace_id", workspaceId);

      if (basesError) {
        return NextResponse.json(
          { error: basesError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        bases: (bases || []).sort((a: any, b: any) =>
          (a.name || "").localeCompare(b.name || "")
        ),
      });
    }

    // Action: Get templates/checklists from a base
    if (action === "get-templates") {
      const baseId = searchParams.get("baseId");
      const type = searchParams.get("type"); // "documents" or "tasks"

      if (!baseId || !type) {
        return NextResponse.json(
          { error: "baseId and type are required" },
          { status: 400 }
        );
      }

      if (type === "documents") {
        const templates = await TemplateService.listTemplates(baseId);
        const templateWithFields = await Promise.all(
          templates.map(async (template) => {
            const templateFields = await TemplateService.getTemplate(template.id);
            return { ...template, fields: templateFields?.fields || [] };
          })
        );
        return NextResponse.json({ templates: templateWithFields });
      } else if (type === "tasks") {
        const checklists = await ChecklistTemplatesService.listTemplates(baseId);
        return NextResponse.json({ templates: checklists });
      } else {
        return NextResponse.json(
          { error: "Invalid type. Must be 'documents' or 'tasks'" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action parameter" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Import templates API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/templates/import - Copy a template or checklist to another base
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient(request);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      sourceTemplateId,
      targetBaseId,
      type, // "documents" or "tasks"
    } = body;

    if (!sourceTemplateId || !targetBaseId || !type) {
      return NextResponse.json(
        { error: "sourceTemplateId, targetBaseId, and type are required" },
        { status: 400 }
      );
    }

    if (type === "documents") {
      // Copy document template
      const sourceTemplate = await TemplateService.getTemplate(sourceTemplateId);
      if (!sourceTemplate) {
        return NextResponse.json(
          { error: "Source template not found" },
          { status: 404 }
        );
      }

      // Copy the PDF file from source base to target base
      let newTemplateFilePath = sourceTemplate.template_file_path;
      try {
        const sourcePath = `bases/${sourceTemplate.base_id}/${sourceTemplate.template_file_path}`;
        const destPath = `bases/${targetBaseId}/${sourceTemplate.template_file_path}`;
        await copyFileInStorage(supabase, sourcePath, destPath);
      } catch (fileError: any) {
        console.error("Failed to copy template file:", fileError);
        // Return error if file copy fails
        return NextResponse.json(
          { error: `Failed to copy template file: ${fileError.message}` },
          { status: 400 }
        );
      }

      // Insert new template in target base
      const { data: newTemplate, error: insertError } = await supabase
        .from("document_templates")
        .insert({
          base_id: targetBaseId,
          name: sourceTemplate.name,
          description: sourceTemplate.description,
          template_file_path: newTemplateFilePath,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 }
        );
      }

      // Copy fields if they exist
      if (sourceTemplate.fields && sourceTemplate.fields.length > 0) {
        const fieldsToInsert = sourceTemplate.fields.map((field) => ({
          template_id: newTemplate.id,
          field_name: field.field_name,
          field_key: field.field_key,
          field_type: field.field_type,
          page_number: field.page_number,
          x_position: field.x_position,
          y_position: field.y_position,
          width: field.width,
          height: field.height,
          font_size: field.font_size,
          font_name: field.font_name,
          is_required: field.is_required,
          default_value: field.default_value,
          order_index: field.order_index,
          validation_rules: field.validation_rules,
          formatting_options: field.formatting_options,
          requires_esignature: field.requires_esignature,
          esignature_signer_email: field.esignature_signer_email,
          esignature_signer_name: field.esignature_signer_name,
          esignature_signer_role: field.esignature_signer_role,
          esignature_sign_order: field.esignature_sign_order,
        }));

        const { error: fieldsError } = await supabase
          .from("template_fields")
          .insert(fieldsToInsert);

        if (fieldsError) {
          console.error("Error copying fields:", fieldsError);
          // Don't fail the entire operation, but log the error
        }
      }

      return NextResponse.json({ template: newTemplate });
    } else if (type === "tasks") {
      // Copy checklist template
      const sourceChecklist = await ChecklistTemplatesService.getTemplate(sourceTemplateId);
      if (!sourceChecklist) {
        return NextResponse.json(
          { error: "Source checklist not found" },
          { status: 404 }
        );
      }

      // Insert new checklist in target base
      const { data: newChecklist, error: insertError } = await supabase
        .from("checklist_templates")
        .insert({
          base_id: targetBaseId,
          name: sourceChecklist.name,
          description: sourceChecklist.description,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 }
        );
      }

      // Copy items if they exist
      if (sourceChecklist.items && sourceChecklist.items.length > 0) {
        const itemsToInsert = sourceChecklist.items.map((item) => ({
          checklist_template_id: newChecklist.id,
          title: item.title,
          description: item.description,
          order_index: item.order_index,
          is_required: item.is_required,
        }));

        const { error: itemsError } = await supabase
          .from("checklist_items")
          .insert(itemsToInsert);

        if (itemsError) {
          console.error("Error copying items:", itemsError);
          // Don't fail the entire operation, but log the error
        }
      }

      return NextResponse.json({ template: newChecklist });
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be 'documents' or 'tasks'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Import templates API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
