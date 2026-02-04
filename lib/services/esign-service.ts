import { supabase } from "../supabaseClient";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

export type SignatureRequestStatus = "draft" | "sent" | "in_progress" | "completed" | "declined" | "cancelled";
export type SignerStatus = "pending" | "sent" | "viewed" | "signed" | "declined";
export type SignerRole = "signer" | "viewer" | "approver";
export type SignatureFieldType = "signature" | "initial" | "date" | "text";

export interface SignatureRequestSigner {
  id?: string;
  email: string;
  name?: string;
  role?: SignerRole;
  sign_order?: number;
  status?: SignerStatus;
  signed_at?: string;
  viewed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  access_token?: string;
  signed_document_path?: string;
}

export interface SignatureField {
  id?: string;
  signer_id: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width?: number;
  height?: number;
  field_type?: SignatureFieldType;
  label?: string;
  is_required?: boolean;
}

export interface SignatureRequest {
  id?: string;
  base_id: string;
  table_id?: string | null;
  title: string;
  message?: string;
  document_path: string;
  status?: SignatureRequestStatus;
  completion_certificate_path?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  expires_at?: string;
  signers?: SignatureRequestSigner[];
  fields?: SignatureField[];
  // Status column update fields
  record_id?: string | null;
  status_field_id?: string | null;
  status_value_on_complete?: string;
  status_value_on_decline?: string;
}

export interface SignatureVersion {
  id?: string;
  signature_request_id: string;
  version_number: number;
  document_path: string;
  created_by?: string;
  change_description?: string;
  created_at?: string;
}

export interface PackItem {
  id?: string;
  document_path: string;
  document_title: string;
  document_order?: number;
}

