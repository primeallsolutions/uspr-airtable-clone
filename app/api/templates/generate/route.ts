import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatFieldValue } from "@/lib/utils/field-formatters";
import { TemplateField } from "@/lib/services/template-service";

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
    const { templateId, baseId, tableId, recordId, fieldValues, fieldOverrides, addedElements, outputFileName, skipSignatureRequest } = body;

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

    // Collect signature fields that require e-signature
    const esignatureFields: typeof fullTemplate.fields = [];
    
    console.log("Template fields loaded:", {
      totalFields: fullTemplate.fields?.length || 0,
      signatureFields: fullTemplate.fields?.filter((f: TemplateField) => f.field_type === "signature").length || 0,
      esignatureFieldsCount: fullTemplate.fields?.filter((f: TemplateField) => f.field_type === "signature" && f.requires_esignature).length || 0
    });
    
    // Fill fields (skip signature fields that require e-signature - they'll be signed later)
    if (fullTemplate.fields && fullTemplate.fields.length > 0) {
      for (const field of fullTemplate.fields) {
        // If this is a signature field that requires e-signature, skip filling it
        if (field.field_type === "signature" && field.requires_esignature) {
          console.log("Found e-signature field:", {
            fieldName: field.field_name,
            signerEmail: field.esignature_signer_email,
            signerName: field.esignature_signer_name,
            page: field.page_number,
            x: field.x_position,
            y: field.y_position
          });
          esignatureFields.push(field);
          continue; // Leave signature field blank for now - will be filled after signing
        }

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

        let fieldValue = fieldValues[field.field_key] || field.default_value || "";
        if (!fieldValue) continue;

        // Apply formatting if configured
        if (field.formatting_options) {
          fieldValue = formatFieldValue(fieldValue, field.formatting_options);
        } else {
          fieldValue = String(fieldValue);
        }

        // Get the page (0-indexed)
        const pageIndex = Math.max(0, Math.min(field.page_number - 1, pages.length - 1));
        const page = pages[pageIndex];

        // Get field properties - use override if available, otherwise use original
        const fieldKey = field.id || field.field_key;
        const override = fieldOverrides?.[fieldKey];
        const x = Number(override?.x_position ?? field.x_position) || 0;
        const y = Number(override?.y_position ?? field.y_position) || 0;
        const width = Number(override?.width ?? field.width) || 200;
        const height = Number(override?.height ?? field.height) || 20;
        const fontSize = Number(field.font_size) || 12;
        const fontName = field.font_name || "Helvetica";

        // Select font
        const font = fontName.includes("Bold") || fontName.includes("bold") ? helveticaBoldFont : helveticaFont;

        // Note: PDF coordinates start from bottom-left
        // y_position is stored as PDF coordinate from bottom (bottom of field)
        // To draw text at the bottom of the field, we use y_position directly
        // To draw text at the top of the field, we use y_position + height
        const pageHeight = page.getHeight();

        // Handle different field types
        switch (field.field_type) {
          case "text":
          case "number":
          case "date":
            // Draw text field - y_position is bottom coordinate, so use y + fontSize for text baseline
            const adjustedY = y + fontSize; // Position text slightly above bottom of field

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
              const checkboxY = y + height / 2; // y is bottom coordinate, center is y + height/2

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
            // Only fill signature if it doesn't require e-signature
            // (E-signature fields are already skipped above)
            if (fieldValue && fieldValue.startsWith("data:image")) {
              try {
                // Extract base64 data from data URL
                const base64Data = fieldValue.split(",")[1];
                const imageBytes = Buffer.from(base64Data, "base64");
                
                // Embed PNG image
                const signatureImage = await pdfDoc.embedPng(imageBytes);
                
                // Calculate dimensions to fit within field bounds
                const sigWidth = Math.min(width - 4, signatureImage.width);
                const sigHeight = (signatureImage.height / signatureImage.width) * sigWidth;
                const adjustedSigHeight = Math.min(sigHeight, height - 4);
                const adjustedSigWidth = (signatureImage.width / signatureImage.height) * adjustedSigHeight;
                
                // Position signature - y is bottom coordinate, so center vertically
                const sigY = y + (height - adjustedSigHeight) / 2;
                
                // Draw signature image
                page.drawImage(signatureImage, {
                  x: x + 2,
                  y: sigY,
                  width: adjustedSigWidth,
                  height: adjustedSigHeight,
                });
              } catch (err) {
                console.error("Failed to embed signature image:", err);
                // Fallback to text placeholder
                const sigY = y + fontSize; // y is bottom, position text slightly above
                page.drawText("[Signature Error]", {
                  x: x + 2,
                  y: sigY,
                  size: fontSize,
                  font: helveticaFont,
                  color: rgb(1, 0, 0), // Red color for error
                });
              }
            } else {
              // Leave blank for e-signature fields, or show placeholder for regular signature fields
              const sigY = y + fontSize; // y is bottom, position text slightly above
              page.drawText(fieldValue || "[Signature Required]", {
                x: x + 2,
                y: sigY,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0.5, 0.5, 0.5), // Gray color for placeholder
              });
            }
            break;
        }
      }
    }

    // Add custom elements (text/images) if provided
    if (addedElements && Array.isArray(addedElements) && addedElements.length > 0) {
      for (const element of addedElements) {
        const pageIndex = Math.max(0, Math.min(element.page - 1, pages.length - 1));
        const page = pages[pageIndex];
        if (!page) continue;

        const pageHeight = page.getHeight();

        if (element.type === "text" && element.content) {
          const font = helveticaFont;
          page.drawText(element.content, {
            x: element.x,
            y: pageHeight - element.y, // PDF Y is from bottom
            size: element.fontSize || 12,
            font: font,
            color: rgb(0, 0, 0),
          });
        } else if (element.type === "image" && element.imageData) {
          try {
            // Extract base64 data
            const base64Data = element.imageData.includes(",") 
              ? element.imageData.split(",")[1] 
              : element.imageData;
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Try PNG first, then JPEG
            let image;
            try {
              image = await pdfDoc.embedPng(imageBytes);
            } catch {
              image = await pdfDoc.embedJpg(imageBytes);
            }
            
            page.drawImage(image, {
              x: element.x,
              y: pageHeight - element.y - (element.height || 200),
              width: element.width || 200,
              height: element.height || 200,
            });
          } catch (imgErr) {
            console.error("Failed to embed image:", imgErr);
          }
        }
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Upload generated document to storage first
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

    const finalFileName = outputFileName || `${sanitizeFileName(fullTemplate.name)}_filled.pdf`;
    const folderPath = body.folderPath || ""; // Optional folder path from request
    const storagePrefix = basePrefix(baseId, tableId || null);
    const storagePath = folderPath 
      ? `${storagePrefix}${folderPath}${folderPath.endsWith("/") ? "" : "/"}${finalFileName}`
      : `${storagePrefix}${finalFileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload generated document:", uploadError);
      // Still return the PDF even if upload fails
    }

    // Validate and filter e-signature fields: only include those with valid email addresses
    const validESignatureFields = esignatureFields.filter(
      (f: TemplateField) => f.requires_esignature && f.esignature_signer_email && f.esignature_signer_email.trim() !== ""
    );

    // If there are valid e-signature fields, automatically create signature request (unless skipped)
    let signatureRequestId: string | null = null;
    console.log("Checking e-signature fields:", {
      totalESignatureFields: esignatureFields.length,
      validESignatureFieldsCount: validESignatureFields.length,
      skipSignatureRequest,
      fields: validESignatureFields.map((f: TemplateField) => ({
        name: f.field_name,
        email: f.esignature_signer_email,
        requires: f.requires_esignature
      }))
    });
    
    if (validESignatureFields.length > 0 && !skipSignatureRequest) {
      try {
        const { ESignatureService } = await import("@/lib/services/esign-service");
        
        // Get current user for created_by
        const { data: { user } } = await supabase.auth.getUser();
        
        // Check if user profile exists in profiles table
        let createdBy: string | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .single();
          createdBy = profile?.id || null;
        }
        
        // Collect unique signers from signature fields
        const signerMap = new Map<string, {
          email: string;
          name?: string;
          role: "signer" | "viewer" | "approver";
          sign_order: number;
          fields: typeof fullTemplate.fields;
        }>();

        // Use only valid e-signature fields (already filtered above)
        validESignatureFields.forEach((field: TemplateField) => {
          if (!field.requires_esignature || !field.esignature_signer_email) return;
          
          const email = field.esignature_signer_email.trim();
          if (!signerMap.has(email)) {
            signerMap.set(email, {
              email,
              name: field.esignature_signer_name || undefined,
              role: (field.esignature_signer_role as "signer" | "viewer" | "approver") || "signer",
              sign_order: field.esignature_sign_order || 0,
              fields: [],
            });
          }
          signerMap.get(email)!.fields.push(field);
        });

        const signers = Array.from(signerMap.values()).map(({ fields, ...signer }) => ({
          email: signer.email,
          name: signer.name,
          role: signer.role,
          sign_order: signer.sign_order,
        }));

        if (signers.length > 0) {
          // Create signature request (using existing authenticated supabase client)
          const signatureRequest = await ESignatureService.createSignatureRequest({
            base_id: baseId,
            table_id: tableId || null,
            title: `Signature Request: ${fullTemplate.name}`,
            message: `Please sign the following document: ${fullTemplate.name}`,
            document_path: storagePath,
            created_by: createdBy || undefined,
          }, supabase);

          signatureRequestId = signatureRequest.id!;

          // Add signers
          const createdSigners = await ESignatureService.addSigners(signatureRequest.id!, signers, supabase);

          // Create signature fields for each signer's fields
          for (const signer of createdSigners) {
            const signerFields = signerMap.get(signer.email)?.fields || [];
            console.log(`Creating fields for signer ${signer.email}:`, {
              signerId: signer.id,
              fieldsCount: signerFields.length,
              fields: signerFields.map((f: TemplateField) => ({
                page: f.page_number,
                x: f.x_position,
                y: f.y_position,
                width: f.width,
                height: f.height,
                name: f.field_name
              }))
            });
            
            if (signerFields.length > 0) {
              const fieldsToAdd = signerFields.map((templateField: TemplateField) => ({
                signer_id: signer.id!,
                page_number: templateField.page_number,
                x_position: Number(templateField.x_position),
                y_position: Number(templateField.y_position),
                width: templateField.width ? Number(templateField.width) : undefined,
                height: templateField.height ? Number(templateField.height) : undefined,
                field_type: "signature" as const,
                label: templateField.field_name,
                is_required: templateField.is_required !== false,
              }));
              
              const createdFields = await ESignatureService.addSignatureFields(signatureRequest.id!, fieldsToAdd, supabase);
              console.log(`Created ${createdFields.length} signature fields for signer ${signer.email}`);
            }
          }

          // Send emails to all signers
          const signatureRequestWithSigners = await ESignatureService.getSignatureRequest(signatureRequest.id!, supabase);
          if (signatureRequestWithSigners) {
            for (const signer of createdSigners) {
              try {
                await ESignatureService.sendSignatureRequestEmail(
                  { ...signer, signature_request_id: signatureRequest.id! },
                  signatureRequestWithSigners
                );
                await ESignatureService.updateSignerStatus(signer.id!, "sent");
              } catch (emailError) {
                console.error(`Failed to send email to ${signer.email}:`, emailError);
              }
            }
            await ESignatureService.updateRequestStatus(signatureRequest.id!, "sent");
          }
        }
      } catch (sigError) {
        console.error("Failed to create signature request:", sigError);
        // Don't fail document generation if signature request creation fails
      }
    }

    // Return PDF as base64 or binary
    // For API route, we'll return base64 encoded
    const base64 = Buffer.from(pdfBytes).toString("base64");

    // If recordId is provided, attach the generated document to the record
    if (recordId) {
      try {
        // Get current user for uploaded_by
        const { data: { user } } = await supabase.auth.getUser();
        let uploadedBy: string | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .single();
          uploadedBy = profile?.id || null;
        }

        // Create record_documents entry to bind this document to the record
        const { error: attachError } = await supabase
          .from("record_documents")
          .insert({
            record_id: recordId,
            base_id: baseId,
            table_id: tableId || null,
            document_path: storagePath,
            document_name: finalFileName,
            mime_type: "application/pdf",
            size_bytes: pdfBytes.byteLength,
            uploaded_by: uploadedBy,
          });

        if (attachError) {
          console.error("Failed to attach document to record:", attachError);
          // Don't fail the generation if attachment fails
        }
      } catch (attachErr) {
        console.error("Error attaching document to record:", attachErr);
        // Don't fail the generation if attachment fails
      }
    }

    return NextResponse.json({
      success: true,
      pdf: base64,
      fileName: finalFileName,
      documentPath: storagePath,
      signatureRequestId: signatureRequestId,
      requiresSignatures: validESignatureFields.length > 0,
    });
  } catch (error: any) {
    console.error("Failed to generate document:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}

