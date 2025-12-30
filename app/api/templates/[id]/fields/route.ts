import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TemplateService, type TemplateField } from "@/lib/services/template-service";

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
  // If service role key is available, use admin client (bypasses RLS)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin;
  }

  // Otherwise, try to get user's auth token from Authorization header
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  
  if (accessToken) {
    // Create client with user's token
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

  // Fallback to admin client
  return supabaseAdmin;
}

/**
 * GET /api/templates/[id]/fields
 * Get all fields for a template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;
    
    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    const { data: fields, error } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_id", id)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ fields: fields || [] });
  } catch (error: any) {
    console.error("Failed to get template fields:", error);
    return NextResponse.json({ error: error.message || "Failed to get template fields" }, { status: 500 });
  }
}

/**
 * POST /api/templates/[id]/fields
 * Create or update a template field
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;
    
    const body = await request.json();
    const field: TemplateField = body.field;

    if (!field) {
      return NextResponse.json({ error: "field is required" }, { status: 400 });
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    const fieldData: any = {
      template_id: id,
      field_name: field.field_name,
      field_key: field.field_key,
      field_type: field.field_type,
      page_number: field.page_number,
      x_position: field.x_position,
      y_position: field.y_position,
      width: field.width || null,
      height: field.height || null,
      font_size: field.font_size || 12,
      font_name: field.font_name || "Helvetica",
      is_required: field.is_required || false,
      default_value: field.default_value || null,
      order_index: field.order_index || 0,
      updated_at: new Date().toISOString(),
    };

    // Always include validation_rules and formatting_options with defaults
    // This ensures compatibility even if migration hasn't been run (columns have defaults)
    fieldData.validation_rules = Array.isArray(field.validation_rules) ? field.validation_rules : (field.validation_rules || []);
    fieldData.formatting_options = (field.formatting_options && typeof field.formatting_options === 'object') ? field.formatting_options : (field.formatting_options || {});

    // E-signature configuration (only for signature fields)
    if (field.field_type === "signature") {
      fieldData.requires_esignature = field.requires_esignature || false;
      
      // Validate: if e-signature is required, signer email must be provided
      if (field.requires_esignature) {
        if (!field.esignature_signer_email || field.esignature_signer_email.trim() === "") {
          return NextResponse.json(
            { error: "Signer email is required when e-signature is enabled" },
            { status: 400 }
          );
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.esignature_signer_email.trim())) {
          return NextResponse.json(
            { error: "Please provide a valid email address" },
            { status: 400 }
          );
        }
        
        fieldData.esignature_signer_email = field.esignature_signer_email.trim();
        fieldData.esignature_signer_name = field.esignature_signer_name || null;
        fieldData.esignature_signer_role = field.esignature_signer_role || "signer";
        fieldData.esignature_sign_order = field.esignature_sign_order || 0;
      } else {
        // Clear e-signature fields if e-signature is disabled
        fieldData.esignature_signer_email = null;
        fieldData.esignature_signer_name = null;
        fieldData.esignature_signer_role = null;
        fieldData.esignature_sign_order = null;
      }
    } else {
      // Clear e-signature fields if not a signature field
      fieldData.requires_esignature = false;
      fieldData.esignature_signer_email = null;
      fieldData.esignature_signer_name = null;
      fieldData.esignature_signer_role = null;
      fieldData.esignature_sign_order = null;
    }

    let savedField;
    if (field.id) {
      // Update existing field
      const { data, error } = await supabase
        .from("template_fields")
        .update(fieldData)
        .eq("id", field.id)
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        throw new Error(error.message || "Failed to update field");
      }
      if (!data) {
        throw new Error("Field not found or update failed");
      }
      savedField = data;
    } else {
      // Create new field
      const { data, error } = await supabase
        .from("template_fields")
        .insert(fieldData)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Field data being inserted:", JSON.stringify(fieldData, null, 2));
        
        // Check for unique constraint violation
        if (error.code === "23505") {
          throw new Error(`Field with key "${field.field_key}" already exists for this template`);
        }
        // Check for column doesn't exist error (migration not run)
        if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("does not exist")) {
          throw new Error("Database schema is outdated. Please run the migration to add validation_rules and formatting_options columns.");
        }
        throw new Error(error.message || "Failed to create field");
      }
      if (!data) {
        throw new Error("Field creation failed - no data returned");
      }
      savedField = data;
    }

    return NextResponse.json({ field: savedField }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to save template field:", error);
    return NextResponse.json({ error: error.message || "Failed to save template field" }, { status: 500 });
  }
}

/**
 * DELETE /api/templates/[id]/fields
 * Delete a template field
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+ (though we don't use it here)
    await params;
    
    const searchParams = request.nextUrl.searchParams;
    const fieldId = searchParams.get("fieldId");

    if (!fieldId) {
      return NextResponse.json({ error: "fieldId is required" }, { status: 400 });
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    const { error } = await supabase
      .from("template_fields")
      .delete()
      .eq("id", fieldId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete template field:", error);
    return NextResponse.json({ error: error.message || "Failed to delete template field" }, { status: 500 });
  }
}

