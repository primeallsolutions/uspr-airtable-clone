import { supabase } from "../supabaseClient";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET || "documents";

const basePrefix = (baseId: string, tableId?: string | null) =>
  tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;

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

export type TemplateField = {
  id?: string;
  template_id?: string;
  field_name: string;
  field_key: string;
  field_type: "text" | "number" | "date" | "checkbox" | "signature";
  page_number: number;
  x_position: number;
  y_position: number;
  width?: number;
  height?: number;
  font_size?: number;
  font_name?: string;
  is_required?: boolean;
  default_value?: string;
  order_index?: number;
  validation_rules?: Array<{
    type: "minLength" | "maxLength" | "pattern" | "min" | "max" | "required";
    value?: string | number;
    message?: string;
  }>;
  formatting_options?: {
    textCase?: "uppercase" | "lowercase" | "title";
    numberFormat?: "currency" | "percentage" | "decimal" | "integer";
    currencySymbol?: string;
    decimalPlaces?: number;
    dateFormat?: string;
    inputMask?: string;
  };
  // E-signature configuration
  requires_esignature?: boolean;
  esignature_signer_email?: string;
  esignature_signer_name?: string;
  esignature_signer_role?: "signer" | "viewer" | "approver";
  esignature_sign_order?: number;
};

export type DocumentTemplate = {
  id: string;
  base_id: string;
  table_id?: string | null;
  name: string;
  description?: string | null;
  template_file_path: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  fields?: TemplateField[];
};

export const TemplateService = {
  /**
   * List all templates for a base/table
   */
  async listTemplates(baseId: string, tableId?: string | null): Promise<DocumentTemplate[]> {
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

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single template with its fields
   */
  async getTemplate(templateId: string): Promise<DocumentTemplate | null> {
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError) throw templateError;
    if (!template) return null;

    // Fetch fields
    const { data: fields, error: fieldsError } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index", { ascending: true });

    if (fieldsError) throw fieldsError;

    return {
      ...template,
      fields: fields || [],
    };
  },

  /**
   * Upload a template PDF file and create template record
   */
  async createTemplate(params: {
    baseId: string;
    tableId?: string | null;
    name: string;
    description?: string | null;
    file: File;
  }): Promise<DocumentTemplate> {
    const { baseId, tableId, name, description, file } = params;

    if (!file || file.size === 0) {
      throw new Error("Empty file or missing file data");
    }

    if (file.type !== "application/pdf") {
      throw new Error("Only PDF files are supported as templates");
    }

    // Upload template file to storage
    const prefix = basePrefix(baseId, tableId);
    const templatesFolder = "templates/";
    const safeName = sanitizeFileName(file.name);
    const timestamp = Date.now();
    const finalName = `${timestamp}-${safeName}`;
    const fullPath = `${prefix}${templatesFolder}${finalName}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fullPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });

    if (uploadError) throw uploadError;

    // Create template record
    const { data: profile } = await supabase.auth.getUser();
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .insert({
        base_id: baseId,
        table_id: tableId,
        name,
        description: description || null,
        template_file_path: `${templatesFolder}${finalName}`,
        created_by: profile?.user?.id || null,
      })
      .select()
      .single();

    if (templateError) throw templateError;
    return template;
  },

  /**
   * Update template metadata
   */
  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string;
    }
  ): Promise<DocumentTemplate> {
    const { data, error } = await supabase
      .from("document_templates")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete template and its file
   */
  async deleteTemplate(baseId: string, tableId: string | null, templateId: string): Promise<void> {
    // Get template to find file path
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error("Template not found");

    // Delete file from storage
    const prefix = basePrefix(baseId, tableId);
    const fullPath = `${prefix}${template.template_file_path}`;
    const { error: deleteError } = await supabase.storage.from(BUCKET).remove([fullPath]);

    // Delete template record (fields will be cascade deleted)
    const { error: templateError } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", templateId);

    if (templateError) throw templateError;
    if (deleteError) {
      console.warn("Failed to delete template file:", deleteError);
      // Don't throw - template record is deleted
    }
  },

  /**
   * Get signed URL for template file
   */
  async getTemplateSignedUrl(
    baseId: string,
    tableId: string | null,
    templateFilePath: string,
    expiresIn = 600
  ): Promise<string> {
    const prefix = basePrefix(baseId, tableId);
    const cleanPath = templateFilePath.startsWith("/") ? templateFilePath.slice(1) : templateFilePath;
    const fullPath = `${prefix}${cleanPath}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(fullPath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Create or update a template field
   */
  async upsertField(templateId: string, field: TemplateField): Promise<TemplateField> {
    const fieldData = {
      template_id: templateId,
      field_name: field.field_name,
      field_key: field.field_key,
      field_type: field.field_type,
      page_number: field.page_number,
      x_position: field.x_position,
      y_position: field.y_position,
      width: field.width || null,
      height: field.height || null,
      font_size: field.font_size || 12,
      font_name: field.font_name || "Helvetica",
      is_required: field.is_required || false,
      default_value: field.default_value || null,
      order_index: field.order_index || 0,
      updated_at: new Date().toISOString(),
    };

    if (field.id) {
      // Update existing field
      const { data, error } = await supabase
        .from("template_fields")
        .update(fieldData)
        .eq("id", field.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new field
      const { data, error } = await supabase
        .from("template_fields")
        .insert(fieldData)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  /**
   * Delete a template field
   */
  async deleteField(fieldId: string): Promise<void> {
    const { error } = await supabase.from("template_fields").delete().eq("id", fieldId);
    if (error) throw error;
  },

  /**
   * Get all fields for a template
   */
  async getTemplateFields(templateId: string): Promise<TemplateField[]> {
    const { data, error } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Check if a template has signature fields (any field with field_type === "signature")
   */
  async hasActiveSignatureFields(templateId: string): Promise<boolean> {
    const { data: fields, error } = await supabase
      .from("template_fields")
      .select("id")
      .eq("template_id", templateId)
      .eq("field_type", "signature");

    if (error) throw error;
    return (fields?.length || 0) > 0;
  },

  /**
   * Get signature fields for a template (any field with field_type === "signature")
   */
  async getActiveSignatureFields(templateId: string): Promise<TemplateField[]> {
    const { data: fields, error } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_id", templateId)
      .eq("field_type", "signature")
      .order("order_index", { ascending: true });

    if (error) throw error;
    return fields || [];
  },
};