export const ESignatureService = {
  /**
   * Generate a unique access token for a signer
   */
  generateAccessToken(): string {
    // Generate random token using Web Crypto API (works in browser and Node.js)
    const array = new Uint8Array(32);
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for Node.js
      const crypto = require("crypto");
      crypto.randomFillSync(array);
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  },

  /**
   * Create a new signature request
   */
  async createSignatureRequest(
    request: Omit<SignatureRequest, "id" | "status" | "created_at" | "updated_at">,
    client?: SupabaseClient
  ): Promise<SignatureRequest> {
    const db = client || supabase;
    const { data, error } = await db
      .from("signature_requests")
      .insert({
        base_id: request.base_id,
        table_id: request.table_id,
        title: request.title,
        message: request.message,
        document_path: request.document_path,
        status: "draft",
        expires_at: request.expires_at,
        created_by: request.created_by,
        // Status column update fields
        record_id: request.record_id || null,
        status_field_id: request.status_field_id || null,
        status_value_on_complete: request.status_value_on_complete || "Signed",
        status_value_on_decline: request.status_value_on_decline || "Declined",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Add signers to a signature request
   */
  async addSigners(
    requestId: string,
    signers: Omit<SignatureRequestSigner, "id" | "status" | "access_token" | "created_at" | "updated_at">[],
    client?: SupabaseClient
  ): Promise<SignatureRequestSigner[]> {
    const db = client || supabase;
    const signersWithTokens = signers.map((signer) => ({
      signature_request_id: requestId,
      email: signer.email,
      name: signer.name,
      role: signer.role || "signer",
      sign_order: signer.sign_order || 0,
      status: "pending" as SignerStatus,
      access_token: this.generateAccessToken(),
    }));

    const { data, error } = await db
      .from("signature_request_signers")
      .insert(signersWithTokens)
      .select();

    if (error) throw error;
    return data;
  },

  /**
   * Add signature fields to a request
   */
  async addSignatureFields(
    requestId: string,
    fields: Omit<SignatureField, "id" | "created_at">[],
    client?: SupabaseClient
  ): Promise<SignatureField[]> {
    const db = client || supabase;
    const fieldsWithRequestId = fields.map((field) => ({
      signature_request_id: requestId,
      signer_id: field.signer_id,
      page_number: field.page_number,
      x_position: field.x_position,
      y_position: field.y_position,
      width: field.width || 150,
      height: field.height || 50,
      field_type: field.field_type || "signature",
      label: field.label,
      is_required: field.is_required !== false,
    }));

    const { data, error } = await db
      .from("signature_fields")
      .insert(fieldsWithRequestId)
      .select();

    if (error) throw error;
    return data;
  },

  /**
   * Get a signature request by ID with all related data
   */
  async getSignatureRequest(requestId: string, client?: SupabaseClient): Promise<SignatureRequest | null> {
    const db = client || supabase;
    const { data, error } = await db
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*),
        fields:signature_fields(*)
      `)
      .eq("id", requestId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return {
      ...data,
      signers: data.signers || [],
      fields: data.fields || [],
    };
  },

  /**
   * Get signature requests for a base
   */
  async listSignatureRequests(baseId: string, tableId?: string | null, client?: SupabaseClient, recordId?: string | null): Promise<SignatureRequest[]> {
    const db = client || supabase;
    let query = db
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*)
      `)
      .eq("base_id", baseId)
      .order("created_at", { ascending: false });

    if (tableId) {
      query = query.eq("table_id", tableId);
    } else {
      query = query.is("table_id", null);
    }
    
    // Filter by recordId if provided
    if (recordId) {
      query = query.eq("record_id", recordId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((req) => ({
      ...req,
      signers: req.signers || [],
    }));
  },

  /**
   * Update signature request status
   */
  async updateRequestStatus(
    requestId: string,
    status: SignatureRequestStatus,
    additionalData?: { completed_at?: string; completion_certificate_path?: string },
    client?: SupabaseClient
  ): Promise<void> {
    const db = client || supabase;
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (additionalData?.completed_at) updateData.completed_at = additionalData.completed_at;
    if (additionalData?.completion_certificate_path)
      updateData.completion_certificate_path = additionalData.completion_certificate_path;

    const { error } = await db
      .from("signature_requests")
      .update(updateData)
      .eq("id", requestId);

    if (error) throw error;
  },

  /**
   * Update signer status
   */
  async updateSignerStatus(
    signerId: string,
    status: SignerStatus,
    additionalData?: { signed_at?: string; viewed_at?: string; declined_at?: string; decline_reason?: string; signed_document_path?: string },
    client?: SupabaseClient
  ): Promise<void> {
    const db = client || supabase;
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (additionalData?.signed_at) updateData.signed_at = additionalData.signed_at;
    if (additionalData?.viewed_at) updateData.viewed_at = additionalData.viewed_at;
    if (additionalData?.declined_at) updateData.declined_at = additionalData.declined_at;
    if (additionalData?.decline_reason) updateData.decline_reason = additionalData.decline_reason;
    if (additionalData?.signed_document_path) updateData.signed_document_path = additionalData.signed_document_path;

    const { error } = await db
      .from("signature_request_signers")
      .update(updateData)
      .eq("id", signerId);

    if (error) throw error;
  },

  /**
   * Get signer by access token
   */
  async getSignerByToken(accessToken: string, client?: SupabaseClient): Promise<SignatureRequestSigner & { signature_request_id: string } | null> {
    const db = client || supabase;
    const { data, error } = await db
      .from("signature_request_signers")
      .select("*")
      .eq("access_token", accessToken)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  },

  /**
   * Get signature fields for a signer
   */
  async getSignerFields(signerId: string, client?: SupabaseClient): Promise<SignatureField[]> {
    const db = client || supabase;
    const { data, error } = await db
      .from("signature_fields")
      .select("*")
      .eq("signer_id", signerId)
      .order("page_number", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Check if all signers have completed and update request status
   */
  async checkAndUpdateRequestCompletion(requestId: string, client?: SupabaseClient): Promise<boolean> {
    const request = await this.getSignatureRequest(requestId, client);
    if (!request || !request.signers) return false;

    const allSigned = request.signers.every(
      (signer) => signer.status === "signed" || signer.status === "declined"
    );
    const anySigned = request.signers.some((signer) => signer.status === "signed");
    const anyDeclined = request.signers.some((signer) => signer.status === "declined");

    if (allSigned) {
      if (anyDeclined && !anySigned) {
        await this.updateRequestStatus(requestId, "declined", undefined, client);
        // Update record status with decline value
        await this.updateRecordStatus(request, "declined", client);
      } else {
        await this.updateRequestStatus(requestId, "completed", {
          completed_at: new Date().toISOString(),
        }, client);
        // Update record status with completion value
        await this.updateRecordStatus(request, "completed", client);
      }
      return true;
    } else if (request.status === "draft" || request.status === "sent") {
      // Check if any signer has started
      const anyStarted = request.signers.some(
        (signer) => signer.status === "viewed" || signer.status === "signed"
      );
      if (anyStarted) {
        await this.updateRequestStatus(requestId, "in_progress", undefined, client);
      }
    }
    return false;
  },

  /**
   * Update record status field when signature request is completed or declined
   */
  async updateRecordStatus(
    request: SignatureRequest,
    status: "completed" | "declined",
    client?: SupabaseClient
  ): Promise<void> {
    const db = client || supabase;
    
    // Check if status update is configured
    if (!request.record_id || !request.status_field_id) {
      console.log("Status update not configured for this signature request");
      return;
    }

    try {
      // Get the field to check its type (single_select requires option key mapping)
      const { data: field, error: fieldError } = await db
        .from("fields")
        .select("id, type, options")
        .eq("id", request.status_field_id)
        .single();

      if (fieldError || !field) {
        console.error("Failed to get status field:", fieldError);
        return;
      }

      // Determine the status value to set
      const statusValue = status === "completed"
        ? request.status_value_on_complete || "Signed"
        : request.status_value_on_decline || "Declined";

      // For single_select fields, we need to find the option key that matches the status value
      let valueToSet: string = statusValue;
      if (field.type === "single_select" && field.options) {
        const options = field.options as Record<string, { name?: string; label?: string }>;
        // Find option key by name/label
        const matchingEntry = Object.entries(options).find(
          ([, opt]) => (opt?.name || opt?.label)?.toLowerCase() === statusValue.toLowerCase()
        );
        if (matchingEntry) {
          valueToSet = matchingEntry[0]; // Use the option key (e.g., "option_1")
        } else {
          console.warn(`No matching option found for status "${statusValue}" in field ${field.id}`);
          // Fall back to creating a new option or using the raw value
        }
      }

      // Get current record values
      const { data: record, error: recordError } = await db
        .from("records")
        .select("values")
        .eq("id", request.record_id)
        .single();

      if (recordError || !record) {
        console.error("Failed to get record for status update:", recordError);
        return;
      }

      // Update the field value
      const updatedValues = {
        ...record.values,
        [request.status_field_id]: valueToSet,
      };

      const { error: updateError } = await db
        .from("records")
        .update({ values: updatedValues })
        .eq("id", request.record_id);

      if (updateError) {
        console.error("Failed to update record status:", updateError);
      } else {
        console.log(`✅ Updated record ${request.record_id} status field to "${statusValue}"`);
      }
    } catch (error) {
      console.error("Error updating record status:", error);
    }
  },

  /**
   * Create a new version of a signature request document
   */
  async createVersion(
    requestId: string,
    versionData: Pick<SignatureVersion, "document_path" | "created_by" | "change_description">
  ): Promise<SignatureVersion> {
    // Get current max version number
    const { data: existingVersions, error: fetchError } = await supabase
      .from("signature_versions")
      .select("version_number")
      .eq("signature_request_id", requestId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

    const nextVersion = existingVersions && existingVersions.length > 0
      ? existingVersions[0].version_number + 1
      : 1;

    const { data, error } = await supabase
      .from("signature_versions")
      .insert({
        signature_request_id: requestId,
        version_number: nextVersion,
        document_path: versionData.document_path,
        created_by: versionData.created_by,
        change_description: versionData.change_description,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get version history for a signature request
   */
  async getVersions(requestId: string): Promise<SignatureVersion[]> {
    const { data, error } = await supabase
      .from("signature_versions")
      .select("*")
      .eq("signature_request_id", requestId)
      .order("version_number", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a pack (collection of documents)
   */
  async createPack(
    request: Omit<SignatureRequest, "id" | "status" | "created_at" | "updated_at">,
    packItems: PackItem[],
    client?: SupabaseClient
  ): Promise<SignatureRequest> {
    const db = client || supabase;
    // Create the main request
    const signatureRequest = await this.createSignatureRequest(request, client);

    // Add pack items
    const packItemsWithRequestId = packItems.map((item, index) => ({
      pack_request_id: signatureRequest.id,
      document_path: item.document_path,
      document_title: item.document_title,
      document_order: item.document_order ?? index,
    }));

    const { error: packError } = await db
      .from("signature_request_pack_items")
      .insert(packItemsWithRequestId);

    if (packError) throw packError;

    return signatureRequest;
  },

  /**
   * Get pack items for a request
   */
  async getPackItems(requestId: string): Promise<PackItem[]> {
    const { data, error } = await supabase
      .from("signature_request_pack_items")
      .select("*")
      .eq("pack_request_id", requestId)
      .order("document_order", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Send signature request email using Resend
   */
  async sendSignatureRequestEmail(
    signer: SignatureRequestSigner & { signature_request_id: string },
    request: SignatureRequest
  ): Promise<void> {
    // #region agent log
    const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1';
    fetch(DEBUG_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'esign-service.ts:sendSignatureRequestEmail:entry',message:'sendSignatureRequestEmail called',data:{signerEmail:signer.email,requestTitle:request.title,requestId:signer.signature_request_id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    try {
      const { EmailService } = await import("./email-service");
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const signUrl = `${baseUrl}/sign/${signer.access_token}`;
      
      // #region agent log
      fetch(DEBUG_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'esign-service.ts:sendSignatureRequestEmail:beforeGenerate',message:'About to generate email and call sendEmail',data:{signerEmail:signer.email,signUrl,baseUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      const html = EmailService.generateSignatureRequestEmail({
        signerName: signer.name || signer.email.split("@")[0],
        requestTitle: request.title,
        message: request.message || undefined,
        signUrl,
        expiresAt: request.expires_at || undefined,
      });

      await EmailService.sendEmail({
        to: signer.email,
        subject: `Please sign: ${request.title}`,
        html,
      });

      // #region agent log
      fetch(DEBUG_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'esign-service.ts:sendSignatureRequestEmail:success',message:'Email sent successfully via EmailService',data:{signerEmail:signer.email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      console.log(`Signature request email sent to ${signer.email}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // #region agent log
      fetch(DEBUG_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'esign-service.ts:sendSignatureRequestEmail:error',message:'Error caught in sendSignatureRequestEmail',data:{signerEmail:signer.email,error:errorMessage},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error(`Failed to send email to ${signer.email}:`, errorMessage);
      // Re-throw so the caller can handle the error appropriately
      throw error;
    }
  },

  /**
   * Generate completion certificate PDF
   */
  async generateCompletionCertificate(
    request: SignatureRequest,
    signedDocumentPath: string
  ): Promise<string> {
    // TODO: Generate completion certificate PDF using pdf-lib
    // This should include:
    // - Document title
    // - Signers and their signatures
    // - Completion date
    // - Request ID
    
    // For now, return a placeholder path
    // In production, create the PDF and upload to storage
    const certificatePath = `${request.document_path}_certificate_${Date.now()}.pdf`;
    return certificatePath;
  },
};

