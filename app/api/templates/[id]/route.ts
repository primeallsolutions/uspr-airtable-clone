import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TemplateService } from "@/lib/services/template-service";

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

  // Fallback to admin client (will use ANON_KEY if SERVICE_ROLE_KEY not set)
  console.warn("No auth token found in request and SERVICE_ROLE_KEY not set. RLS policies will be enforced.");
  return supabaseAdmin;
}

/**
 * GET /api/templates/[id]
 * Get a single template with its fields
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
    
    // Get template
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (templateError) {
      console.error("Failed to get template:", templateError);
      return NextResponse.json({ error: templateError.message || "Template not found" }, { status: 404 });
    }

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Fetch fields
    const { data: fields, error: fieldsError } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_id", id)
      .order("order_index", { ascending: true });

    if (fieldsError) {
      console.error("Failed to get template fields:", fieldsError);
      // Don't fail the request if fields can't be loaded, just return empty array
    }

    // Check if template has active signature fields
    const hasActiveSignatureFields = (fields || []).some(
      (f) => f.field_type === "signature" && f.requires_esignature && f.esignature_signer_email
    );

    return NextResponse.json({
      template: {
        ...template,
        fields: fields || [],
        hasActiveSignatureFields,
      },
    });
  } catch (error: any) {
    console.error("Failed to get template:", error);
    return NextResponse.json({ error: error.message || "Failed to get template" }, { status: 500 });
  }
}

/**
 * PATCH /api/templates/[id]
 * Update template metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;
    
    const body = await request.json();
    const { name, description } = body;

    const updates: { name?: string; description?: string } = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    const { data: template, error } = await supabase
      .from("document_templates")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ template });
  } catch (error: any) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 });
  }
}

