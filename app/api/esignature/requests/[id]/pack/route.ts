import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ESignatureService } from "@/lib/services/esign-service";

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
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin;
  }

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

  return supabaseAdmin;
}

/**
 * GET /api/esignature/requests/[id]/pack
 * Get pack items for a signature request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient(request);
    const { id } = await params;

    const packItems = await ESignatureService.getPackItems(id);

    return NextResponse.json({ packItems });
  } catch (error: any) {
    console.error("Failed to get pack items:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get pack items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/esignature/requests/[id]/pack/merge
 * Merge multiple documents into a single PDF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient(request);
    const { id } = await params;
    const body = await request.json();
    const { document_paths, output_filename } = body;

    if (!document_paths || !Array.isArray(document_paths) || document_paths.length === 0) {
      return NextResponse.json(
        { error: "document_paths array is required" },
        { status: 400 }
      );
    }

    const { PDFDocument } = await import("pdf-lib");
    const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Merge all documents
    for (const docPath of document_paths) {
      // Get signed URL for document
      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(docPath, 600);

      if (urlError || !urlData) {
        console.warn(`Failed to get signed URL for ${docPath}:`, urlError);
        continue;
      }

      // Fetch PDF
      const pdfResponse = await fetch(urlData.signedUrl);
      if (!pdfResponse.ok) {
        console.warn(`Failed to fetch PDF ${docPath}`);
        continue;
      }

      const pdfBytes = await pdfResponse.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Copy pages from this PDF to merged PDF
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    // Save merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Upload merged PDF to storage
    const signatureRequest = await ESignatureService.getSignatureRequest(id);
    if (!signatureRequest) {
      return NextResponse.json(
        { error: "Signature request not found" },
        { status: 404 }
      );
    }

    const basePrefix = signatureRequest.table_id
      ? `bases/${signatureRequest.base_id}/tables/${signatureRequest.table_id}/`
      : `bases/${signatureRequest.base_id}/`;
    
    const mergedFileName = output_filename || `merged_${Date.now()}.pdf`;
    const mergedPath = `${basePrefix}${mergedFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(mergedPath, mergedPdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload merged PDF: ${uploadError.message}`);
    }

    // Update request document path to merged document
    const { error: updateError } = await supabaseAdmin
      .from("signature_requests")
      .update({ document_path: mergedPath, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      merged_document_path: mergedPath,
    });
  } catch (error: any) {
    console.error("Failed to merge documents:", error);
    return NextResponse.json(
      { error: error.message || "Failed to merge documents" },
      { status: 500 }
    );
  }
}








