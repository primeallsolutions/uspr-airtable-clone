import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

const basePrefix = (baseId: string, tableId?: string | null) =>
  tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;

/**
 * POST /api/templates/generate
 * Generate a filled PDF document from a template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, baseId, tableId, fieldValues, outputFileName } = body;

    if (!templateId || !baseId || !fieldValues) {
      return NextResponse.json(
        { error: "templateId, baseId, and fieldValues are required" },
        { status: 400 }
      );
    }

    // Get authenticated Supabase client
    const supabase = await getSupabaseClient(request);

    // Get template with fields
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Fetch fields
    const { data: fields } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index", { ascending: true });

    const fullTemplate = {
      ...template,
      fields: fields || [],
    };

    // Get signed URL for template file
    const prefix = basePrefix(baseId, tableId || null);
    const cleanPath = fullTemplate.template_file_path.startsWith("/") 
      ? fullTemplate.template_file_path.slice(1) 
      : fullTemplate.template_file_path;
    const fullPath = `${prefix}${cleanPath}`;
    const finalPath = fullPath.replace(/\/+$/, "") || fullPath;

    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(finalPath, 600);

    if (urlError || !urlData) {
      throw new Error("Failed to get template file URL");
    }

    const templateUrl = urlData.signedUrl;

    // Fetch template PDF
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      throw new Error("Failed to fetch template file");
    }
    const templateBytes = await templateResponse.arrayBuffer();

    // Load PDF document
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Fill fields
    if (fullTemplate.fields && fullTemplate.fields.length > 0) {
      for (const field of fullTemplate.fields) {
        const value = fieldValues[field.field_key];
        if (value === undefined || value === null || value === "") {
          // Use default value if provided
          if (field.default_value) {
            fieldValues[field.field_key] = field.default_value;
          } else if (field.is_required) {
            // Skip required fields without values (or throw error)
            continue;
          } else {
            continue;
          }
        }

        const fieldValue = String(fieldValues[field.field_key] || field.default_value || "");
        if (!fieldValue) continue;

        // Get the page (0-indexed)
        const pageIndex = Math.max(0, Math.min(field.page_number - 1, pages.length - 1));
        const page = pages[pageIndex];

        // Get field properties
        const x = field.x_position;
        const y = field.y_position;
        const width = field.width || 200;
        const height = field.height || 20;
        const fontSize = field.font_size || 12;
        const fontName = field.font_name || "Helvetica";

        // Select font
        const font = fontName.includes("Bold") || fontName.includes("bold") ? helveticaBoldFont : helveticaFont;

        // Handle different field types
        switch (field.field_type) {
          case "text":
          case "number":
          case "date":
            // Draw text field
            // Note: PDF coordinates start from bottom-left, so we need to adjust Y
            const pageHeight = page.getHeight();
            const adjustedY = pageHeight - y - height;

            // Wrap text if needed
            const maxWidth = width - 4; // Leave padding
            let textToDraw = fieldValue;

            // Simple text wrapping (basic implementation)
            if (font.widthOfTextAtSize(textToDraw, fontSize) > maxWidth) {
              const words = textToDraw.split(" ");
              const lines: string[] = [];
              let currentLine = "";

              for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
                  currentLine = testLine;
                } else {
                  if (currentLine) lines.push(currentLine);
                  currentLine = word;
                }
              }
              if (currentLine) lines.push(currentLine);

              // Draw multiple lines
              let lineY = adjustedY;
              for (const line of lines) {
                if (lineY < 0) break; // Don't draw outside page
                page.drawText(line, {
                  x: x + 2,
                  y: lineY,
                  size: fontSize,
                  font: font,
                  color: rgb(0, 0, 0),
                });
                lineY -= fontSize + 2; // Line spacing
              }
            } else {
              page.drawText(textToDraw, {
                x: x + 2,
                y: adjustedY,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
              });
            }
            break;

          case "checkbox":
            // Draw checkbox (X mark)
            if (fieldValue.toLowerCase() === "true" || fieldValue === "1" || fieldValue.toLowerCase() === "yes") {
              const checkboxSize = Math.min(width, height) * 0.6;
              const checkboxX = x + width / 2;
              const checkboxY = pageHeight - y - height / 2;

              // Draw X mark
              page.drawText("✓", {
                x: checkboxX - checkboxSize / 4,
                y: checkboxY - checkboxSize / 4,
                size: checkboxSize,
                font: helveticaBoldFont,
                color: rgb(0, 0, 0),
              });
            }
            break;

          case "signature":
            // For signatures, we'd typically embed an image
            // For now, just draw text placeholder
            const sigY = pageHeight - y - height;
            page.drawText(fieldValue || "[Signature]", {
              x: x + 2,
              y: sigY,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0.5, 0.5, 0.5), // Gray color for placeholder
            });
            break;
        }
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Return PDF as base64 or binary
    // For API route, we'll return base64 encoded
    const base64 = Buffer.from(pdfBytes).toString("base64");

    return NextResponse.json({
      success: true,
      pdf: base64,
      fileName: outputFileName || `${fullTemplate.name}_filled.pdf`,
    });
  } catch (error: any) {
    console.error("Failed to generate document:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}

