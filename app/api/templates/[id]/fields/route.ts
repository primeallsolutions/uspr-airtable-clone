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
    
    const fieldData = {
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

    let savedField;
    if (field.id) {
      // Update existing field
      const { data, error } = await supabase
        .from("template_fields")
        .update(fieldData)
        .eq("id", field.id)
        .select()
        .single();

      if (error) throw error;
      savedField = data;
    } else {
      // Create new field
      const { data, error } = await supabase
        .from("template_fields")
        .insert(fieldData)
        .select()
        .single();

      if (error) throw error;
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

