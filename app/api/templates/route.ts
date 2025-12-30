import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { TemplateService } from "@/lib/services/template-service";

// Create admin client for server-side operations
// IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must be set in environment variables
// to bypass RLS policies. If not set, this will fall back to ANON_KEY and RLS will be enforced.
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

  // Try to get user's auth token from Authorization header first
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

  // Try to get session from cookies
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Supabase stores access token in cookies with pattern: sb-<project-ref>-auth-token
    // Extract project ref from URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    // Try different cookie name patterns
    const cookieNames = projectRef 
      ? [
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ]
      : [];
    
    // Also check for any cookie starting with 'sb-'
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter(c => c.name.startsWith('sb-') && c.name.includes('auth'));
    
    let accessToken: string | null = null;
    
    // Try to find access token in cookies
    for (const cookieName of cookieNames) {
      const cookie = cookieStore.get(cookieName);
      if (cookie?.value) {
        try {
          const tokenData = JSON.parse(cookie.value);
          accessToken = tokenData?.access_token || tokenData?.accessToken || tokenData;
          if (accessToken) break;
        } catch {
          // Try as direct token
          accessToken = cookie.value;
          if (accessToken && accessToken.length > 50) break; // Likely a token
        }
      }
    }
    
    // If not found in named cookies, try auth cookies
    if (!accessToken && authCookies.length > 0) {
      for (const cookie of authCookies) {
        try {
          const tokenData = JSON.parse(cookie.value);
          accessToken = tokenData?.access_token || tokenData?.accessToken || tokenData;
          if (accessToken) break;
        } catch {
          if (cookie.value.length > 50) {
            accessToken = cookie.value;
            break;
          }
        }
      }
    }
    
    if (accessToken) {
      return createClient(
        supabaseUrl,
        supabaseAnonKey,
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
  } catch (cookieError) {
    console.warn("Failed to read cookies:", cookieError);
  }

  // Fallback to admin client (will use ANON_KEY if SERVICE_ROLE_KEY not set)
  // This will fail RLS checks if no user session
  console.warn("No auth token found in request/cookies and SERVICE_ROLE_KEY not set. RLS policies will be enforced.");
  return supabaseAdmin;
}

