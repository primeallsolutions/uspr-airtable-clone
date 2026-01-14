import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create Supabase client with user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      baseId,
      tableId,
      documentPath,
      pageRanges,
      outputFileName,
      recordId, // Add recordId support
      folderPath, // Add folder path support
    }: {
      baseId: string;
      tableId?: string | null;
      documentPath: string;
      pageRanges: { start: number; end: number }[]; // 1-based page numbers
      outputFileName: string;
      recordId?: string | null; // Optional recordId for record-scoped documents
      folderPath?: string; // Optional folder path for output
    } = body;

    if (!baseId || !documentPath || !pageRanges || pageRanges.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: baseId, documentPath, pageRanges" },
        { status: 400 }
      );
    }

    // Build the full storage path
    // Use record-scoped prefix if recordId is provided
    const prefix = recordId
      ? `bases/${baseId}/records/${recordId}/`
      : tableId
      ? `bases/${baseId}/tables/${tableId}/`
      : `bases/${baseId}/`;
    
    // Ensure documentPath doesn't already include the prefix
    const cleanDocPath = documentPath.startsWith(prefix) 
      ? documentPath.substring(prefix.length)
      : documentPath;
    
    const fullPath = `${prefix}${cleanDocPath}`;

    console.log("[PDF Split] Attempting to download:", {
      baseId,
      tableId,
      documentPath,
      cleanDocPath,
      fullPath,
      prefix
    });

    // Download the source PDF using signed URL method (handles special characters better)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(fullPath, 600);

    if (urlError || !urlData) {
      console.error("[PDF Split] Failed to create signed URL:", {
        error: urlError,
        fullPath,
        errorMessage: urlError?.message,
      });
      return NextResponse.json(
        { 
          error: "Failed to get document URL",
          details: urlError?.message || "Unknown error",
          path: fullPath
        },
        { status: 500 }
      );
    }

    // Fetch the PDF using the signed URL
    const pdfResponse = await fetch(urlData.signedUrl);
    if (!pdfResponse.ok) {
      console.error("[PDF Split] Failed to fetch PDF from signed URL:", {
        status: pdfResponse.status,
        statusText: pdfResponse.statusText,
        url: urlData.signedUrl,
      });
      return NextResponse.json(
        { 
          error: "Failed to download source document",
          details: `HTTP ${pdfResponse.status}: ${pdfResponse.statusText}`,
          path: fullPath
        },
        { status: 500 }
      );
    }

    const fileData = await pdfResponse.arrayBuffer();

    // Load the PDF
    const pdfBytes = fileData;
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const totalPages = sourcePdf.getPageCount();

    // Validate page ranges
    for (const range of pageRanges) {
      if (range.start < 1 || range.end > totalPages || range.start > range.end) {
        return NextResponse.json(
          {
            error: `Invalid page range: ${range.start}-${range.end}. Document has ${totalPages} pages.`,
          },
          { status: 400 }
        );
      }
    }

    // Create a new PDF with the selected pages
    const newPdf = await PDFDocument.create();

    // Copy pages from source to new PDF
    for (const range of pageRanges) {
      // Convert 1-based to 0-based indices
      const indices = [];
      for (let i = range.start - 1; i < range.end; i++) {
        indices.push(i);
      }
      const copiedPages = await newPdf.copyPages(sourcePdf, indices);
      copiedPages.forEach((page) => newPdf.addPage(page));
    }

    // Save the new PDF
    const newPdfBytes = await newPdf.save();

    // Generate output file name
    const sanitizedFileName = outputFileName
      .replace(/[^\w.\-()+]/g, "-")
      .replace(/-+/g, "-")
      .replace(/\.+/g, ".");
    const finalFileName = sanitizedFileName.endsWith(".pdf")
      ? sanitizedFileName
      : `${sanitizedFileName}.pdf`;

    // Build output path with folder
    const safeFolder = folderPath ? (folderPath.endsWith("/") ? folderPath : `${folderPath}/`) : "";
    const outputPath = `${prefix}${safeFolder}${Date.now()}-${finalFileName}`;

    // Calculate the relative path for database storage
    const relativePath = safeFolder
      ? `${safeFolder}${Date.now()}-${finalFileName}`
      : `${Date.now()}-${finalFileName}`;

    // Upload the new PDF
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(outputPath, newPdfBytes, {
        contentType: "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Failed to upload split PDF:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload split document" },
        { status: 500 }
      );
    }

    // Register the document in the database
    if (recordId) {
      // Get current user profile to satisfy foreign key constraint
      let uploadedBy: string | null = null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();
      
      if (profile?.id) {
        uploadedBy = profile.id;
      }

      // For record-scoped documents, insert into record_documents
      const { error: recordDocError } = await supabase
        .from('record_documents')
        .insert([{
          record_id: recordId,
          base_id: baseId,
          table_id: tableId,
          document_path: relativePath,
          document_name: finalFileName,
          size_bytes: newPdfBytes.length,
          mime_type: 'application/pdf',
          uploaded_by: uploadedBy,
        }]);

      if (recordDocError) {
        console.error("Failed to register record document:", recordDocError);
        // Don't fail the operation, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      documentPath: relativePath,
      fileName: finalFileName,
      pageCount: newPdf.getPageCount(),
      message: `Successfully extracted ${newPdf.getPageCount()} pages`,
    });
  } catch (error) {
    console.error("Error splitting PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to split PDF" },
      { status: 500 }
    );
  }
}
