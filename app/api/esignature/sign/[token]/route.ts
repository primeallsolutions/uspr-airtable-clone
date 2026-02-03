import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ESignatureService } from "@/lib/services/esign-service";
import { PDFDocument } from "pdf-lib";

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

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

/**
 * GET /api/esignature/sign/[token]
 * Get signing page data (document, fields, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Use admin client for public signing endpoint (signers don't need authentication)
    const signer = await ESignatureService.getSignerByToken(token, supabaseAdmin);
    if (!signer) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 404 });
    }

    const signatureRequest = await ESignatureService.getSignatureRequest(
      signer.signature_request_id,
      supabaseAdmin
    );
    if (!signatureRequest) {
      return NextResponse.json({ error: "Signature request not found" }, { status: 404 });
    }

    // Check if request is expired
    if (
      signatureRequest.expires_at &&
      new Date(signatureRequest.expires_at) < new Date()
    ) {
      return NextResponse.json({ error: "This signature request has expired" }, { status: 400 });
    }

    // Get fields for this signer
    console.log("Getting fields for signer:", {
      signerId: signer.id,
      signerEmail: signer.email,
      requestId: signatureRequest.id
    });
    const fields = await ESignatureService.getSignerFields(signer.id!, supabaseAdmin);
    console.log(`Found ${fields.length} fields for signer ${signer.email}:`, fields.map(f => ({
      id: f.id,
      page: f.page_number,
      x: f.x_position,
      y: f.y_position,
      type: f.field_type,
      label: f.label
    })));

    // Get signed URL for document
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(signatureRequest.document_path, 3600);

    if (urlError || !urlData) {
      return NextResponse.json(
        { error: "Failed to get document URL" },
        { status: 500 }
      );
    }

    // Check if signer has already signed
    if (signer.status === "signed") {
      return NextResponse.json({
        signer,
        request: signatureRequest,
        fields,
        documentUrl: urlData.signedUrl,
        alreadySigned: true,
      });
    }

    // Update signer status to "viewed" if not already
    if (signer.status === "pending" || signer.status === "sent") {
      await ESignatureService.updateSignerStatus(signer.id!, "viewed", {
        viewed_at: new Date().toISOString(),
      }, supabaseAdmin);
      await ESignatureService.checkAndUpdateRequestCompletion(signatureRequest.id!, supabaseAdmin);
    }

    return NextResponse.json({
      signer,
      request: signatureRequest,
      fields,
      documentUrl: urlData.signedUrl,
      alreadySigned: false,
    });
  } catch (error: any) {
    console.error("Failed to get signing data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get signing data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/esignature/sign/[token]
 * Submit signature
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { signatureData, fieldValues } = body; // signatureData is base64 image, fieldValues is object with field_id -> value

    // Use admin client for public signing endpoint
    const signer = await ESignatureService.getSignerByToken(token, supabaseAdmin);
    if (!signer) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 404 });
    }

    // Check if already signed
    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "This document has already been signed" },
        { status: 400 }
      );
    }

    const signatureRequest = await ESignatureService.getSignatureRequest(
      signer.signature_request_id,
      supabaseAdmin
    );
    if (!signatureRequest) {
      return NextResponse.json({ error: "Signature request not found" }, { status: 404 });
    }

    // Get fields for this signer
    const fields = await ESignatureService.getSignerFields(signer.id!, supabaseAdmin);

    // Get document from storage
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(signatureRequest.document_path, 600);

    if (urlError || !urlData) {
      return NextResponse.json(
        { error: "Failed to get document URL" },
        { status: 500 }
      );
    }

    // Fetch PDF
    const pdfResponse = await fetch(urlData.signedUrl);
    if (!pdfResponse.ok) {
      throw new Error("Failed to fetch PDF");
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Embed signatures into PDF
    for (const field of fields) {
      const fieldValue = fieldValues[field.id!];
      if (!fieldValue && field.is_required) {
        return NextResponse.json(
          { error: `Required field ${field.label || field.id} is missing` },
          { status: 400 }
        );
      }

      if (fieldValue && field.field_type === "signature") {
        const page = pdfDoc.getPage(field.page_number - 1);

        // Convert base64 to image
        const imageBytes = Uint8Array.from(
          atob(fieldValue.split(",")[1] || fieldValue),
          (c) => c.charCodeAt(0)
        );

        try {
          const signatureImage = await pdfDoc.embedPng(imageBytes);
          const sigWidth = Math.min(field.width || 150, signatureImage.width);
          const sigHeight =
            (signatureImage.height / signatureImage.width) * sigWidth;

          page.drawImage(signatureImage, {
            x: field.x_position,
            y: field.y_position - sigHeight, // field.y_position is already in PDF coordinates (from bottom)
            width: sigWidth,
            height: sigHeight,
          });
        } catch (err) {
          console.error("Failed to embed signature:", err);
          // Try as JPEG if PNG fails
          try {
            const signatureImage = await pdfDoc.embedJpg(imageBytes);
            const sigWidth = Math.min(field.width || 150, signatureImage.width);
            const sigHeight =
              (signatureImage.height / signatureImage.width) * sigWidth;

            page.drawImage(signatureImage, {
              x: field.x_position,
              y: field.y_position - sigHeight, // field.y_position is already in PDF coordinates (from bottom)
              width: sigWidth,
              height: sigHeight,
            });
          } catch (jpgErr) {
            console.error("Failed to embed signature as JPEG:", jpgErr);
          }
        }
      } else if (fieldValue && field.field_type === "text") {
        const page = pdfDoc.getPage(field.page_number - 1);
        page.drawText(String(fieldValue), {
          x: field.x_position,
          y: field.y_position - (field.height || 20), // field.y_position is already in PDF coordinates (from bottom)
          size: 12,
        });
      } else if (fieldValue && field.field_type === "date") {
        const page = pdfDoc.getPage(field.page_number - 1);
        page.drawText(String(fieldValue), {
          x: field.x_position,
          y: field.y_position - (field.height || 20), // field.y_position is already in PDF coordinates (from bottom)
          size: 12,
        });
      }
    }

    // Save signed PDF
    const signedPdfBytes = await pdfDoc.save();

    // Check if all other signers have already signed (to determine if this is the final signature)
    const allSigners = await ESignatureService.getSignatureRequest(signer.signature_request_id, supabaseAdmin);
    const otherSigners = allSigners?.signers?.filter(s => s.id !== signer.id) || [];
    const allOthersSigned = otherSigners.every(s => s.status === "signed");
    const isLastSigner = allOthersSigned;

    // Always create a new signed document instead of replacing the original
    // This prevents accidentally modifying templates or original documents
    const basePrefix = `bases/${signatureRequest.base_id}/`;
    
    // Extract original filename and create signed version name
    const originalPath = signatureRequest.document_path;
    const originalFileName = originalPath.split("/").pop() || "document.pdf";
    const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, "");
    const timestamp = Date.now();
    
    let signedPath: string;
    
    if (isLastSigner) {
      // Create final signed document with a clear naming convention
      // Format: {original_name}_signed_{request_id}_{timestamp}.pdf
      const signedFileName = `${fileNameWithoutExt}_signed_${signatureRequest.id}_${timestamp}.pdf`;
      signedPath = `${basePrefix}${signedFileName}`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(signedPath, signedPdfBytes, {
          contentType: "application/pdf",
          upsert: false, // Don't overwrite - create new file
        });

      if (uploadError) {
        throw new Error(`Failed to upload signed document: ${uploadError.message}`);
      }
      
      // Update the signature request to point to the new signed document
      await supabaseAdmin
        .from("signature_requests")
        .update({ 
          document_path: signedPath,
          updated_at: new Date().toISOString()
        })
        .eq("id", signatureRequest.id!);
    } else {
      // Create temporary signed version for this signer
      const signedFileName = `signed_${signer.id}_${timestamp}.pdf`;
      signedPath = `${basePrefix}${signedFileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(signedPath, signedPdfBytes, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload signed document: ${uploadError.message}`);
      }
      
      // Store this signer's signed version - will be merged when all signers complete
    }

    // Update signer status
    await ESignatureService.updateSignerStatus(signer.id!, "signed", {
      signed_at: new Date().toISOString(),
      signed_document_path: signedPath,
    }, supabaseAdmin);

    // Check if all signers have completed
    const allCompleted = await ESignatureService.checkAndUpdateRequestCompletion(
      signatureRequest.id!,
      supabaseAdmin
    );

    // If all signers have completed, ensure final document has all signatures
    if (allCompleted) {
      // Get all signed document paths
      const finalRequest = await ESignatureService.getSignatureRequest(signatureRequest.id!, supabaseAdmin);
      const signedPaths = finalRequest?.signers?.map(s => s.signed_document_path).filter(Boolean) || [];
      
      // If we have multiple signed versions (parallel signing), merge them
      // Create a new merged document instead of replacing the original
      if (signedPaths.length > 1) {
        try {
          // Load all signed versions and merge them
          const { PDFDocument } = await import("pdf-lib");
          const mergedDoc = await PDFDocument.create();
          
          // Load and merge each signed document
          for (const signedPath of signedPaths) {
            if (!signedPath) continue;
            
            const signedUrl = await supabaseAdmin.storage
              .from(BUCKET)
              .createSignedUrl(signedPath, 600);
            
            if (signedUrl.data) {
              const signedResponse = await fetch(signedUrl.data.signedUrl);
              const signedBytes = await signedResponse.arrayBuffer();
              const signedPdfDoc = await PDFDocument.load(signedBytes);
              
              // Copy all pages from this signed document
              const pages = await mergedDoc.copyPages(signedPdfDoc, signedPdfDoc.getPageIndices());
              pages.forEach((page) => mergedDoc.addPage(page));
            }
          }
          
          // Create new merged document file
          const mergedBytes = await mergedDoc.save();
          const originalFileName = signatureRequest.document_path.split("/").pop() || "document.pdf";
          const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, "");
          const mergedFileName = `${fileNameWithoutExt}_signed_${signatureRequest.id}_${Date.now()}.pdf`;
          const mergedPath = `${basePrefix}${mergedFileName}`;
          
          await supabaseAdmin.storage
            .from(BUCKET)
            .upload(mergedPath, mergedBytes, {
              contentType: "application/pdf",
              upsert: false, // Create new file, don't overwrite
            });
          
          // Update the signature request to point to the merged document
          await supabaseAdmin
            .from("signature_requests")
            .update({ 
              document_path: mergedPath,
              updated_at: new Date().toISOString()
            })
            .eq("id", signatureRequest.id!);
        } catch (mergeError) {
          console.error("Failed to merge signed documents:", mergeError);
          // Continue anyway - at least one signed version exists
        }
      }

      // Generate completion certificate
      const certificatePath = await ESignatureService.generateCompletionCertificate(
        signatureRequest,
        signatureRequest.document_path
      );
      await ESignatureService.updateRequestStatus(signatureRequest.id!, "completed", {
        completed_at: new Date().toISOString(),
        completion_certificate_path: certificatePath,
      }, supabaseAdmin);

      // Copy signed PDF to record's documents folder if record is associated
      if (signatureRequest.record_id) {
        try {
          // Build path - base-level records don't use table_id
          const recordDocsPath = `bases/${signatureRequest.base_id}/records/${signatureRequest.record_id}/`;
          
          // Get signed URL for the final signed document
          const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(signatureRequest.document_path, 600);
          
          if (signedUrlError || !signedUrlData) {
            console.error("Failed to get signed URL for copying to record:", signedUrlError);
          } else {
            // Download signed PDF
            const response = await fetch(signedUrlData.signedUrl);
            if (!response.ok) {
              throw new Error("Failed to download signed PDF");
            }
            
            // Extract filename from path
            const fileName = signatureRequest.document_path.split("/").pop() || "signed-document.pdf";
            
            // Upload to record's documents folder
            const uploadPath = recordDocsPath + Date.now() + "_" + fileName;
            console.log("Uploading signed document to:", uploadPath);
            
            const { error: uploadError } = await supabaseAdmin.storage
              .from(BUCKET)
              .upload(uploadPath, signedPdfBytes, {
                contentType: "application/pdf",
                upsert: false,
              });
            
            if (uploadError) {
              console.error("Failed to copy signed document to record:", uploadError);
            } else {
              console.log(`Successfully copied signed document to record ${signatureRequest.record_id} at path: ${uploadPath}`);
              
              // Add document record to documents table
              try {
                const { error: docError } = await supabaseAdmin
                  .from("record_documents")
                  .insert({
                    record_id: signatureRequest.record_id,
                    base_id: signatureRequest.base_id,
                    document_path: uploadPath,
                    document_name: fileName,
                    mime_type: "application/pdf",
                    size_bytes: pdfBytes.byteLength,
                  });
                
                if (docError) {
                  console.error("Failed to add document to documents table:", docError);
                } else {
                  console.log(`Successfully added document record for ${fileName}`);
                }
              } catch (dbError) {
                console.error("Error inserting document record:", dbError);
              }
            }
          }
        } catch (copyError) {
          console.error("Error copying signed document to record:", copyError);
          // Don't fail the entire operation if copy fails
        }
      }
    }

    return NextResponse.json({ success: true, signedDocumentPath: signedPath });
  } catch (error: any) {
    console.error("Failed to submit signature:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit signature" },
      { status: 500 }
    );
  }
}







