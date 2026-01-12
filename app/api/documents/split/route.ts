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
    }: {
      baseId: string;
      tableId?: string | null;
      documentPath: string;
      pageRanges: { start: number; end: number }[]; // 1-based page numbers
      outputFileName: string;
    } = body;

    if (!baseId || !documentPath || !pageRanges || pageRanges.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: baseId, documentPath, pageRanges" },
        { status: 400 }
      );
    }

    // Build the full storage path
    const prefix = tableId
      ? `bases/${baseId}/tables/${tableId}/`
      : `bases/${baseId}/`;
    const fullPath = `${prefix}${documentPath}`;

    // Download the source PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(fullPath);

    if (downloadError || !fileData) {
      console.error("Failed to download source PDF:", downloadError);
      return NextResponse.json(
        { error: "Failed to download source document" },
        { status: 500 }
      );
    }

    // Load the PDF
    const pdfBytes = await fileData.arrayBuffer();
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

    // Get folder path from original document
    const folderPath = documentPath.includes("/")
      ? documentPath.substring(0, documentPath.lastIndexOf("/") + 1)
      : "";

    const outputPath = `${prefix}${folderPath}${Date.now()}-${finalFileName}`;

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

    // Return the new document path (relative to prefix)
    const relativePath = `${folderPath}${Date.now()}-${finalFileName}`;

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
