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
      pages, // Array of { documentPath: string, pageNumber: number } - 1-based page numbers
      outputFileName,
    }: {
      baseId: string;
      tableId?: string | null;
      pages: { documentPath: string; pageNumber: number }[];
      outputFileName: string;
    } = body;

    if (!baseId || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: baseId, pages" },
        { status: 400 }
      );
    }

    // Build storage prefix
    const prefix = tableId
      ? `bases/${baseId}/tables/${tableId}/`
      : `bases/${baseId}/`;

    // Group pages by document for efficient loading
    const documentMap = new Map<string, number[]>();
    for (const page of pages) {
      const fullPath = page.documentPath.startsWith(prefix)
        ? page.documentPath
        : `${prefix}${page.documentPath}`;
      
      if (!documentMap.has(fullPath)) {
        documentMap.set(fullPath, []);
      }
      documentMap.get(fullPath)!.push(page.pageNumber);
    }

    // Load all unique documents
    const loadedDocuments = new Map<string, typeof PDFDocument.prototype>();
    
    for (const [docPath] of documentMap) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(docPath);

      if (downloadError || !fileData) {
        console.error(`Failed to download PDF ${docPath}:`, downloadError);
        return NextResponse.json(
          { error: `Failed to download document: ${docPath}` },
          { status: 500 }
        );
      }

      const pdfBytes = await fileData.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      loadedDocuments.set(docPath, pdfDoc);
    }

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();

    // Copy pages in the specified order
    for (const page of pages) {
      const fullPath = page.documentPath.startsWith(prefix)
        ? page.documentPath
        : `${prefix}${page.documentPath}`;
      
      const sourcePdf = loadedDocuments.get(fullPath);
      if (!sourcePdf) {
        return NextResponse.json(
          { error: `Document not loaded: ${fullPath}` },
          { status: 500 }
        );
      }

      const totalPages = sourcePdf.getPageCount();
      if (page.pageNumber < 1 || page.pageNumber > totalPages) {
        return NextResponse.json(
          { error: `Invalid page number ${page.pageNumber} for document ${fullPath}. Document has ${totalPages} pages.` },
          { status: 400 }
        );
      }

      // Copy the specific page (convert 1-based to 0-based)
      const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.pageNumber - 1]);
      mergedPdf.addPage(copiedPage);
    }

    // Save merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Generate output file name
    const sanitizedFileName = outputFileName
      .replace(/[^\w.\-()+]/g, "-")
      .replace(/-+/g, "-")
      .replace(/\.+/g, ".");
    const finalFileName = sanitizedFileName.endsWith(".pdf")
      ? sanitizedFileName
      : `${sanitizedFileName}.pdf`;

    const outputPath = `${prefix}${Date.now()}-${finalFileName}`;

    // Upload merged PDF
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(outputPath, mergedPdfBytes, {
        contentType: "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Failed to upload merged PDF:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload merged document" },
        { status: 500 }
      );
    }

    // Return relative path
    const relativePath = outputPath.replace(prefix, "");

    return NextResponse.json({
      success: true,
      documentPath: relativePath,
      fullPath: outputPath,
      fileName: finalFileName,
      pageCount: mergedPdf.getPageCount(),
      message: `Successfully merged ${mergedPdf.getPageCount()} pages`,
    });
  } catch (error) {
    console.error("Error merging PDFs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge PDFs" },
      { status: 500 }
    );
  }
}
