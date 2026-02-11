import { supabase } from "../supabaseClient";

export type ChecklistItem = {
  id?: string;
  checklist_template_id?: string;
  title: string;
  description?: string | null;
  order_index?: number;
  is_required?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ChecklistTemplate = {
  id: string;
  base_id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: ChecklistItem[];
};

export const ChecklistTemplatesService = {
  /**
   * List all checklist templates for a base
   */
  async listTemplates(baseId: string): Promise<ChecklistTemplate[]> {
    const { data: templates, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("base_id", baseId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch items for each template
    if (templates && templates.length > 0) {
      const templatesWithItems = await Promise.all(
        templates.map(async (template) => {
          const { data: items, error: itemsError } = await supabase
            .from("checklist_items")
            .select("*")
            .eq("checklist_template_id", template.id)
            .order("order_index", { ascending: true });

          if (itemsError) throw itemsError;
          return {
            ...template,
            items: items || [],
          };
        })
      );
      return templatesWithItems;
    }

    return [];
  },

  /**
   * Get a single checklist template with its items
   */
  async getTemplate(templateId: string): Promise<ChecklistTemplate | null> {
    const { data: template, error: templateError } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError) throw templateError;
    if (!template) return null;

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("checklist_template_id", templateId)
      .order("order_index", { ascending: true });

    if (itemsError) throw itemsError;

    return {
      ...template,
      items: items || [],
    };
  },

  /**
   * Create a new checklist template
   */
  async createTemplate(params: {
    baseId: string;
    name: string;
    description?: string | null;
    items?: ChecklistItem[];
  }): Promise<ChecklistTemplate> {
    const { baseId, name, description, items = [] } = params;

    if (!name.trim()) {
      throw new Error("Template name is required");
    }

    // Create the template
    const { data: template, error: templateError } = await supabase
      .from("checklist_templates")
      .insert({
        base_id: baseId,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (templateError) throw templateError;
    if (!template) throw new Error("Failed to create template");

    // Add items if provided
    let createdItems: ChecklistItem[] = [];
    if (items.length > 0) {
      const itemsToInsert = items.map((item, index) => ({
        checklist_template_id: template.id,
        title: item.title,
        description: item.description || null,
        order_index: item.order_index ?? index,
        is_required: item.is_required ?? false,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("checklist_items")
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;
      createdItems = insertedItems || [];
    }

    return {
      ...template,
      items: createdItems,
    };
  },

  /**
   * Update a checklist template
   */
  async updateTemplate(
    templateId: string,
    params: {
      name?: string;
      description?: string | null;
    }
  ): Promise<ChecklistTemplate | null> {
    const { name, description } = params;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const { data, error } = await supabase
      .from("checklist_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return null;

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("checklist_template_id", templateId)
      .order("order_index", { ascending: true });

    if (itemsError) throw itemsError;

    return {
      ...data,
      items: items || [],
    };
  },

  /**
   * Delete a checklist template (cascade deletes items)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from("checklist_templates")
      .delete()
      .eq("id", templateId);

    if (error) throw error;
  },

  /**
   * Add an item to a checklist template
   */
  async addItem(
    templateId: string,
    item: {
      title: string;
      description?: string | null;
      is_required?: boolean;
    }
  ): Promise<ChecklistItem> {
    // Get current max order_index
    const { data: items, error: fetchError } = await supabase
      .from("checklist_items")
      .select("order_index")
      .eq("checklist_template_id", templateId)
      .order("order_index", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    const maxOrder = items?.[0]?.order_index ?? -1;
    const newOrder = maxOrder + 1;

    const { data, error } = await supabase
      .from("checklist_items")
      .insert({
        checklist_template_id: templateId,
        title: item.title,
        description: item.description || null,
        order_index: newOrder,
        is_required: item.is_required ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to add item");

    return data;
  },

  /**
   * Update a checklist item
   */
  async updateItem(
    itemId: string,
    params: {
      title?: string;
      description?: string | null;
      is_required?: boolean;
      order_index?: number;
    }
  ): Promise<ChecklistItem> {
    const updateData: any = {};

    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.is_required !== undefined) updateData.is_required = params.is_required;
    if (params.order_index !== undefined) updateData.order_index = params.order_index;

    const { data, error } = await supabase
      .from("checklist_items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to update item");

    return data;
  },

  /**
   * Delete a checklist item
   */
  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", itemId);

    if (error) throw error;
  },

  /**
   * Reorder items in a checklist template
   */
  async reorderItems(
    items: Array<{ id: string; order_index: number }>
  ): Promise<void> {
    for (const item of items) {
      const { error } = await supabase
        .from("checklist_items")
        .update({ order_index: item.order_index })
        .eq("id", item.id);

      if (error) throw error;
    }
  },

  /**
   * Get checklist items with completion state for a record
   */
  async getRecordChecklistItems(
    recordId: string,
    checklistTemplateId: string
  ): Promise<Array<ChecklistItem & { is_completed: boolean }>> {
    const { data: items, error: itemsError } = await supabase
      .from("checklist_items")
      .select(
        `
        *,
        record_checklist_completions!left(is_completed)
      `
      )
      .eq("checklist_template_id", checklistTemplateId)
      .eq("record_checklist_completions.record_id", recordId)
      .order("order_index", { ascending: true });

    if (itemsError) throw itemsError;

    return items?.map((item: any) => ({
      ...item,
      is_completed:
        item.record_checklist_completions?.length > 0
          ? item.record_checklist_completions[0]?.is_completed || false
          : false,
    })) || [];
  },

  /**
   * Toggle completion state of a checklist item for a record
   */
  async toggleRecordChecklistItem(
    recordId: string,
    itemId: string,
    isCompleted: boolean
  ): Promise<void> {
    // First try to update existing record
    const { data: existing, error: fetchError } = await supabase
      .from("record_checklist_completions")
      .select("id")
      .eq("record_id", recordId)
      .eq("checklist_item_id", itemId)
      .single();

    if (existing && !fetchError) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("record_checklist_completions")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from("record_checklist_completions")
        .insert({
          record_id: recordId,
          checklist_item_id: itemId,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        });

      if (insertError) throw insertError;
    }
  },

  /**
   * Get all checklist templates for a base (for selecting in record view)
   */
  async listTemplatesForRecords(
    baseId: string
  ): Promise<ChecklistTemplate[]> {
    const { data: templates, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("base_id", baseId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch items for each template
    if (templates && templates.length > 0) {
      const templatesWithItems = await Promise.all(
        templates.map(async (template) => {
          const { data: items, error: itemsError } = await supabase
            .from("checklist_items")
            .select("*")
            .eq("checklist_template_id", template.id)
            .order("order_index", { ascending: true });

          if (itemsError) throw itemsError;
          return {
            ...template,
            items: items || [],
          };
        })
      );
      return templatesWithItems;
    }

    return templates || [];
  },
};