/**
 * GET /api/templates
 * List templates for a base/table
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseId = searchParams.get("baseId");
    const tableId = searchParams.get("tableId");

    if (!baseId) {
      return NextResponse.json({ error: "baseId is required" }, { status: 400 });
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    // List templates using authenticated client
    let query = supabase
      .from("document_templates")
      .select("*")
      .eq("base_id", baseId)
      .order("created_at", { ascending: false });

    if (tableId) {
      query = query.eq("table_id", tableId);
    } else {
      query = query.is("table_id", null);
    }

    const { data: templates, error } = await query;
    
    if (error) {
      console.error("Failed to list templates:", error);
      console.error("Query details:", {
        baseId,
        tableId,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
      });
      throw error;
    }

    console.log(`Found ${templates?.length || 0} templates for base ${baseId}`);

    // Fetch fields for each template
    const templatesWithFields = await Promise.all(
      (templates || []).map(async (template) => {
        const { data: fields } = await supabase
          .from("template_fields")
          .select("*")
          .eq("template_id", template.id)
          .order("order_index", { ascending: true });
        
        // Check if template has active signature fields
        // A field is active if: field_type is "signature", requires_esignature is true, and esignature_signer_email is not null/empty
        const hasActiveSignatureFields = (fields || []).some(
          (f) => 
            f.field_type === "signature" && 
            f.requires_esignature === true && 
            f.esignature_signer_email && 
            f.esignature_signer_email.trim() !== ""
        );
        
        return {
          ...template,
          fields: fields || [],
          hasActiveSignatureFields,
        };
      })
    );

    return NextResponse.json({ templates: templatesWithFields });
  } catch (error: any) {
    console.error("Failed to list templates:", error);
    return NextResponse.json({ error: error.message || "Failed to list templates" }, { status: 500 });
  }
}

/**
 * POST /api/templates
 * Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const baseId = formData.get("baseId") as string;
    const tableId = formData.get("tableId") as string | null;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const file = formData.get("file") as File | null;

    if (!baseId || !name || !file) {
      return NextResponse.json({ error: "baseId, name, and file are required" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported as templates" }, { status: 400 });
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);
    
    // Verify base exists and get owner
    const { data: base, error: baseError } = await supabase
      .from("bases")
      .select("id, owner")
      .eq("id", baseId)
      .single();

    if (baseError || !base) {
      return NextResponse.json({ error: "Base not found" }, { status: 404 });
    }

    // Upload template file to storage
    const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";
    const prefix = tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
    const templatesFolder = "templates/";
    
    // Sanitize filename
    const sanitizeFileName = (name: string) => {
      const fallback = "file";
      const base = (name || fallback)
        .replace(/[\s\u2013\u2014]+/g, "-")
        .replace(/[^\w.\-()+]/g, "")
        .replace(/-+/g, "-")
        .replace(/\.+/g, ".")
        .trim();
      return base.length > 0 ? base : fallback;
    };
    
    const safeName = sanitizeFileName(file.name);
    const timestamp = Date.now();
    const finalName = `${timestamp}-${safeName}`;
    const fullPath = `${prefix}${templatesFolder}${finalName}`;

    // Convert File to ArrayBuffer for Supabase storage
    const fileBuffer = await file.arrayBuffer();
    
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fullPath, fileBuffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      console.error("Upload details:", {
        bucket: BUCKET,
        path: fullPath,
        fileSize: file.size,
        fileName: file.name,
        fileType: file.type,
        errorMessage: uploadError.message,
        errorName: uploadError.name,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      return NextResponse.json({ 
        error: uploadError.message || "Failed to upload template file",
        details: uploadError.message,
      }, { status: 500 });
    }

    // Get current user for created_by field
    // Check if user has a profile record (required for foreign key)
    const { data: { user } } = await supabase.auth.getUser();
    let createdBy: string | null = null;
    
    if (user?.id) {
      // Check if profile exists for this user
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        createdBy = user.id;
      } else {
        // Profile doesn't exist, try base owner
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", base.owner)
          .single();
        
        if (ownerProfile) {
          createdBy = base.owner;
        }
        // If neither exists, createdBy will be null (allowed by foreign key)
      }
    }

    // Create template record
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .insert({
        base_id: baseId,
        table_id: tableId || null,
        name,
        description: description || null,
        template_file_path: `${templatesFolder}${finalName}`,
        created_by: createdBy, // Can be null if no profile exists
      })
      .select()
      .single();

    if (templateError) {
      console.error("Template creation error:", templateError);
      console.error("Template creation details:", {
        baseId,
        tableId,
        name,
        createdBy,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        errorCode: templateError.code,
        errorMessage: templateError.message,
        errorDetails: templateError.details,
      });
      // Try to clean up uploaded file
      await supabase.storage.from(BUCKET).remove([fullPath]).catch(() => {});
      return NextResponse.json({ 
        error: templateError.message || "Failed to create template",
        details: templateError.details,
        code: templateError.code
      }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
  }
}

/**
 * DELETE /api/templates
 * Delete a template
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateId = searchParams.get("templateId");
    const baseId = searchParams.get("baseId");
    const tableId = searchParams.get("tableId");

    console.log("DELETE template request:", { templateId, baseId, tableId });

    if (!templateId || !baseId) {
      return NextResponse.json({ error: "templateId and baseId are required" }, { status: 400 });
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);

    // Verify template exists and user has access
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .eq("base_id", baseId)
      .single();

    if (templateError) {
      console.error("Template fetch error:", {
        code: templateError.code,
        message: templateError.message,
        details: templateError.details,
        hint: templateError.hint,
      });
      return NextResponse.json({ 
        error: templateError.message || "Template not found",
        code: templateError.code,
        details: templateError.details
      }, { status: templateError.code === "PGRST116" ? 404 : 500 });
    }

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    console.log("Template found:", { id: template.id, filePath: template.template_file_path });

    // Delete file from storage
    const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";
    const prefix = tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
    const fullPath = `${prefix}${template.template_file_path}`;
    
    console.log("Deleting file from storage:", { bucket: BUCKET, path: fullPath });
    
    const { error: deleteError } = await supabase.storage.from(BUCKET).remove([fullPath]);
    if (deleteError) {
      console.warn("Failed to delete template file:", {
        message: deleteError.message,
        name: deleteError.name,
      });
      // Continue with database deletion even if file deletion fails
    } else {
      console.log("Template file deleted successfully");
    }

    // Delete template record (fields will be cascade deleted)
    console.log("Deleting template record from database");
    const { error: dbError } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", templateId);

    if (dbError) {
      console.error("Failed to delete template record:", {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
      });
      return NextResponse.json({ 
        error: dbError.message || "Failed to delete template",
        details: dbError.details,
        code: dbError.code
      }, { status: 500 });
    }

    console.log("Template deleted successfully");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to delete template",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}

