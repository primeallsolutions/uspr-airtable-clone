import { supabase } from '../supabaseClient';
import { BaseExportService } from './base-export-service';
import { BaseImportService } from './base-import-service';
import type { Template, CreateTemplateData, UpdateTemplateData } from '../types/templates';
import type { ExportedBase } from './base-export-service';

export class TemplateService {
  /**
   * Get all templates (global + user's own templates)
   * @param userId - Optional user ID to filter user's templates
   */
  static async getTemplates(userId?: string): Promise<Template[]> {
    let query = supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    // If userId is provided, get global templates + user's templates
    // If not provided, only get global templates
    if (userId) {
      query = query.or(`is_global.eq.true,created_by.eq.${userId}`);
    } else {
      query = query.eq('is_global', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as Template[];
  }

  /**
   * Get templates filtered by category
   */
  static async getTemplatesByCategory(category: string, userId?: string): Promise<Template[]> {
    const templates = await this.getTemplates(userId);
    return templates.filter(t => t.category === category);
  }

  /**
   * Get a single template by ID
   */
  static async getTemplateById(id: string): Promise<Template> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Template not found');

    return data as Template;
  }

  /**
   * Create a template from an existing base
   * @param baseId - The ID of the base to convert into a template
   * @param templateData - Template metadata (name, description, category, icon)
   */
  static async createTemplateFromBase(
    baseId: string,
    templateData: CreateTemplateData
  ): Promise<Template> {
    // Get current user
    const { data: userResp, error: userError } = await supabase.auth.getUser();
    if (userError || !userResp.user?.id) {
      throw new Error('User must be authenticated to create templates');
    }

    // Export the base structure (with or without records)
    const exportedBase = await BaseExportService.exportBase(
      baseId,
      templateData.includeRecords ?? true,
      templateData.name
    );

    // Create the template in database
    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: templateData.name,
        description: templateData.description || null,
        category: templateData.category,
        icon: templateData.icon || null,
        is_global: false, // User templates are never global
        created_by: userResp.user.id,
        template_data: exportedBase
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create template');

    return data as Template;
  }

  /**
   * Create a template directly from ExportedBase data (for seeding)
   * This is primarily used for creating global templates
   */
  static async createTemplateFromData(
    templateData: ExportedBase,
    metadata: {
      name: string;
      description?: string;
      category: string;
      icon?: string;
      isGlobal?: boolean;
    }
  ): Promise<Template> {
    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: metadata.name,
        description: metadata.description || null,
        category: metadata.category,
        icon: metadata.icon || null,
        is_global: metadata.isGlobal ?? false,
        created_by: null, // System templates have no creator
        template_data: templateData
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create template');

    return data as Template;
  }

  /**
   * Create a new base from a template
   * @param templateId - The ID of the template to use
   * @param workspaceId - The workspace where the new base should be created
   * @param baseName - Optional custom name for the new base
   */
  static async createBaseFromTemplate(
    templateId: string,
    workspaceId: string,
    baseName?: string
  ): Promise<string> {
    // Get the template
    const template = await this.getTemplateById(templateId);

    // Import the base using the template data
    const newBaseId = await BaseImportService.importBase(
      template.template_data,
      workspaceId,
      baseName || template.name
    );

    return newBaseId;
  }

  /**
   * Update a template (only for user's own templates)
   */
  static async updateTemplate(
    templateId: string,
    updates: UpdateTemplateData
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.icon !== undefined) updateData.icon = updates.icon;

    const { error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', templateId);

    if (error) throw error;
  }

  /**
   * Delete a template (only for user's own templates)
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
  }

  /**
   * Check if a template belongs to the current user
   */
  static async isOwner(templateId: string): Promise<boolean> {
    const { data: userResp, error: userError } = await supabase.auth.getUser();
    if (userError || !userResp.user?.id) {
      return false;
    }

    const { data, error } = await supabase
      .from('templates')
      .select('created_by')
      .eq('id', templateId)
      .single();

    if (error || !data) return false;

    return data.created_by === userResp.user.id;
  }

  /**
   * Get template statistics (for UI display)
   */
  static getTemplateStats(template: Template): {
    tableCount: number;
    fieldCount: number;
    recordCount: number;
  } {
    const templateData = template.template_data;
    
    return {
      tableCount: templateData.tables?.length ?? 0,
      fieldCount: templateData.fields?.length ?? 0,
      recordCount: templateData.records?.length ?? 0
    };
  }
}
