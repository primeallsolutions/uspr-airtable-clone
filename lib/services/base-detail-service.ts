import { supabase } from '../supabaseClient';
import type {
  BaseRow,
  TableRow,
  FieldRow,
  RecordRow,
  Automation,
  AutomationAction,
  CreateTableData,
  CreateFieldData,
  FieldType
} from '../types/base-detail';

// Simple in-memory cache for automations per base to reduce repeated fetches on cell updates
const automationCache = new Map<string, Automation[]>();

// Helper function to clean and extract valid email from malformed input
function cleanEmailValue(value: string): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  // Remove extra whitespace
  let cleaned = value.trim();

  // Remove common delimiters and extract the first valid email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = cleaned.match(emailRegex);

  if (matches && matches.length > 0) {
    // Return the first valid email found
    return matches[0];
  }

  // If no valid email found, try to clean up common issues
  // Remove extra characters that might be before/after email
  cleaned = cleaned.replace(/^[^a-zA-Z0-9._%+-]*/, ''); // Remove leading non-email chars
  cleaned = cleaned.replace(/[^a-zA-Z0-9._%+-@]*$/, ''); // Remove trailing non-email chars

  // Check if the cleaned string is now a valid email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

// Helper function to parse date/datetime values from various formats
function parseDateValue(value: string): Date | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim();

  // Handle common CSV date formats
  const dateFormats = [
    // ISO formats
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, // ISO with time
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD

    // US formats
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{2}$/, // MM/DD/YY

    // European formats
    /^\d{1,2}\.\d{1,2}\.\d{4}$/, // DD.MM.YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/, // DD-MM-YYYY

    // Other common formats
    /^\d{4}\/\d{1,2}\/\d{1,2}$/, // YYYY/MM/DD
  ];

  // Check if the value matches any known format
  const matchesFormat = dateFormats.some(format => format.test(cleaned));

  if (!matchesFormat) {
    // Try parsing as-is (handles relative dates, etc.)
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return null;
  }

  // Parse the date
  const parsed = new Date(cleaned);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

// Helper function to generate random colors for single select options
function getRandomColor(): string {
  const colors = [
    '#3B82F6', // blue-500
    '#06B6D4', // cyan-500
    '#14B8A6', // teal-500
    '#22C55E', // green-500
    '#EAB308', // yellow-500
    '#F97316', // orange-500
    '#EF4444', // red-500
    '#EC4899', // pink-500
    '#A855F7', // purple-500
    '#6B7280', // gray-500
    '#6366F1', // indigo-500
    '#84CC16', // lime-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#8B5CF6'  // violet-500
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export class BaseDetailService {
  // Base operations
  static async getBase(baseId: string): Promise<BaseRow> {
    const { data, error } = await supabase
      .from("bases")
      .select("id, name, description, created_at, last_opened_at")
      .eq("id", baseId)
      .single();

    if (error) throw error;
    return data as BaseRow;
  }

  static async markBaseOpened(baseId: string): Promise<void> {
    const { error } = await supabase
      .from("bases")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", baseId);

    if (error) throw error;
  }

  static async updateBase(baseId: string, updates: Partial<BaseRow>): Promise<void> {
    const { error } = await supabase
      .from("bases")
      .update(updates)
      .eq("id", baseId);

    if (error) throw error;
  }

  static async deleteBaseCascade(baseId: string): Promise<void> {
    // Fetch tables for this base up front
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id')
      .eq('base_id', baseId);

    if (tablesError) throw tablesError;
    const tableIds = (tables ?? []).map((t) => t.id);

    // Delete dependent records and fields per table to avoid FK conflicts
    for (const tableId of tableIds) {
      const { error: recordsError } = await supabase.from('records').delete().eq('table_id', tableId);
      if (recordsError) throw recordsError;

      const { error: fieldsError } = await supabase.from('fields').delete().eq('table_id', tableId);
      if (fieldsError) throw fieldsError;
    }

    // Base memberships -> role tags -> memberships
    const { data: memberships, error: membershipFetchError } = await supabase
      .from('base_memberships')
      .select('id')
      .eq('base_id', baseId);
    if (membershipFetchError) throw membershipFetchError;
    const membershipIds = (memberships ?? []).map((m) => m.id);
    if (membershipIds.length > 0) {
      const { error: membershipTagsError } = await supabase
        .from('base_membership_role_tags')
        .delete()
        .in('membership_id', membershipIds);
      if (membershipTagsError) throw membershipTagsError;
    }
    const { error: membershipsDeleteError } = await supabase.from('base_memberships').delete().eq('base_id', baseId);
    if (membershipsDeleteError) throw membershipsDeleteError;

    // Automations tied to the base
    const { error: automationsError } = await supabase.from('automations').delete().eq('base_id', baseId);
    if (automationsError) throw automationsError;

    // Invites for this base
    const { error: invitesError } = await supabase.from('invites').delete().eq('base_id', baseId);
    if (invitesError) throw invitesError;

    // Role tags scoped to this base
    const { error: roleTagsError } = await supabase
      .from('role_tags')
      .delete()
      .eq('scope_type', 'base')
      .eq('scope_id', baseId);
    if (roleTagsError) throw roleTagsError;

    // Tables themselves
    if (tableIds.length > 0) {
      const { error: tablesDeleteError } = await supabase.from('tables').delete().in('id', tableIds);
      if (tablesDeleteError) throw tablesDeleteError;
    }

    // Finally delete the base
    const { error: baseDeleteError } = await supabase.from('bases').delete().eq('id', baseId);
    if (baseDeleteError) throw baseDeleteError;
  }

  // Table operations
  static async getTables(baseId: string): Promise<TableRow[]> {
    const { data, error } = await supabase
      .from("tables")
      .select("id, base_id, name, order_index, is_master_list")
      .eq("base_id", baseId)
      .order("order_index");

    if (error) throw error;
    return (data ?? []) as TableRow[];
  }

  static async createTable(tableData: CreateTableData): Promise<TableRow> {
    const { data, error } = await supabase
      .from("tables")
      .insert(tableData)
      .select("id, base_id, name, order_index, is_master_list")
      .single();

    if (error) throw error;
    return data as TableRow;
  }

  static async updateTable(tableId: string, updates: Partial<TableRow>): Promise<void> {
    const { error } = await supabase
      .from("tables")
      .update(updates)
      .eq("id", tableId);

    if (error) throw error;
  }

  static async deleteTable(tableId: string): Promise<void> {
    // First delete records and fields to avoid FK violations
    const { error: recordsError } = await supabase
      .from("records")
      .delete()
      .eq("table_id", tableId);
    if (recordsError) {
      console.error('Failed to delete records for table', tableId, recordsError);
      throw recordsError;
    }

    const { error: fieldsError } = await supabase
      .from("fields")
      .delete()
      .eq("table_id", tableId);
    if (fieldsError) {
      console.error('Failed to delete fields for table', tableId, fieldsError);
      throw fieldsError;
    }

    const { error } = await supabase
      .from("tables")
      .delete()
      .eq("id", tableId);

    if (error) {
      console.error('Failed to delete table', tableId, error);
      throw error;
    }
  }

  // Field operations
  static async getFields(tableId: string): Promise<FieldRow[]> {
    const { data, error } = await supabase
      .from("fields")
      .select("id, table_id, name, type, order_index, options")
      .eq("table_id", tableId)
      .order("order_index");

    if (error) throw error;
    return (data ?? []) as FieldRow[];
  }

  // Map select/multi-select values between fields by display name/label
  private static mapSelectValueBetweenFields(
    value: unknown,
    sourceField?: { type?: string | null; options?: Record<string, any> | null },
    targetField?: { type?: string | null; options?: Record<string, any> | null }
  ): unknown {
    if (!sourceField || !targetField) return value;

    const sourceOptions = (sourceField.options || {}) as Record<string, { name?: string; label?: string }>;
    const targetOptions = (targetField.options || {}) as Record<string, { name?: string; label?: string }>;

    const resolveName = (val: unknown): string | null => {
      if (typeof val === 'string' && val.startsWith('option_')) {
        const opt = sourceOptions[val];
        return opt?.name || opt?.label || null;
      }
      if (typeof val === 'string') return val;
      return null;
    };

    const findTargetKeyByName = (name: string | null): string | null => {
      if (!name) return null;
      const match = Object.entries(targetOptions).find(([, opt]) => (opt?.name || opt?.label) === name);
      return match ? match[0] : null;
    };

    // Single select
    if (sourceField.type === 'single_select' && targetField.type === 'single_select') {
      const display = resolveName(value);
      const targetKey = findTargetKeyByName(display);
      return targetKey ?? value;
    }

    // Multi select
    if (sourceField.type === 'multi_select' && targetField.type === 'multi_select' && Array.isArray(value)) {
      const mapped = value
        .map((v) => {
          const display = resolveName(v);
          return findTargetKeyByName(display) ?? v;
        })
        .filter((v) => v !== undefined && v !== null);
      return mapped;
    }

    return value;
  }

  // Remove non-masterlist copies of a master record when moving it elsewhere
  private static async removeExistingCopiesForMasterRecord(
    baseId: string,
    masterRecordId: string,
    excludeTableIds: string[]
  ): Promise<void> {
    try {
      const tables = await this.getTables(baseId);
      const tablesToClean = tables.filter(
        (t) => !t.is_master_list && !excludeTableIds.includes(t.id)
      );

      for (const table of tablesToClean) {
        // Delete copies linked by _source_record_id
        const { error } = await supabase
          .from("records")
          .delete()
          .eq("table_id", table.id)
          .eq("values->>_source_record_id", masterRecordId);

        if (error) {
          console.error('Failed to remove copy from table', table.id, error);
        }
        // Also delete legacy copies where id matches masterRecordId
        const { error: deleteByIdError } = await supabase
          .from("records")
          .delete()
          .eq("table_id", table.id)
          .eq("id", masterRecordId);
        if (deleteByIdError) {
          console.error('Failed to remove legacy copy by id from table', table.id, deleteByIdError);
        }

        // Guardrail: keep only one copy per table for this masterRecordId even in excluded tables
        const { data: dupes, error: fetchDupesError } = await supabase
          .from("records")
          .select("id")
          .eq("table_id", table.id)
          .eq("values->>_source_record_id", masterRecordId);
        if (!fetchDupesError && dupes && dupes.length > 1) {
          const keepId = dupes[0].id;
          const extraIds = dupes.slice(1).map((r) => r.id);
          const { error: pruneError } = await supabase
            .from("records")
            .delete()
            .eq("table_id", table.id)
            .in("id", extraIds);
          if (pruneError) {
            console.error('Failed to prune duplicate copies for master record', masterRecordId, 'table', table.id, pruneError);
          } else {
            console.log('Pruned duplicate copies, kept', keepId, 'deleted', extraIds);
          }
        }
      }
    } catch (err) {
      console.error('Failed to clean up existing copies for master record', err);
    }
  }

  // Ensure only a single copy per table/_source_record_id combination
  private static async pruneDuplicateCopies(
    tableId: string,
    masterRecordId: string
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("records")
        .select("id")
        .eq("table_id", tableId)
        .eq("values->>_source_record_id", masterRecordId);

      if (error || !data || data.length <= 1) {
        return;
      }

      const keepId = data[0].id;
      const extras = data.slice(1).map((r) => r.id);
      const { error: deleteError } = await supabase
        .from("records")
        .delete()
        .eq("table_id", tableId)
        .in("id", extras);
      if (deleteError) {
        console.error('Failed to prune duplicate copies for master record', masterRecordId, 'table', tableId, deleteError);
      } else {
        console.log('Pruned duplicate copies for table', tableId, 'kept', keepId, 'deleted', extras);
      }
    } catch (err) {
      console.error('Failed to prune duplicate copies for master record', masterRecordId, 'table', tableId, err);
    }
  }

  static async getAllFields(baseId: string): Promise<FieldRow[]> {
    const { data, error } = await supabase
      .from("fields")
      .select(`
        id, table_id, name, type, order_index, options,
        tables!inner(base_id)
      `)
      .eq("tables.base_id", baseId)
      .order("order_index");

    if (error) throw error;
    return (data ?? []) as FieldRow[];
  }

  static async createField(fieldData: CreateFieldData): Promise<FieldRow> {
    console.log('Creating field with data:', JSON.stringify(fieldData, null, 2));
    console.log('Field type:', fieldData.type, 'Type of type:', typeof fieldData.type);
    
    // Check table metadata (masterlist tables are now allowed but we log for clarity)
    const { data: tableData, error: tableCheckError } = await supabase
      .from("tables")
      .select("is_master_list, name")
      .eq("id", fieldData.table_id)
      .single();
    
    if (tableCheckError) {
      throw new Error(`Failed to verify table: ${tableCheckError.message}`);
    }
    
    if (tableData?.is_master_list) {
      console.log('ℹ️ Creating field directly in masterlist table:', tableData.name);
    }
    
    // Validate and sanitize field type
    const allowedTypes = ['text', 'number', 'date', 'datetime', 'email', 'phone', 'single_select', 'multi_select', 'checkbox', 'link'];

    // Sanitize the field type - remove any whitespace and ensure it's lowercase
    const sanitizedType = fieldData.type.trim().toLowerCase();

    if (!allowedTypes.includes(sanitizedType)) {
      throw new Error(`Invalid field type: "${fieldData.type}" (sanitized: "${sanitizedType}"). Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Create a sanitized version of the field data
    const sanitizedFieldData = {
      ...fieldData,
      type: sanitizedType
    };

    console.log('Sanitized field data:', JSON.stringify(sanitizedFieldData, null, 2));
    console.log('Creating field in table:', tableData.name, 'table_id:', fieldData.table_id);
    
    const { data, error } = await supabase
      .from("fields")
      .insert(sanitizedFieldData)
      .select("id, table_id, name, type, order_index, options")
      .single();

    if (error) {
      console.error('Field creation error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      throw error;
    }
    
    console.log('✅ Field created successfully in table:', tableData.name);
    return data as FieldRow;
  }

  static async updateField(fieldId: string, updates: Partial<FieldRow>): Promise<void> {
    // Get field and table context
    const { data: fieldMeta, error: fetchFieldError } = await supabase
      .from("fields")
      .select("id, name, type, options, table_id")
      .eq("id", fieldId)
      .single();

    if (fetchFieldError || !fieldMeta) {
      throw fetchFieldError || new Error('Field not found');
    }

    const { data: tableMeta, error: fetchTableError } = await supabase
      .from("tables")
      .select("base_id, is_master_list")
      .eq("id", fieldMeta.table_id)
      .single();

    if (fetchTableError || !tableMeta) {
      throw fetchTableError || new Error('Table not found for field');
    }

    const { error } = await supabase
      .from("fields")
      .update(updates)
      .eq("id", fieldId);

    if (error) throw error;

    // If masterlist select options changed, propagate to same-name select fields in other tables in the base
    const isSelectField = fieldMeta.type === 'single_select' || fieldMeta.type === 'multi_select';
    if (tableMeta.is_master_list && isSelectField && updates.options) {
      try {
        const { data: peerTables } = await supabase
          .from("tables")
          .select("id")
          .eq("base_id", tableMeta.base_id)
          .eq("is_master_list", false);

        const peerTableIds = (peerTables ?? []).map(t => t.id);
        if (peerTableIds.length === 0) {
          return;
        }

        const { data: siblingFields } = await supabase
          .from("fields")
          .select("id")
          .eq("name", fieldMeta.name)
          .eq("type", fieldMeta.type)
          .in("table_id", peerTableIds);

        const siblingIds = (siblingFields ?? []).map(f => f.id);
        if (siblingIds.length === 0) {
          return;
        }

        const { error: propagateError } = await supabase
          .from("fields")
          .update({ options: updates.options })
          .in("id", siblingIds);

        if (propagateError) {
          console.error('Failed to propagate select options to sibling fields', propagateError);
        } else {
          console.log('Propagated select options to sibling fields', siblingIds);
        }
      } catch (propErr) {
        console.error('Failed to sync select options from masterlist to other tables', propErr);
      }
    }
  }

  static async deleteField(fieldId: string): Promise<void> {
    const { error } = await supabase
      .from("fields")
      .delete()
      .eq("id", fieldId);

    if (error) throw error;
  }

  static async deleteAllFields(tableId: string): Promise<void> {
    const { error } = await supabase
      .from("fields")
      .delete()
      .eq("table_id", tableId);

    if (error) throw error;
  }

  // Record operations
  static async getRecords(tableId: string): Promise<RecordRow[]> {
    const { data, error } = await supabase
      .from("records")
      .select("id, table_id, values, created_at")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as RecordRow[];
  }

  static async getAllRecordsFromBase(baseId: string): Promise<RecordRow[]> {
    const { data, error } = await supabase
      .from("records")
      .select(`
        id, 
        table_id, 
        values, 
        created_at,
        tables!inner(base_id)
      `)
      .eq("tables.base_id", baseId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as RecordRow[];
  }

  static async createRecord(tableId: string, values: Record<string, unknown> = {}): Promise<RecordRow> {
    // Get base_id and check if this is masterlist
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("base_id, is_master_list")
      .eq("id", tableId)
      .single();

    if (tableError) throw tableError;

    const { data, error } = await supabase
      .from("records")
      .insert({ table_id: tableId, values })
      .select("id, table_id, values, created_at")
      .single();

    if (error) throw error;

    const masterRecordId = data.id;

    // Immediately stamp a canonical pointer on non-master records so automations have a stable source id
    if (!table.is_master_list && !(values as Record<string, unknown>)._source_record_id) {
      const stampedValues = { ...values, _source_record_id: masterRecordId };
      const { error: stampError } = await supabase
        .from("records")
        .update({ values: stampedValues })
        .eq("id", masterRecordId)
        .eq("table_id", tableId);
      if (stampError) {
        console.error('Failed to stamp _source_record_id on new record', stampError);
      } else {
        data.values = stampedValues;
      }
    }

    // If not creating in masterlist, ensure record also exists in masterlist
    // BUT: Only include values for fields that actually exist in the masterlist
    // This prevents creating records with field IDs from other tables
    if (!table.is_master_list) {
      try {
        // Get masterlist table
        const { data: masterlistTable, error: masterlistError } = await supabase
          .from("tables")
          .select("id")
          .eq("base_id", table.base_id)
          .eq("is_master_list", true)
          .single();

        if (!masterlistError && masterlistTable) {
          // Get masterlist fields to filter values
          const masterlistFields = await this.getFields(masterlistTable.id);
          const masterlistFieldIds = new Set(masterlistFields.map(f => f.id));

          // Filter values to only include fields that exist in masterlist
          const masterlistValues: Record<string, unknown> = {};
          for (const [fieldId, value] of Object.entries(values)) {
            if (masterlistFieldIds.has(fieldId)) {
              masterlistValues[fieldId] = value;
            }
          }

          // Always create/upsert canonical masterlist record using the same id as the source record
          const canonicalValues = { ...masterlistValues, _source_record_id: masterRecordId };
          const { error: createMasterError } = await supabase
            .from("records")
            .insert({ id: masterRecordId, table_id: masterlistTable.id, values: canonicalValues });

          if (createMasterError) {
            if (createMasterError.code === '23505') {
              const { error: updateMasterError } = await supabase
                .from("records")
                .update({ values: canonicalValues })
                .eq("id", masterRecordId)
                .eq("table_id", masterlistTable.id);
              if (updateMasterError) {
                console.error('Failed to update existing masterlist record', updateMasterError);
              }
            } else {
              console.error('Failed to create masterlist record', createMasterError);
            }
          } else {
            console.log('dY"< Record also created in masterlist with filtered field values');
          }
        }
      } catch (masterlistError) {
        console.error('Failed to create record in masterlist:', masterlistError);
        // Don't throw - the main record was created successfully
      }
    }

    // Check and execute automations for new record
    try {
      await this.checkAndExecuteAutomations(tableId, masterRecordId, data.values ?? values);
    } catch (automationError) {
      console.error('Automation execution failed for new record:', automationError);
      // Don't throw here as the record creation was successful
    }

    return data as RecordRow;
  }

  static async updateRecord(recordId: string, values: Record<string, unknown>): Promise<void> {
    // Get table_id for automation checks
    const { data: record, error: fetchError } = await supabase
      .from("records")
      .select("table_id")
      .eq("id", recordId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from("records")
      .update({ values })
      .eq("id", recordId);

    if (error) throw error;

    // Check and execute automations after record update
    try {
      await this.checkAndExecuteAutomations(record.table_id, recordId, values);
    } catch (automationError) {
      console.error('Automation execution failed for record update:', automationError);
      // Don't throw here as the record update was successful
    }
  }

  static async deleteRecord(recordId: string): Promise<void> {
    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", recordId);

    if (error) throw error;
  }

  static async updateCell(recordId: string, fieldId: string, value: unknown): Promise<void> {
    console.log(`🔄 CELL UPDATE: Updating cell for record ${recordId}, field ${fieldId}, value:`, value);

    // Get current record values
    const { data: record, error: fetchError } = await supabase
      .from("records")
      .select("values, table_id")
      .eq("id", recordId)
      .single();

    if (fetchError) throw fetchError;

    // Get table info to check if it's masterlist and get base_id
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("base_id, is_master_list")
      .eq("id", record.table_id)
      .single();

    if (tableError) throw tableError;

    const isMasterlist = table.is_master_list;
    const baseId = table.base_id;

    // Determine canonical master record id (for copies, use _source_record_id)
    const sourceMasterRecordId =
      typeof record.values?._source_record_id === 'string' && record.values._source_record_id
        ? record.values._source_record_id
        : recordId;

    // Field name (used for propagation)
    let masterFieldName: string | null = null;
    if (baseId) {
      const { data: fieldMeta } = await supabase
        .from("fields")
        .select("name")
        .eq("id", fieldId)
        .maybeSingle();
      masterFieldName = fieldMeta?.name || null;
    }

    // Update the specific field value
    const updatedValues = {
      ...record.values,
      [fieldId]: value
    };

    // Ensure non-masterlist records always keep a pointer to their master record
    if (!isMasterlist && !updatedValues._source_record_id) {
      updatedValues._source_record_id = sourceMasterRecordId;
    }

    const canonicalMasterRecordId =
      typeof updatedValues._source_record_id === 'string' && updatedValues._source_record_id
        ? updatedValues._source_record_id
        : sourceMasterRecordId;

    console.log(`📝 UPDATED VALUES:`, updatedValues);

    // Save back to database
    const { error: updateError } = await supabase
      .from("records")
      .update({ values: updatedValues })
      .eq("id", recordId);

    if (updateError) throw updateError;

    console.log(`✅ CELL SAVED: Cell update successful`);

    let masterlistTableId: string | null = null;
    let mergedMasterlistValues: Record<string, unknown> | null = null;
    let masterlistChangedFieldId: string | null = null;
    let masterlistChangedValue: unknown = undefined;

    // If updating a non-masterlist table, also sync to masterlist
    if (!isMasterlist && baseId) {
      try {
        // Get masterlist table
        const { data: masterlistTable, error: masterlistError } = await supabase
          .from("tables")
          .select("id")
          .eq("base_id", baseId)
          .eq("is_master_list", true)
          .single();

        if (!masterlistError && masterlistTable) {
          masterlistTableId = masterlistTable.id;
          // Get the field that was updated to find its name and options
          const { data: updatedField, error: fieldError } = await supabase
            .from("fields")
            .select("id, name, type, options")
            .eq("id", fieldId)
            .single();

          if (!fieldError && updatedField) {
            // Find the corresponding field in masterlist with the same name
            const { data: masterlistFields, error: masterlistFieldsError } = await supabase
              .from("fields")
              .select("id, name, type, options")
              .eq("table_id", masterlistTable.id)
              .eq("name", updatedField.name)
              .limit(1);

            if (!masterlistFieldsError && masterlistFields.length > 0) {
              const masterlistFieldMeta = masterlistFields[0];
              const masterlistFieldId = masterlistFieldMeta.id;
              masterlistChangedFieldId = masterlistFieldId;
              
              // Get or create masterlist record
          const { data: masterlistRecord, error: masterlistRecordError } = await supabase
            .from("records")
            .select("values")
            .eq("id", canonicalMasterRecordId)
            .eq("table_id", masterlistTable.id)
            .maybeSingle();

              if (masterlistRecordError && masterlistRecordError.code !== 'PGRST116') {
                console.error('❌ Error checking masterlist record:', masterlistRecordError);
              } else {
                const masterlistValues = masterlistRecord?.values || {};
                const mappedValue = this.mapSelectValueBetweenFields(
                  value,
                  updatedField,
                  masterlistFieldMeta
                );
                masterlistChangedValue = mappedValue;
                const updatedMasterlistValues = {
                  ...masterlistValues,
                  [masterlistFieldId]: mappedValue
                };

                // Update or create masterlist record (always check first, then update or create)
                // Get current masterlist record values to merge
                const { data: currentMasterlistRecord, error: masterlistCheckError } = await supabase
                  .from("records")
                  .select("values")
                  .eq("id", canonicalMasterRecordId)
                  .eq("table_id", masterlistTable.id)
                  .maybeSingle();

                if (masterlistCheckError && masterlistCheckError.code !== 'PGRST116') {
                  console.error('❌ Error checking masterlist record:', masterlistCheckError);
                } else {
                  // Merge with existing masterlist values to preserve other fields
                  mergedMasterlistValues = {
                    ...(currentMasterlistRecord?.values || {}),
                    ...updatedMasterlistValues  // Override with new value
                  };

                  if (currentMasterlistRecord) {
                    // Update existing masterlist record
                    const { error: updateMasterlistError } = await supabase
                      .from("records")
                      .update({ values: mergedMasterlistValues })
                      .eq("id", canonicalMasterRecordId)
                      .eq("table_id", masterlistTable.id);

                    if (updateMasterlistError) {
                      console.error('❌ Failed to update masterlist record:', updateMasterlistError);
                    } else {
                      console.log('✅ Masterlist record updated with new value');
                    }
                  } else {
                    // Create masterlist record if it doesn't exist (merge with current record values)
                    const allRecordValues = {
                      ...record.values,  // Start with all current record values
                      ...updatedMasterlistValues,  // Override with the updated value
                      _source_record_id: canonicalMasterRecordId
                    };

                    const { error: createMasterlistError } = await supabase
                      .from("records")
                      .insert({
                        id: canonicalMasterRecordId,
                        table_id: masterlistTable.id,
                        values: allRecordValues
                      });

                    if (createMasterlistError) {
                      // If conflict occurs (record was created in the meantime), update instead
                      if (createMasterlistError.code === '23505') {
                        console.log('⚠️ Masterlist record conflict during create, updating instead');
                        const { error: updateError } = await supabase
                          .from("records")
                          .update({ values: allRecordValues })
                          .eq("id", canonicalMasterRecordId)
                          .eq("table_id", masterlistTable.id);
                        
                        if (updateError) {
                          console.error('❌ Failed to update masterlist record after conflict:', updateError);
                        } else {
                          console.log('✅ Masterlist record updated (after conflict)');
                        }
                      } else {
                        console.error('❌ Failed to create masterlist record:', createMasterlistError);
                      }
                    } else {
                      console.log('✅ Masterlist record created with updated value');
                    }
                  }
                }
              }
            }
          }
        }
      } catch (syncError) {
        console.error('❌ Failed to sync to masterlist:', syncError);
        // Don't throw - the main update was successful
      }
    }

    // If updating masterlist, propagate value to active non-masterlist copies (match by field name)
    if (isMasterlist && baseId && masterFieldName) {
      try {
        const { data: masterFieldMeta } = await supabase
          .from("fields")
          .select("id, name, type, options")
          .eq("id", fieldId)
          .maybeSingle();

        const { data: copies } = await supabase
          .from("records")
          .select("id, table_id, values")
          .eq("values->>_source_record_id", recordId);

        if (copies && copies.length > 0) {
          for (const copy of copies) {
            const { data: targetField } = await supabase
              .from("fields")
              .select("id, name, type, options")
              .eq("table_id", copy.table_id)
              .eq("name", masterFieldName)
              .maybeSingle();
            if (!targetField?.id) continue;

            const newCopyValues = {
              ...(copy.values || {}),
              [targetField.id]: this.mapSelectValueBetweenFields(value, masterFieldMeta || undefined, targetField),
              _source_record_id: recordId
            };
            await supabase
              .from("records")
              .update({ values: newCopyValues })
              .eq("id", copy.id)
              .eq("table_id", copy.table_id);
          }
        }
      } catch (propError) {
        console.error('Failed to propagate masterlist change to copies:', propError);
      }
    }

    // Check and execute automations after successful cell update
    // Pass only the changed field in newValues for filtering, but pass full updatedValues for condition checking
    try {
      const changedFieldValues = { [fieldId]: value };
      const masterlistChangedFieldValues = masterlistChangedFieldId
        ? { [masterlistChangedFieldId]: masterlistChangedValue, [fieldId]: value }
        : changedFieldValues;
      await this.checkAndExecuteAutomations(record.table_id, recordId, changedFieldValues, updatedValues);
      if (!isMasterlist && masterlistTableId && mergedMasterlistValues) {
        await this.checkAndExecuteAutomations(masterlistTableId, canonicalMasterRecordId, masterlistChangedFieldValues, mergedMasterlistValues);
      }
    } catch (automationError) {
      console.error('❌ AUTOMATION EXECUTION FAILED:', automationError);
      // Don't throw here as the cell update was successful
    }
  }

  // CSV Import operations
  static async importCsvData(
    tableId: string,
    csvText: string,
    fieldMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }>
  ): Promise<{ imported: number; errors: string[] }> {
    // Parse CSV into lines while respecting quoted fields that may contain newlines
    const parseCSVLines = (text: string): string[] => {
      const lines: string[] = [];
      let currentLine = '';
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          currentLine += char;
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            currentLine += nextChar;
            i++;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
          // End of line (not inside quotes)
          if (currentLine.trim()) {
            lines.push(currentLine);
          }
          currentLine = '';
          if (char === '\r' && nextChar === '\n') {
            i++; // Skip the \n after \r
          }
        } else if (char !== '\r') {
          // Add character (skip standalone \r)
          currentLine += char;
        }
      }

      // Add the last line if it exists
      if (currentLine.trim()) {
        lines.push(currentLine);
      }

      return lines;
    };

    const lines = parseCSVLines(csvText);

    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    // Parse CSV properly to handle quoted fields with commas and escaped quotes
    const parseCsvRow = (row: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const nextChar = row[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote - add one quote and skip the next
            current += '"';
            i++;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      // Add the last field
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvRow(lines[0]);
    const dataRows = lines.slice(1);

    console.log('CSV Headers:', headers);
    console.log('CSV Data Rows:', dataRows);
    console.log('Field Mappings:', fieldMappings);
    console.log('Field Mappings Keys:', Object.keys(fieldMappings));
    console.log('Field Mappings Count:', Object.keys(fieldMappings).length);

    const recordsToCreate: Array<{ table_id: string; values: Record<string, unknown> }> = [];
    const errors: string[] = [];

    // Check if table is masterlist
    const { data: tableData, error: tableCheckError } = await supabase
      .from("tables")
      .select("is_master_list, base_id")
      .eq("id", tableId)
      .single();
    
    if (tableCheckError) {
      throw new Error(`Failed to verify table: ${tableCheckError.message}`);
    }
    
    const isMasterlist = tableData?.is_master_list || false;
    const baseId = tableData?.base_id;
    
    if (!baseId) {
      throw new Error('Table does not have a base_id');
    }

    // Get existing fields and their types
    const fields = await this.getFields(tableId);
    
    // If importing to masterlist, get all fields from the base to find existing fields by name
    let allBaseFields: FieldRow[] = [];
    const fieldNameToIdMap = new Map<string, string>();
    let masterlistTableId: string | null = null;
    
    if (isMasterlist) {
      console.log('📋 Importing to masterlist - will map to existing fields by name across the base');
      const tablesMeta = await this.getTables(baseId);
      masterlistTableId = tablesMeta.find(t => t.is_master_list)?.id ?? tableId;
      allBaseFields = await this.getAllFields(baseId);

      // Prefer masterlist fields first, then stable by order_index/name to avoid shuffling
      const sortedAllBaseFields = [...allBaseFields].sort((a, b) => {
        const aPriority = a.table_id === masterlistTableId ? 0 : 1;
        const bPriority = b.table_id === masterlistTableId ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aOrder = typeof a.order_index === 'number' ? a.order_index : 0;
        const bOrder = typeof b.order_index === 'number' ? b.order_index : 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
      allBaseFields = sortedAllBaseFields;

      // Create a map of field name -> field ID (use first match if duplicate names exist)
      for (const field of allBaseFields) {
        if (!fieldNameToIdMap.has(field.name)) {
          fieldNameToIdMap.set(field.name, field.id);
        }
      }
      console.log(`📋 Found ${allBaseFields.length} fields across the base (${fieldNameToIdMap.size} unique names). Masterlist table: ${masterlistTableId}`);
    }
    
    // Build fieldTypeMap - use allBaseFields if importing to masterlist, otherwise use fields from the table
    // This ensures fieldTypeMap includes all fields that might be referenced in mappings
    const fieldsForTypeMap = isMasterlist ? allBaseFields : fields;
    const fieldTypeMap = new Map(fieldsForTypeMap.map(f => [f.id, f.type]));
    const fieldById = new Map<string, FieldRow>();
    fieldsForTypeMap.forEach(f => fieldById.set(f.id, f));
    const masterlistFieldNameMap = new Map<string, string>();
    if (isMasterlist && masterlistTableId) {
      for (const f of allBaseFields) {
        if (f.table_id === masterlistTableId && !masterlistFieldNameMap.has(f.name)) {
          masterlistFieldNameMap.set(f.name, f.id);
        }
      }
    }
    console.log(`📋 Built fieldTypeMap with ${fieldTypeMap.size} fields (isMasterlist: ${isMasterlist})`);
    
    // Create new fields for mappings that specify field creation
    const fieldsToCreate = new Map<string, { fieldType: string, fieldName: string, options?: Record<string, unknown> }>();
    const createdFieldIds = new Map<string, string>();

    // Collect unique values for single_select fields
    const singleSelectOptions = new Map<string, Set<string>>();

    // First pass: analyze all columns to detect select fields
    const columnAnalysis = new Map<string, { uniqueValues: Set<string>, totalRows: number }>();

    for (const [csvColumn, mapping] of Object.entries(fieldMappings)) {
      if (typeof mapping === 'object' && mapping.type === 'create') {
        const columnIndex = headers.findIndex(h => h === csvColumn);
        if (columnIndex !== -1) {
          const uniqueValues = new Set<string>();
          let totalRows = 0;

          // Analyze all data rows for this column
          for (const row of dataRows) {
            const parsedRow = parseCsvRow(row);
            if (parsedRow[columnIndex]) {
              let value = parsedRow[columnIndex].trim();
              // Remove surrounding quotes if present
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
              }
              // Unescape double quotes
              value = value.replace(/""/g, '"');

              if (value && value !== '(empty)') {
                uniqueValues.add(value);
                totalRows++;
              }
            }
          }

          columnAnalysis.set(csvColumn, { uniqueValues, totalRows });
        }
      }
    }

    // Second pass: determine field types and create select options
    for (const [csvColumn, mapping] of Object.entries(fieldMappings)) {
      if (typeof mapping === 'object' && mapping.type === 'create') {
        const analysis = columnAnalysis.get(csvColumn);

        if (analysis) {
          const { uniqueValues, totalRows } = analysis;
          const uniqueCount = uniqueValues.size;

          // Smart detection for select fields
          // Updated threshold: only detect as select if 5 or fewer unique values
          if (mapping.fieldType === 'text' && uniqueCount >= 2 && uniqueCount <= 5 && totalRows >= 2) {
            const valuesArray = Array.from(uniqueValues);

            // Criteria for detecting select fields:
            // 1. Limited number of unique values (2-5 values)
            // 2. Values are not purely numeric (to avoid confusing with number fields)
            // 3. Values don't look like emails, dates, or phone numbers
            // 4. Values are reasonable length (not too long)
            const isNotNumeric = valuesArray.some(v => isNaN(Number(v)) || v.trim() === '');
            const isNotEmail = valuesArray.every(v => !v.includes('@') || !v.includes('.'));
            const isNotDate = valuesArray.every(v =>
              !/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v) &&
              !/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(v)
            );
            const isNotPhone = valuesArray.every(v => !/^[\+]?[\d\s\-\(\)]+$/.test(v));
            const reasonableLength = valuesArray.every(v => v.length <= 50);

            if (isNotNumeric && isNotEmail && isNotDate && isNotPhone && reasonableLength) {
              console.log(`🎯 SELECT FIELD DETECTED: ${mapping.fieldName} with ${uniqueCount} unique values:`, valuesArray);

              // Upgrade field type to single_select
              mapping.fieldType = 'single_select';

              // Create options object for the field
              const options: Record<string, { name: string; color: string }> = {};
              Array.from(uniqueValues).forEach((value, index) => {
                const optionId = `option_${index + 1}`;
                options[optionId] = {
                  name: value,
                  color: getRandomColor() // Generate a random color for each option
                };
              });

              fieldsToCreate.set(csvColumn, {
                fieldType: 'single_select',
                fieldName: mapping.fieldName,
                options
              });

              singleSelectOptions.set(csvColumn, uniqueValues);
              continue; // Skip the normal field creation below
            }
          }

          // Handle single_select fields that were already detected
          if (mapping.fieldType === 'single_select') {
            // Create options object for the field
            const options: Record<string, { name: string; color: string }> = {};
            Array.from(uniqueValues).forEach((value, index) => {
              const optionId = `option_${index + 1}`;
              options[optionId] = {
                name: value,
                color: getRandomColor() // Generate a random color for each option
              };
            });

            fieldsToCreate.set(csvColumn, {
              fieldType: mapping.fieldType,
              fieldName: mapping.fieldName,
              options
            });

            singleSelectOptions.set(csvColumn, uniqueValues);
          } else {
            fieldsToCreate.set(csvColumn, { fieldType: mapping.fieldType, fieldName: mapping.fieldName });
          }
        } else {
          fieldsToCreate.set(csvColumn, { fieldType: mapping.fieldType, fieldName: mapping.fieldName });
        }
      }
    }

    // NEW STEP: Analyze existing single_select fields for new options
    console.log('🔍 Analyzing existing single_select fields for new options...');
    const existingSingleSelectUpdates = new Map<string, { field: FieldRow, newOptions: Record<string, { name: string; color: string }> }>();

    for (const [csvColumn, mapping] of Object.entries(fieldMappings)) {
      // Check if mapping is to an existing field ID
      if (typeof mapping === 'string') {
        const fieldId = mapping;
        const field = fields.find(f => f.id === fieldId);

        if (field && field.type === 'single_select') {
          console.log(`  Checking field "${field.name}" (${field.id}) mapped to column "${csvColumn}"`);

          const columnIndex = headers.findIndex(h => h === csvColumn);
          if (columnIndex !== -1) {
            const uniqueValues = new Set<string>();

            // Collect all unique values from the CSV for this column
            for (const row of dataRows) {
              const parsedRow = parseCsvRow(row);
              if (parsedRow[columnIndex]) {
                let value = parsedRow[columnIndex].trim();
                // Remove surrounding quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                  value = value.slice(1, -1);
                }
                // Unescape double quotes
                value = value.replace(/""/g, '"');

                if (value && value !== '(empty)') {
                  uniqueValues.add(value);
                }
              }
            }

            // Check which values are missing from current options
            const currentOptions = field.options as Record<string, { name: string; color: string }> || {};
            const newOptionsToAdd: Record<string, { name: string; color: string }> = {};
            let nextOptionIndex = Object.keys(currentOptions).length + 1;

            for (const value of uniqueValues) {
              // Check for exact match
              const exactMatch = Object.values(currentOptions).some(opt => opt && opt.name === value);

              // Check for case-insensitive match
              const caseInsensitiveMatch = Object.values(currentOptions).some(opt => opt && opt.name && opt.name.toLowerCase() === value.toLowerCase());

              if (!exactMatch && !caseInsensitiveMatch) {
                console.log(`    Found new option value: "${value}"`);
                const optionId = `option_${nextOptionIndex++}`;
                newOptionsToAdd[optionId] = {
                  name: value,
                  color: getRandomColor()
                };
              }
            }

            if (Object.keys(newOptionsToAdd).length > 0) {
              console.log(`    Adding ${Object.keys(newOptionsToAdd).length} new options to field "${field.name}"`);
              existingSingleSelectUpdates.set(fieldId, { field, newOptions: newOptionsToAdd });
            }
          }
        }
      }
    }

    // Apply updates to existing single_select fields
    for (const [fieldId, update] of existingSingleSelectUpdates) {
      try {
        const updatedOptions = {
          ...(update.field.options as Record<string, unknown> || {}),
          ...update.newOptions
        };

        await this.updateField(fieldId, { options: updatedOptions });

        // Update local field object so subsequent processing uses new options
        const fieldIndex = fields.findIndex(f => f.id === fieldId);
        if (fieldIndex !== -1) {
          fields[fieldIndex].options = updatedOptions;
        }

        console.log(`✅ Updated field "${update.field.name}" with new options`);
      } catch (error) {
        console.error(`❌ Failed to update field "${update.field.name}":`, error);
        errors.push(`Failed to add new options to field "${update.field.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Create all new fields
    console.log('🔧 CREATING FIELDS:', fieldsToCreate.size, 'fields to create');
    console.log('🔧 PROCESSING FIELDS:', fieldsToCreate.size, 'fields to process');
    console.log('🔧 Is masterlist?', isMasterlist);
    console.log('🔧 Total fieldMappings with type \"create\":', Object.entries(fieldMappings).filter(([, m]) => typeof m === 'object' && m.type === 'create').length);
    console.log('🔧 Fields to create:', Array.from(fieldsToCreate.entries()).map(([col, config]) => `${col} -> ${config.fieldName}`));
    
    if (fieldsToCreate.size === 0) {
      console.warn('⚠️ WARNING: fieldsToCreate is empty! This means no fields were added to the map. Check fieldMappings.');
      console.log('📋 Field mappings sample:', Object.entries(fieldMappings).slice(0, 3).map(([k, v]) => ({ key: k, value: v })));
    }
    
    if (isMasterlist) {
      // For masterlist, map to existing fields by name and create missing ones directly on the masterlist table
      const targetTableIdForNewFields = masterlistTableId ?? tableId;
      const masterlistFields = allBaseFields.filter(f => f.table_id === targetTableIdForNewFields);
      console.log('Masterlist import: mapping/creating directly on masterlist table', { targetTableIdForNewFields, existingMasterlistFields: masterlistFields.length });
      
      // Process fields sequentially to ensure proper tracking
      console.log(`Starting field processing loop with ${fieldsToCreate.size} fields`);
      let processedCount = 0;
      
      for (const [csvColumn, fieldConfig] of fieldsToCreate) {
        processedCount++;
        console.log(`[${processedCount}/${fieldsToCreate.size}] Processing field: "${fieldConfig.fieldName}" for column: "${csvColumn}"`);
        const existingFieldId = fieldNameToIdMap.get(fieldConfig.fieldName);
        
        if (existingFieldId) {
          const existingField = allBaseFields.find(f => f.id === existingFieldId);
          if (existingField) {
            console.log(`Using existing field "${fieldConfig.fieldName}": ${existingFieldId}`);
            createdFieldIds.set(csvColumn, existingFieldId);
            fieldTypeMap.set(existingFieldId, existingField.type);
            
            if (!fields.find(f => f.id === existingFieldId)) {
              fields.push(existingField);
            }
          } else {
            console.warn(`Found field ID ${existingFieldId} for "${fieldConfig.fieldName}" but field not found in allBaseFields`);
            errors.push(`Field "${fieldConfig.fieldName}" exists but could not be accessed`);
          }
        } else {
          try {
            console.log(`Creating field "${fieldConfig.fieldName}" (type: ${fieldConfig.fieldType}) in masterlist`);
            
            // Get fields in target table to determine order_index
            const targetTableFields = await this.getFields(targetTableIdForNewFields);
            
            const newField = await this.createField({
              name: fieldConfig.fieldName,
              type: fieldConfig.fieldType as FieldType,
              table_id: targetTableIdForNewFields,
              order_index: targetTableFields.length,
              options: fieldConfig.options
            });
            
            console.log(`Field created in masterlist: "${fieldConfig.fieldName}" (${newField.id})`);
            
            createdFieldIds.set(csvColumn, newField.id);
            fieldTypeMap.set(newField.id, newField.type);
            fieldById.set(newField.id, newField);
            
            const verifyId = createdFieldIds.get(csvColumn);
            if (!verifyId || verifyId !== newField.id) {
              console.error(`Field ID not set correctly for "${csvColumn}": expected ${newField.id}, got ${verifyId || 'undefined'}`);
            } else {
              console.log(`Verified: createdFieldIds["${csvColumn}"] = ${verifyId}`);
            }
            
            allBaseFields.push(newField);
            fieldNameToIdMap.set(fieldConfig.fieldName, newField.id);
            
            if (!fields.find(f => f.id === newField.id)) {
              fields.push(newField);
            }
          } catch (error) {
            console.error(`Failed to create field "${fieldConfig.fieldName}" for column "${csvColumn}":`, error);
            const errorMsg = `Failed to create field "${fieldConfig.fieldName}" in masterlist: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
          }
        }
      }
      
      console.log(`Completed field processing loop. Processed ${processedCount} fields.`);
      console.log(`createdFieldIds now has ${createdFieldIds.size} entries`);
    } else {
      // For non-masterlist tables, create new fields as usual
      for (const [csvColumn, fieldConfig] of fieldsToCreate) {
        try {
          console.log(`dY"_ Creating field: ${fieldConfig.fieldName} (${fieldConfig.fieldType}) for column: ${csvColumn}`);
          const newField = await this.createField({
            name: fieldConfig.fieldName,
            type: fieldConfig.fieldType as FieldType,
            table_id: tableId,
            order_index: fields.length,
            options: fieldConfig.options
          });
          console.log(`バ. Field created successfully:`, { id: newField.id, name: newField.name, type: newField.type });
          fields.push(newField);
          fieldTypeMap.set(newField.id, newField.type);
          fieldById.set(newField.id, newField);
          createdFieldIds.set(csvColumn, newField.id);
          console.log(`dY"? Updated createdFieldIds:`, { csvColumn, fieldId: newField.id });
        } catch (error) {
          console.error(`ƒ?O Failed to create field "${fieldConfig.fieldName}":`, error);
          errors.push(`Failed to create field "${fieldConfig.fieldName}" for column "${csvColumn}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    console.log('🔧 FIELD CREATION SUMMARY:');
    console.log('📊 Total fields after creation:', fields.length);
    console.log('📊 Created field IDs map:', Object.fromEntries(createdFieldIds));
    console.log('📊 Field type map:', Object.fromEntries(fieldTypeMap));
    
    // Validate that all fields to create have been successfully mapped/created
    // This ensures we don't start processing rows with missing field IDs
    const missingFieldIds: string[] = [];
    for (const [csvColumn, mapping] of Object.entries(fieldMappings)) {
      if (typeof mapping === 'object' && mapping.type === 'create') {
        const fieldId = createdFieldIds.get(csvColumn);
        if (!fieldId) {
          missingFieldIds.push(csvColumn);
          console.error(`❌ CRITICAL: Field "${mapping.fieldName}" for column "${csvColumn}" was not created or mapped`);
        }
      }
    }
    
    // If any required fields are missing, throw an error before processing rows
    if (missingFieldIds.length > 0) {
      const missingFieldNames = missingFieldIds.map(col => {
        const mapping = fieldMappings[col];
        return typeof mapping === 'object' && mapping.type === 'create' ? mapping.fieldName : col;
      });
      const errorMessage = `Cannot proceed with import: ${missingFieldIds.length} field(s) failed to create: ${missingFieldNames.join(', ')}. Please check the errors above.`;
      console.error('❌', errorMessage);
      errors.push(errorMessage);
      return { imported: 0, errors };
    }

    dataRows.forEach((row, rowIndex) => {
      try {
        // Parse the row
        const values = parseCsvRow(row).map(v => {
          // Remove surrounding quotes if present
          let cleaned = v.trim();
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
          }
          // Unescape double quotes
          return cleaned.replace(/""/g, '"');
        });

        console.log(`Processing row ${rowIndex + 2}:`, { valueCount: values.length, headerCount: headers.length });

        // Handle column count mismatch - pad with empty values or truncate
        if (values.length !== headers.length) {
          console.warn(`Row ${rowIndex + 2}: Column count mismatch (${values.length} vs ${headers.length})`);

          // If row has too few columns, pad with empty strings
          while (values.length < headers.length) {
            values.push('');
          }

          // If row has too many columns, truncate (but log warning)
          if (values.length > headers.length) {
            errors.push(`Row ${rowIndex + 2}: Too many columns (${values.length} vs ${headers.length}), extra data ignored`);
            values.length = headers.length;
          }
        }

        const recordValues: Record<string, unknown> = {};
        let hasValidData = false;

        headers.forEach((header, colIndex) => {
          const mapping = fieldMappings[header];
          console.log(`Processing header "${header}":`, { mapping, colIndex });
          if (!mapping) {
            console.log(`❌ NO MAPPING: No mapping found for header "${header}" - skipping column`);
            return; // Skip unmapped columns
          }

          // Get field ID - either from existing mapping or from newly created field
          let fieldId: string;
          if (typeof mapping === 'string') {
            fieldId = mapping;
            if (isMasterlist && masterlistTableId) {
              const mappedFieldMeta = fieldById.get(fieldId);
              const isOnMasterlist = mappedFieldMeta?.table_id === masterlistTableId;
              if (!isOnMasterlist) {
                const nameToMatch = mappedFieldMeta?.name ?? header;
                const remappedId = masterlistFieldNameMap.get(nameToMatch) ?? masterlistFieldNameMap.get(header);
                if (remappedId) {
                  console.log(`Remapping non-masterlist field ID ${fieldId} to masterlist field ${remappedId} (name: ${nameToMatch})`);
                  fieldId = remappedId;
                } else {
                  console.warn(`Row ${rowIndex + 2}: Mapping for "${header}" points to non-masterlist field and no masterlist match was found - skipping this field`);
                  return;
                }
              }
            }
            console.log(`dY"< Using existing field ID: ${fieldId} for header: ${header}`);
          } else if (typeof mapping === 'object' && mapping.type === 'create') {
            fieldId = createdFieldIds.get(header) || '';
            console.log(`dY"_ Looking for created field ID for header "${header}":`, {
              fieldId,
              createdFieldIds: Object.fromEntries(createdFieldIds),
              mapping
            });
            if (!fieldId) {
              console.error(`ƒ?O MISSING FIELD ID: Failed to get field ID for newly created field "${mapping.fieldName}" for header "${header}"`);
              errors.push(`Row ${rowIndex + 2}: Failed to get field ID for newly created field "${mapping.fieldName}"`);
              return; // Skip this field but continue with others
            }
          } else {
            console.log(`ƒ?O INVALID MAPPING: Invalid mapping type for header "${header}":`, mapping);
            return; // Skip this field but continue with others
          }
          const value = values[colIndex];
          const fieldType = fieldTypeMap.get(fieldId);

          if (!fieldType) {
            console.warn(`Row ${rowIndex + 2}: Unknown field for column "${header}" - skipping this field`);
            return; // Skip this field but continue with others
          }

          // Convert value based on field type
          let convertedValue: unknown = value;
          let fieldProcessed = false;
          
          if (value === '' || value === null || value === undefined) {
            convertedValue = ''; // Use empty string instead of null
            fieldProcessed = true; // Empty values are valid
          } else {
            try {
            switch (fieldType) {
              case 'number':
                const numValue = parseFloat(value);
                if (isNaN(numValue)) {
                    console.warn(`Row ${rowIndex + 2}: Invalid number "${value}" for field "${header}" - skipping this field`);
                    return; // Skip this field but continue with others
                }
                convertedValue = numValue;
                  fieldProcessed = true;
                break;
              case 'checkbox':
                convertedValue = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
                  fieldProcessed = true;
                break;
              case 'date':
                const dateValue = parseDateValue(value);
                if (!dateValue) {
                    console.warn(`Row ${rowIndex + 2}: Invalid date "${value}" for field "${header}" - skipping this field`);
                    return; // Skip this field but continue with others
                }
                // Format as YYYY-MM-DD for date fields (date only, no time)
                convertedValue = dateValue.toISOString().split('T')[0];
                  fieldProcessed = true;
                break;
              case 'datetime':
                const datetimeValue = parseDateValue(value);
                if (!datetimeValue) {
                    console.warn(`Row ${rowIndex + 2}: Invalid datetime "${value}" for field "${header}" - skipping this field`);
                    return; // Skip this field but continue with others
                }
                // Store full ISO string for datetime fields (includes time)
                convertedValue = datetimeValue.toISOString();
                  fieldProcessed = true;
                break;
              case 'email':
                if (value && value.trim()) {
                  // Clean and extract valid email from potentially malformed input
                  const cleanedEmail = cleanEmailValue(value);
                  if (cleanedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
                      console.warn(`Row ${rowIndex + 2}: Invalid email "${value}" for field "${header}" - skipping this field`);
                      return; // Skip this field but continue with others
                  }
                  convertedValue = cleanedEmail;
                } else {
                  convertedValue = ''; // Empty string for empty email
                }
                  fieldProcessed = true;
                break;
              case 'single_select':
                // Map CSV value to option ID for single_select fields
                if (value && value.trim()) {
                    // Find the field to get its options - use fieldById so newly created masterlist fields are included
                    const field = fieldById.get(fieldId);
                  if (field && field.options) {
                    const options = field.options as Record<string, { name: string; color: string }>;
                    const trimmedValue = value.trim();

                    // 1. Try exact match
                    let optionEntry = Object.entries(options).find(([, optionData]) => {
                      return optionData && optionData.name === trimmedValue;
                    });

                    // 2. If no exact match, try case-insensitive match
                    if (!optionEntry) {
                      optionEntry = Object.entries(options).find(([, optionData]) => {
                        return optionData && optionData.name && optionData.name.toLowerCase() === trimmedValue.toLowerCase();
                      });
                    }

                    if (optionEntry) {
                      convertedValue = optionEntry[0]; // Use the option ID
                        fieldProcessed = true;
                    } else {
                        // Value doesn't match any option - skip this field but continue with others
                        console.warn(`Row ${rowIndex + 2}: Value "${value}" does not match any option for single_select field "${header}" - skipping this field`);
                        return; // Skip this field but continue with others
                    }
                  } else {
                    // Should not happen for properly configured single_select fields
                    convertedValue = value;
                      fieldProcessed = true;
                  }
                } else {
                  convertedValue = ''; // Empty string for empty single_select
                    fieldProcessed = true;
                }
                break;
              default: // text, multi_select, link, phone
                convertedValue = value;
                  fieldProcessed = true;
                break;
              }
            } catch (fieldError) {
              console.warn(`Row ${rowIndex + 2}: Error processing field "${header}":`, fieldError);
              return; // Skip this field but continue with others
            }
          }

          // Only set the value if the field was successfully processed
          if (fieldProcessed) {
          recordValues[fieldId] = convertedValue;
            // Consider the row valid if at least one field was successfully processed
            // Even if the value is an empty string, the field exists and was processed
            hasValidData = true;
          }
          
          console.log(`Processed field "${header}":`, { 
            value, 
            convertedValue, 
            fieldId, 
            fieldType, 
            fieldProcessed,
            hasValidData 
          });
        });

        console.log(`Row ${rowIndex + 2} summary:`, {
          recordValues,
          hasValidData,
          willCreateRecord: hasValidData
        });

        if (hasValidData) {
          const recordToCreate = {
            table_id: tableId,
            values: recordValues
          };
          console.log(`✅ Adding record to create:`, recordToCreate);
          recordsToCreate.push(recordToCreate);
        } else {
          console.log(`❌ Skipping row ${rowIndex + 2} - no valid data`);
        }
      } catch (error) {
        // Log error but continue processing other rows
        const errorMsg = `Row ${rowIndex + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    });

    console.log('Records to create:', recordsToCreate.length, 'records');

    if (recordsToCreate.length === 0) {
      throw new Error('No valid data found to import');
    }

    // Batch insert records to avoid hitting Supabase limits
    // Insert in batches of 100 records at a time
    const batchSize = 100;
    let totalImported = 0;

    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      const batch = recordsToCreate.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(recordsToCreate.length / batchSize);

      console.log(`Inserting batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
      console.log(`📊 Batch data sample:`, batch.slice(0, 2)); // Show first 2 records for debugging

      const { data, error } = await supabase
        .from("records")
        .insert(batch)
        .select('id, table_id, values');

      if (error) {
        console.error(`❌ Database insertion error:`, error);
        throw new Error(`Failed to import batch ${batchNum}: ${error.message}`);
      }

      console.log(`✅ Batch ${batchNum} inserted successfully:`, data?.length, 'records');
      totalImported += batch.length;
    }

    console.log(`Successfully imported ${totalImported} records`);

    return {
      imported: totalImported,
      errors
    };
  }

  static async bulkCreateRecords(
    tableId: string,
    records: Array<Record<string, unknown>>
  ): Promise<RecordRow[]> {
    const recordsToCreate = records.map(values => ({
      table_id: tableId,
      values
    }));

    const { data, error } = await supabase
      .from("records")
      .insert(recordsToCreate)
      .select("id, table_id, values, created_at");

    if (error) throw error;
    return data as RecordRow[];
  }

  // Automation operations
  static async getAutomations(baseId: string): Promise<Automation[]> {
    if (automationCache.has(baseId)) {
      return automationCache.get(baseId) as Automation[];
    }

    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .eq("base_id", baseId)
      .order("created_at");

    if (error) throw error;
    const automations = (data ?? []) as Automation[];
    automationCache.set(baseId, automations);
    return automations;
  }

  static async createAutomation(automation: Omit<Automation, 'id' | 'created_at'>): Promise<Automation> {
    const { data, error } = await supabase
      .from("automations")
      .insert(automation)
      .select("*")
      .single();

    if (error) throw error;
    automationCache.delete(automation.base_id);
    return data as Automation;
  }

  static async updateAutomation(automationId: string, updates: Partial<Automation>): Promise<void> {
    const { error } = await supabase
      .from("automations")
      .update(updates)
      .eq("id", automationId);

    if (error) throw error;
    // Invalidate cache for the affected base if we can determine it
    const { data } = await supabase
      .from("automations")
      .select("base_id")
      .eq("id", automationId)
      .maybeSingle();
    if (data?.base_id) {
      automationCache.delete(data.base_id as string);
    }
  }

  static async deleteAutomation(automationId: string): Promise<void> {
    const { error } = await supabase
      .from("automations")
      .delete()
      .eq("id", automationId);

    if (error) throw error;
    const { data } = await supabase
      .from("automations")
      .select("base_id")
      .eq("id", automationId)
      .maybeSingle();
    if (data?.base_id) {
      automationCache.delete(data.base_id as string);
    }
  }

  // Manual automation trigger for testing
  static async triggerAutomationManually(automationId: string, recordId: string): Promise<void> {
    console.log('🧪 MANUAL AUTOMATION TRIGGER: Testing automation', automationId, 'for record', recordId);

    const { data: automation, error: fetchError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .single();

    if (fetchError) throw fetchError;

    console.log('🔍 Manual trigger - Automation details:', JSON.stringify(automation, null, 2));
    await this.executeAutomation(automation, recordId);
  }

  // Debug function to check automation configuration
  static async debugAutomation(automationId: string): Promise<void> {
    console.log('🔍 DEBUGGING AUTOMATION:', automationId);

    const { data: automation, error: fetchError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching automation:', fetchError);
      return;
    }

    console.log('🔍 Automation Configuration:');
    console.log('  - Name:', automation.name);
    console.log('  - Enabled:', automation.enabled);
    console.log('  - Trigger Type:', automation.trigger.type);
    console.log('  - Trigger Field:', automation.trigger.field_id);
    console.log('  - Trigger Condition:', automation.trigger.condition);
    console.log('  - Action Type:', automation.action.type);
    console.log('  - Target Table:', automation.action.target_table_id);
    console.log('  - Preserve Original:', automation.action.preserve_original);
    console.log('  - Field Mappings:', automation.action.field_mappings);
  }

  // Debug function to test automation execution with a specific record
  static async debugAutomationExecution(automationId: string, recordId: string): Promise<void> {
    console.log('🧪 DEBUGGING AUTOMATION EXECUTION:', automationId, 'with record:', recordId);

    try {
      const { data: automation, error: fetchError } = await supabase
        .from("automations")
        .select("*")
        .eq("id", automationId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching automation:', fetchError);
        return;
      }

      console.log('🔍 Testing automation execution...');
      await this.executeAutomation(automation, recordId);
      console.log('✅ Automation execution completed successfully');
    } catch (error) {
      console.error('❌ Automation execution failed:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        fullError: error
      });
    }
  }

  // Automation execution
  static async executeAutomation(automation: Automation, recordId: string, newValues?: Record<string, unknown>, baseId?: string, sourceTableId?: string): Promise<void> {
    console.log('🎯 EXECUTING AUTOMATION:', automation.name, 'enabled:', automation.enabled, 'recordId:', recordId);

    if (!automation.enabled) {
      console.log('⏸️ Automation disabled, skipping');
      return;
    }

    // Check if record still exists (might have been deleted by another automation)
    const { error: recordCheckError } = await supabase
      .from("records")
      .select("id")
      .eq("id", recordId)
      .single();

    if (recordCheckError && recordCheckError.code === 'PGRST116') {
      console.log('⚠️ RECORD NOT FOUND: Record has been deleted, skipping automation:', automation.name);
      return;
    } else if (recordCheckError) {
      console.error('❌ ERROR CHECKING RECORD EXISTENCE:', recordCheckError);
      throw new Error(`Failed to check if record exists: ${recordCheckError.message}`);
    }

    console.log('✅ RECORD EXISTS: Record found, proceeding with automation');

    // Validate automation configuration
    if (!automation.trigger) {
      throw new Error(`Automation ${automation.name} has no trigger configuration`);
    }

    if (!automation.action) {
      throw new Error(`Automation ${automation.name} has no action configuration`);
    }

    if (!automation.action.target_table_name) {
      throw new Error(`Automation ${automation.name} has no target table configured`);
    }

    const hasFieldMappings = automation.action.field_mappings && automation.action.field_mappings.length > 0;
    const mappingsRequired = !['move_to_table', 'sync_to_table'].includes(automation.action.type);
    if (mappingsRequired && !hasFieldMappings) {
      throw new Error(`Automation ${automation.name} has no field mappings configured`);
    }
    if (!hasFieldMappings && !mappingsRequired) {
      console.log('No field mappings provided; will fall back to name-based copying for action', automation.action.type);
    }

    // Resolve target_table_name to target_table_id
    if (!baseId) {
      // Get base_id from automation
      baseId = automation.base_id;
    }

    const { data: targetTable, error: tableError } = await supabase
      .from("tables")
      .select("id, name, is_master_list")
      .eq("base_id", baseId)
      .eq("name", automation.action.target_table_name)
      .maybeSingle();

    let resolvedTargetTable = targetTable;

    // Fallback: case-insensitive match if exact name lookup failed
    if ((!resolvedTargetTable || tableError) && automation.action.target_table_name) {
      const { data: allTables } = await supabase
        .from("tables")
        .select("id, name, is_master_list")
        .eq("base_id", baseId);
      const lowerTarget = automation.action.target_table_name.trim().toLowerCase();
      resolvedTargetTable = (allTables || []).find(t => t.name.trim().toLowerCase() === lowerTarget) || null;
    }

    if (!resolvedTargetTable) {
      throw new Error(`Target table "${automation.action.target_table_name}" not found in base`);
    }

    const targetTableId = resolvedTargetTable.id;
    const isTargetMasterlist = resolvedTargetTable.is_master_list;

    // Get masterlist table for this base
    const { data: masterlistTable, error: masterlistError } = await supabase
      .from("tables")
      .select("id")
      .eq("base_id", baseId)
      .eq("is_master_list", true)
      .single();

    if (masterlistError || !masterlistTable) {
      throw new Error(`Masterlist table not found in base`);
    }

    const masterlistTableId = masterlistTable.id;

    const { trigger, action } = automation;
    console.log('🔧 Trigger config:', trigger);
    console.log('🎬 Action config:', action);
    console.log('🎯 Target table ID:', targetTableId, 'Name:', automation.action.target_table_name);
    console.log('📋 Masterlist table ID:', masterlistTableId);

    // Check if trigger condition is met
    const triggerFieldName = trigger.field_name;
    const triggerFieldId = trigger.field_id; // Backward compatibility
    
    console.log('🔍 TRIGGER CHECK START:', {
      automationName: automation.name,
      triggerType: trigger.type,
      triggerFieldName,
      triggerFieldId,
      hasCondition: !!trigger.condition,
      condition: trigger.condition
    });
    
    if (trigger.type === 'field_change' && (triggerFieldName || triggerFieldId) && trigger.condition) {
      console.log('✅ Field change trigger detected - checking condition for field:', triggerFieldName || triggerFieldId);
      console.log('📋 Trigger condition:', trigger.condition);
      
      // Get current record values and table_id
      // Always fetch from database to get full record values, then merge newValues if provided
      const { data: recordData, error: fetchError } = await supabase
        .from("records")
        .select("values, table_id")
        .eq("id", recordId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          console.log('⚠️ RECORD DELETED DURING TRIGGER CHECK: Record no longer exists, skipping automation:', automation.name);
          return;
        }
        throw fetchError;
      }

      // Merge database values with newValues (if provided) to get the latest state
      const currentRecordValues = newValues 
        ? { ...recordData.values, ...newValues }
        : recordData.values;
      
      const record = {
          values: currentRecordValues,
          table_id: recordData.table_id
        };
      
      console.log('✅ Record values (merged with newValues):', {
        databaseValues: recordData.values,
        newValues: newValues,
        mergedValues: currentRecordValues
      });

      // Find the field in the record's table by name (preferred) or by ID (backward compatibility)
      // IMPORTANT: If record is in masterlist, we need to find the field in the source table (where the record came from)
      // because record values are keyed by field IDs from the original table, not masterlist field IDs
      let fieldIdToCheck: string | undefined;
      let currentValue: unknown;
      
      // Determine which table to look for the field in
      // If record is in masterlist, use sourceTableId (the table that triggered the automation)
      // Otherwise, use the record's table_id
      const tableToCheck = (record.table_id === masterlistTableId && sourceTableId) 
        ? sourceTableId 
        : record.table_id;
      
      console.log('🔍 Field lookup context:', {
        recordTableId: record.table_id,
        isMasterlist: record.table_id === masterlistTableId,
        sourceTableId: sourceTableId,
        tableToCheck: tableToCheck
      });
      
      if (triggerFieldName) {
        // New way: Find field by name in the appropriate table
        console.log('🔍 Finding field by name:', triggerFieldName, 'in table:', tableToCheck);
        const { data: matchingFields, error: matchingError } = await supabase
          .from("fields")
          .select("id")
          .eq("table_id", tableToCheck)
          .eq("name", triggerFieldName)
          .limit(1);
        
        if (!matchingError && matchingFields && matchingFields.length > 0) {
          fieldIdToCheck = matchingFields[0].id;
          if (fieldIdToCheck && currentRecordValues) {
            currentValue = currentRecordValues[fieldIdToCheck];
          }
          
          // If value is null/undefined and record is in masterlist, try masterlist field ID
          if ((currentValue === null || currentValue === undefined) && record.table_id === masterlistTableId) {
            console.log('⚠️ Value not found with source table field ID, trying masterlist field ID');
            const { data: masterlistFields, error: masterlistError } = await supabase
              .from("fields")
              .select("id")
              .eq("table_id", masterlistTableId)
              .eq("name", triggerFieldName)
              .limit(1);
            
            if (!masterlistError && masterlistFields && masterlistFields.length > 0) {
              const masterlistFieldId = masterlistFields[0].id;
              const masterlistValue = currentRecordValues?.[masterlistFieldId];
              if (masterlistValue !== null && masterlistValue !== undefined) {
                fieldIdToCheck = masterlistFieldId;
                currentValue = masterlistValue;
                console.log('✅ Found value using masterlist field ID:', masterlistFieldId);
              }
            }
          }
          // If still null/undefined, try to find any field with the same name that has a value
          if ((currentValue === null || currentValue === undefined) && currentRecordValues) {
            console.log('Value still not found, searching all fields with same name in record values across base');
            const allFieldsWithName = await this.getAllFields(baseId);
            for (const field of allFieldsWithName) {
              if (field.name !== triggerFieldName) continue;
              const value = currentRecordValues[field.id];
              if (value !== null && value !== undefined && value !== '') {
                fieldIdToCheck = field.id;
                currentValue = value;
                console.log('Found value using field ID from table:', field.table_id, 'field ID:', field.id);
                break;
              }
            }
          }
          
          console.log('✅ Found field by name:', {
            fieldId: fieldIdToCheck,
            fieldName: triggerFieldName,
            tableId: tableToCheck,
            currentValue: currentValue,
            valueType: typeof currentValue,
            allRecordValues: Object.keys(currentRecordValues || {}),
            recordValues: currentRecordValues
          });
        } else {
          console.log('⚠️ Field not found in table:', {
            fieldName: triggerFieldName,
            tableId: tableToCheck,
            error: matchingError,
            recordTableId: record.table_id
          });
          // Field doesn't exist in this table - skip automation for this table
          // This is expected behavior: automation only runs when the field exists
          console.log('⚠️ Skipping automation - field', triggerFieldName, 'does not exist in table', tableToCheck);
          return; // Field doesn't exist in this table, skip automation
        }
      } else if (triggerFieldId) {
        // Backward compatibility: Use field_id
        fieldIdToCheck = triggerFieldId;
        currentValue = currentRecordValues?.[triggerFieldId];
        
        // If value not found, try to find by field name (from the original field)
        if (currentValue === undefined || currentValue === null) {
          const { data: triggerField, error: triggerFieldError } = await supabase
            .from("fields")
            .select("id, name, table_id")
            .eq("id", triggerFieldId)
            .single();

          if (!triggerFieldError && triggerField) {
            // Check if we need to find the field in a different table
            const needsLookup = triggerField.table_id !== tableToCheck;
            
            if (needsLookup) {
              console.log('🔍 Trigger field is from different table, finding field by name:', triggerField.name, 'in table:', tableToCheck);
            
            const { data: matchingFields, error: matchingError } = await supabase
              .from("fields")
              .select("id")
                .eq("table_id", tableToCheck)
              .eq("name", triggerField.name)
              .limit(1);
            
            if (!matchingError && matchingFields && matchingFields.length > 0) {
              fieldIdToCheck = matchingFields[0].id;
              if (fieldIdToCheck && currentRecordValues) {
                currentValue = currentRecordValues[fieldIdToCheck];
              }
                console.log('✅ Found matching field in table:', {
                  fieldId: fieldIdToCheck,
                  tableId: tableToCheck,
                  value: currentValue
                });
              } else {
                console.log('⚠️ Could not find matching field by name in table:', tableToCheck);
              }
            }
          }
        }
      }
      
      if (!fieldIdToCheck) {
        console.log('⚠️ Could not determine field to check, skipping automation');
        return;
      }

      const triggerValue = trigger.condition.value;

      console.log('📊 Current value:', currentValue, 'Trigger value:', triggerValue, 'Operator:', trigger.condition.operator);

      // Check condition - handle option IDs for single_select fields
      let conditionMet = false;

      // For single_select fields, we need to check if the current value is an option ID
      // and if the trigger value matches the display text
      let currentValueToCheck = currentValue;
      const triggerValueToCheck = triggerValue;

      // If current value looks like an option ID (starts with 'option_'), we need to resolve it
      if (String(currentValue).startsWith('option_')) {
        console.log('🔍 OPTION ID DETECTED: Current value is an option ID, need to resolve display text');

        
        // Get the field to check if it's a single_select and get the options
      // Use fieldIdToCheck (the actual field in the record's table) instead of trigger.field_id
        const { data: field, error: fieldError } = await supabase
          .from("fields")
          .select("type, options")
        .eq("id", fieldIdToCheck)
          .single();

      if (!fieldError && field && field.type === 'single_select' && field.options) {
        console.log('🔍 SINGLE_SELECT FIELD DETECTED: Checking option values');
        console.log("🔍 FIELD DATA:", JSON.stringify(field, null, 2));
        console.log("🔍 Current value:", currentValue);
        console.log("🔍 Trigger value:", triggerValue);
        
        const options = field.options as Record<string, { name?: string; label?: string; color: string }>;
        
        // If current value looks like an option ID (starts with 'option_'), we need to resolve it
        if (currentValue && String(currentValue).startsWith('option_')) {
          console.log('🔍 OPTION ID DETECTED: Current value is an option ID, need to resolve display text');
          const optionKey = String(currentValue);

          console.log("🔍 ALL OPTIONS:", JSON.stringify(options, null, 2));
          console.log("🔍 Looking for option key:", optionKey);
          console.log("🔍 Option exists:", optionKey in options);

          if (options[optionKey]) {
            const optionData = options[optionKey];
            console.log("🔍 OPTION DATA:", JSON.stringify(optionData, null, 2));
            
            // Support both 'name' and 'label' properties for backward compatibility
            if (optionData && (optionData.name || optionData.label)) {
              currentValueToCheck = optionData.name || optionData.label || '';
              console.log('✅ RESOLVED OPTION: Option ID', currentValue, 'resolves to display text:', currentValueToCheck);
            } else {
              console.log('⚠️ OPTION HAS NO NAME/LABEL:', optionKey, optionData);
            }
          } else {
            console.log('⚠️ OPTION KEY NOT FOUND in options:', optionKey);
            console.log('⚠️ Available keys:', Object.keys(options));
          }
        } else if (currentValue) {
          // Current value might already be a display name - check if it matches any option name/label
          const currentValueStr = String(currentValue);
          console.log('🔍 Checking if current value matches any option name/label:', currentValueStr);
          
          // Try to find the option by name or label
          for (const [, optionData] of Object.entries(options)) {
            const optionName = optionData.name || optionData.label || '';
            if (optionName === currentValueStr) {
              // Value is already the display name, use it as-is
              currentValueToCheck = optionName;
              console.log('✅ Current value matches option name/label:', currentValueToCheck);
              break;
            }
          }
        }
      } else if (fieldError) {
          console.log('⚠️ FIELD RESOLUTION FAILED:', {
            hasError: !!fieldError,
          error: fieldError,
          fieldId: fieldIdToCheck
          });
      }

      switch (trigger.condition.operator) {
        case 'equals':
          conditionMet = String(currentValueToCheck) === String(triggerValueToCheck);
          break;
        case 'not_equals':
          conditionMet = String(currentValueToCheck) !== String(triggerValueToCheck);
          break;
        case 'contains':
          conditionMet = String(currentValueToCheck).includes(String(triggerValueToCheck));
          break;
        case 'greater_than':
          conditionMet = Number(currentValueToCheck) > Number(triggerValueToCheck);
          break;
        case 'less_than':
          conditionMet = Number(currentValueToCheck) < Number(triggerValueToCheck);
          break;
        case 'greater_than_or_equal':
          conditionMet = Number(currentValueToCheck) >= Number(triggerValueToCheck);
          break;
        case 'less_than_or_equal':
          conditionMet = Number(currentValueToCheck) <= Number(triggerValueToCheck);
          break;
      }

      console.log('✅ Condition met:', conditionMet, 'for automation:', automation.name);
      console.log('🔍 FINAL COMPARISON:', {
        automationName: automation.name,
        currentValueToCheck,
        triggerValueToCheck,
        operator: trigger.condition.operator,
        originalCurrentValue: currentValue,
        originalTriggerValue: triggerValue
      });

      if (!conditionMet) {
        console.log(`❌ TRIGGER CONDITION NOT MET for "${automation.name}": Automation trigger condition not satisfied, skipping automation`);
        console.log('🔍 Trigger details:', {
          automationName: automation.name,
          currentValue,
          triggerValue,
          currentValueToCheck,
          triggerValueToCheck,
          operator: trigger.condition.operator,
          fieldId: trigger.field_id,
          fieldName: trigger.field_name
        });
        return; // Trigger condition not met, skip automation
      } else {
        console.log(`✅✅✅ CONDITION MET for "${automation.name}" - WILL EXECUTE`);
      }
    }

    // Execute action based on type
    console.log('🎬 Executing action:', action.type);
    console.log('🔍 Full action configuration:', JSON.stringify(action, null, 2));

    try {
      switch (action.type) {
        case 'copy_to_table':
          console.log('📋 COPYING TO TABLE:', automation.action.target_table_name);
          await this.executeCopyToTableCanonical(recordId, action, targetTableId, masterlistTableId, isTargetMasterlist, baseId, sourceTableId, newValues);
          console.log('✅ Copy to table completed');
          break;
        case 'move_to_table':
          console.log('🔄 MOVING TO TABLE:', automation.action.target_table_name);
          await this.executeMoveToTable(recordId, action, targetTableId, masterlistTableId, baseId, sourceTableId, newValues);
          console.log('✅ Move to table completed');
          break;
        case 'sync_to_table':
          console.log('🔄 Syncing to table:', automation.action.target_table_name);
          await this.executeSyncToTable(recordId, action, targetTableId, masterlistTableId, baseId);
          console.log('✅ Sync to table completed');
          break;
        case 'show_in_table':
          console.log('👁️ Showing in table:', automation.action.target_table_name);
          await this.executeShowInTable(recordId, action, targetTableId, masterlistTableId);
          console.log('✅ Show in table completed');
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (actionError) {
      console.error('❌ ACTION EXECUTION FAILED:', {
        automationName: automation.name,
        actionType: action.type,
        recordId,
        error: actionError
      });
      throw actionError;
    }
    }
  }

  static async executeCopyToTable(
    recordId: string,
    action: AutomationAction,
    targetTableId: string,
    masterlistTableId: string,
    isTargetMasterlist: boolean
  ): Promise<void> {
    void masterlistTableId;
    void isTargetMasterlist;
    console.log('📋 Starting copy to table for record:', recordId);

    // Get source record
    const { data: sourceRecord, error: fetchError } = await supabase
      .from("records")
      .select("values")
      .eq("id", recordId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log('⚠️ SOURCE RECORD DELETED: Record no longer exists, skipping copy operation');
        return;
      }
      throw fetchError;
    }
    console.log('📄 Source record values:', sourceRecord.values);

    // Map field values based on field mappings
    const targetValues: Record<string, unknown> = {};
    console.log('🔗 Field mappings:', action.field_mappings);

    if (action.field_mappings.length === 0) {
      console.log('⚠️ NO FIELD MAPPINGS: Automation has no field mappings configured');
      return;
    }

    for (const mapping of action.field_mappings) {
      const sourceValue = sourceRecord.values[mapping.source_field_id];
      targetValues[mapping.target_field_id] = sourceValue;
      console.log(`📝 Mapping ${mapping.source_field_id} -> ${mapping.target_field_id}: ${sourceValue}`);
    }

    console.log('🎯 Target values to create:', targetValues);

    // Check for duplicates and handle appropriately
    if (action.duplicate_handling === 'skip') {
      // Get existing records in target table
      const { data: existingRecords, error: existingError } = await supabase
        .from("records")
        .select("id, values")
        .eq("table_id", targetTableId);

      if (existingError) throw existingError;

      // Simple duplicate check based on first field mapping
      if (action.field_mappings.length > 0) {
        const firstMapping = action.field_mappings[0];
        const targetFieldValue = targetValues[firstMapping.target_field_id];

        const existingRecord = existingRecords?.find(record =>
          record.values && record.values[firstMapping.target_field_id] === targetFieldValue
        );

        if (existingRecord) {
          console.log(`⚠️ DUPLICATE FOUND: Automation found duplicate record in target table for record ${recordId}.`);
          console.log(`🔍 Duplicate check details:`, {
            targetFieldValue,
            firstMapping,
            existingRecordId: existingRecord.id,
            existingRecordsCount: existingRecords?.length || 0
          });

          // Instead of skipping, let's update the existing record
          console.log(`🔄 UPDATING EXISTING RECORD: Instead of skipping, updating existing record ${existingRecord.id}`);
          await this.updateRecord(existingRecord.id, targetValues);
          console.log(`✅ AUTOMATION SUCCESS: Updated existing record in target table:`, existingRecord.id);
          return;
        }
      }
    }

    // Note: Records are created per-table, so we don't need to check masterlist here
    // The masterlist will be maintained separately when records are created/updated

    // Create record in target table
    console.log('💾 Creating record in target table:', targetTableId);
    const newRecord = await this.createRecord(targetTableId, targetValues);
    console.log('✅ AUTOMATION SUCCESS: Record created successfully in target table:', newRecord.id);
  }

  // Canonical copy handler with master-first sync and single-copy invariant
  static async executeCopyToTableCanonical(
    recordId: string,
    action: AutomationAction,
    targetTableId: string,
    masterlistTableId: string,
    isTargetMasterlist: boolean,
    baseId: string,
    sourceTableId?: string,
    newValues?: Record<string, unknown>
  ): Promise<void> {
    console.log('dY"< Starting copy to table (canonical) for record:', recordId);

    const { data: sourceRecord, error: fetchError } = await supabase
      .from("records")
      .select("table_id, values")
      .eq("id", recordId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log('📔📱 SOURCE RECORD DELETED: Record no longer exists, skipping copy operation');
        return;
      }
      throw fetchError;
    }

    const sourceRecordValues = newValues
      ? { ...sourceRecord.values, ...newValues }
      : sourceRecord.values;
    const masterRecordId =
      typeof sourceRecordValues?._source_record_id === 'string' && sourceRecordValues._source_record_id
        ? sourceRecordValues._source_record_id
        : recordId;

    const actualSourceTableId = sourceTableId || sourceRecord.table_id;

    if (!action.field_mappings || action.field_mappings.length === 0) {
      console.log('📔📱 NO FIELD MAPPINGS: Automation has no field mappings configured');
      return;
    }

    const [sourceFields, allBaseFields, targetFields] = await Promise.all([
      this.getFields(actualSourceTableId),
      this.getAllFields(baseId),
      this.getFields(targetTableId),
    ]);
    const sourceFieldNameMap = new Map(sourceFields.map(f => [f.name, f]));
    const allFieldsMap = new Map(allBaseFields.map(f => [f.id, f]));
    const targetFieldNameMap = new Map(targetFields.map(f => [f.name, f]));

    const targetValues: Record<string, unknown> = {};
    for (const mapping of action.field_mappings) {
      if (!mapping || typeof mapping !== 'object') continue;
      if (!mapping.source_field_id || !mapping.target_field_id) continue;
      const mappedSourceField = allFieldsMap.get(mapping.source_field_id);
      const mappedTargetField = allFieldsMap.get(mapping.target_field_id);
      if (!mappedSourceField || !mappedTargetField) continue;
      const sourceField = sourceFieldNameMap.get(mappedSourceField.name);
      const targetField = targetFieldNameMap.get(mappedTargetField.name);
      if (!sourceField || !targetField) continue;
      if (!(sourceField.id in sourceRecordValues)) continue;
      const mappedVal = this.mapSelectValueBetweenFields(
        sourceRecordValues[sourceField.id],
        sourceField,
        targetField
      );
      targetValues[targetField.id] = mappedVal;
    }

    if (Object.keys(targetValues).length === 0) {
      console.log('📔📱 NO VALUES TO COPY: No valid mappings after resolution');
      return;
    }

    targetValues['_source_record_id'] = masterRecordId;

    const masterlistFields = await this.getFields(masterlistTableId);
    await this.syncMasterlistWithTable(masterRecordId, targetTableId, masterlistTableId, targetValues, targetFields, masterlistFields);

    if (!isTargetMasterlist) {
      await this.removeExistingCopiesForMasterRecord(baseId, masterRecordId, [targetTableId, masterlistTableId]);

      const { data: existingTargetCopiesRaw, error: fetchTargetCopiesError } = await supabase
        .from("records")
        .select("id, values")
        .eq("table_id", targetTableId)
        .eq("values->>_source_record_id", masterRecordId);
      if (fetchTargetCopiesError) throw fetchTargetCopiesError;

      const existingTargetCopies = existingTargetCopiesRaw as Array<{ id: string; values: Record<string, unknown> }> | null;
      let targetCopyId: string | null = null;
      if (existingTargetCopies && existingTargetCopies.length > 0) {
        targetCopyId = existingTargetCopies[0].id as string;
        if (existingTargetCopies.length > 1) {
          const extraIds = existingTargetCopies.slice(1).map((r) => r.id);
          const { error: deleteExtrasError } = await supabase
            .from("records")
            .delete()
            .eq("table_id", targetTableId)
            .in("id", extraIds);
          if (deleteExtrasError) {
            console.error('Failed to delete duplicate target copies', deleteExtrasError);
          }
        }
      }

      if (targetCopyId) {
        const { error: updateCopyError } = await supabase
          .from("records")
          .update({ values: targetValues })
          .eq("id", targetCopyId)
          .eq("table_id", targetTableId);
        if (updateCopyError) throw updateCopyError;
      } else {
        const { error: createCopyError } = await supabase
          .from("records")
          .insert({ table_id: targetTableId, values: targetValues });
        if (createCopyError) throw createCopyError;
      }

      await this.pruneDuplicateCopies(targetTableId, masterRecordId);
    }
  }

  // Helper function to sync masterlist with a table's values
  static async syncMasterlistWithTable(
    recordId: string,
    targetTableId: string,
    masterlistTableId: string,
    targetValues: Record<string, unknown>,
    preloadedTargetFields?: FieldRow[],
    preloadedMasterlistFields?: FieldRow[]
  ): Promise<void> {
    try {
      // Get masterlist fields and target fields to map values by field name
      const masterlistFields = preloadedMasterlistFields || await this.getFields(masterlistTableId);
      const targetFields = preloadedTargetFields || await this.getFields(targetTableId);
      
      const masterlistFieldMap = new Map(masterlistFields.map(f => [f.name, f.id]));
      const targetFieldMap = new Map(targetFields.map(f => [f.id, f]));
      
      // Get existing masterlist values to preserve fields not in target
      const { data: currentMasterlistRecord, error: masterlistCheckError } = await supabase
        .from("records")
        .select("values")
        .eq("id", recordId)
        .eq("table_id", masterlistTableId)
        .maybeSingle();
      
      if (masterlistCheckError && masterlistCheckError.code !== 'PGRST116') {
        console.error('❌ Error checking masterlist record:', masterlistCheckError);
        throw masterlistCheckError;
      }
      
      // Start with existing masterlist values (or empty if doesn't exist)
      const mergedMasterlistValues = {
        ...(currentMasterlistRecord?.values || {}),
      };
      
      // Map each target value to masterlist by field name (with select remapping)
      for (const [targetFieldId, value] of Object.entries(targetValues)) {
        const targetField = targetFieldMap.get(targetFieldId);
        if (targetField && value !== undefined) {
          const masterlistFieldId = masterlistFieldMap.get(targetField.name);
          if (masterlistFieldId) {
            const masterFieldMeta = masterlistFields.find((f) => f.id === masterlistFieldId);
            const mappedVal = this.mapSelectValueBetweenFields(
              value,
              targetField,
              masterFieldMeta
            );
            mergedMasterlistValues[masterlistFieldId] = mappedVal;
            console.log(`  ✅ Mapped ${targetField.name} to masterlist: ${targetFieldId} -> ${masterlistFieldId} = ${mappedVal}`);
          }
        }
      }
      
      // Update or create masterlist record with merged values
      if (currentMasterlistRecord) {
        // Update existing masterlist record
        const { error: updateMasterlistError } = await supabase
          .from("records")
          .update({ values: mergedMasterlistValues })
          .eq("id", recordId)
          .eq("table_id", masterlistTableId);
        
        if (updateMasterlistError) {
          console.error('❌ Failed to update masterlist with target values:', updateMasterlistError);
          // Don't throw - the move was successful, this is just a sync issue
        } else {
          console.log('✅ Masterlist updated with target table values');
        }
      } else {
        // Create masterlist record if it doesn't exist
        const { error: createMasterlistError } = await supabase
          .from("records")
          .insert({ id: recordId, table_id: masterlistTableId, values: mergedMasterlistValues });
        
        if (createMasterlistError) {
          if (createMasterlistError.code === '23505') {
            // Conflict - update instead
            console.log('⚠️ Masterlist record conflict during create, updating instead');
            const { error: updateError } = await supabase
              .from("records")
              .update({ values: mergedMasterlistValues })
              .eq("id", recordId)
              .eq("table_id", masterlistTableId);
            
            if (updateError) {
              console.error('❌ Failed to update masterlist record after conflict:', updateError);
              // Don't throw - the move was successful
            } else {
              console.log('✅ Masterlist updated with target table values (after conflict)');
            }
          } else {
            console.error('❌ Failed to create masterlist record:', createMasterlistError);
            // Don't throw - the move was successful, this is just a sync issue
          }
        } else {
          console.log('✅ Masterlist record created with target table values');
        }
      }
    } catch (syncError) {
      console.error('❌ Error syncing masterlist with target values:', syncError);
      // Don't throw - the move was successful, this is just a sync issue
    }
  }

  static async executeMoveToTable(
    recordId: string,
    action: AutomationAction,
    targetTableId: string,
    masterlistTableId: string,
    baseId: string,
    sourceTableId?: string,
    newValues?: Record<string, unknown>
  ): Promise<void> {
    console.log('dY"', ' MOVING RECORD: Moving record', recordId, 'to table', targetTableId);
    console.log('dY"?', ' Action type:', action.type);
    console.log('dY"?', ' Preserve original setting:', action.preserve_original);
    console.log('dY"?', ' New values from cell update:', newValues);

    const { data: sourceRecord, error: fetchError } = await supabase
      .from("records")
      .select("table_id, values")
      .eq("id", recordId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log('?? SOURCE RECORD NOT FOUND: Record no longer exists, skipping move');
        return;
      }
      throw fetchError;
    }

    const sourceRecordValues = newValues
      ? { ...sourceRecord.values, ...newValues }
      : sourceRecord.values;
    const masterRecordId =
      typeof sourceRecordValues?._source_record_id === 'string' && sourceRecordValues._source_record_id
        ? sourceRecordValues._source_record_id
        : recordId;

    const actualSourceTableId = sourceTableId || sourceRecord.table_id;
    const isSourceMasterlist = actualSourceTableId === masterlistTableId;
    const isTargetMasterlist = targetTableId === masterlistTableId;

    console.log('dY"?', ' Source table ID (triggered):', actualSourceTableId, 'Is masterlist:', isSourceMasterlist);
    console.log('dY"?', ' Record current table ID:', sourceRecord.table_id);
    console.log('dY"?', ' Target table ID:', targetTableId, 'Is masterlist:', isTargetMasterlist);
    if (action.preserve_original) {
      console.log('Preserve original is ignored for move_to_table to enforce single-copy invariant');
    }

    if (!isTargetMasterlist) {
      const targetValues: Record<string, unknown> = {};
      const [sourceFields, allBaseFields, targetFields] = await Promise.all([
        this.getFields(actualSourceTableId),
        this.getAllFields(baseId),
        this.getFields(targetTableId),
      ]);
      const sourceFieldMap = new Map(sourceFields.map(f => [f.id, f]));
      const sourceFieldNameMap = new Map(sourceFields.map(f => [f.name, f]));
      const allFieldsMap = new Map(allBaseFields.map(f => [f.id, f]));
      const targetFieldNameMap = new Map(targetFields.map(f => [f.name, f]));

      const fieldMappings = action.field_mappings && action.field_mappings.length > 0
        ? action.field_mappings
        : null;

      if (!fieldMappings) {
        console.log('No field mappings provided, falling back to same-name field copy');
      }

      for (const mapping of fieldMappings || []) {
        if (!mapping || typeof mapping !== 'object') continue;
        if (!mapping.source_field_id || !mapping.target_field_id) continue;

        const mappedSourceField = allFieldsMap.get(mapping.source_field_id);
        const mappedTargetField = allFieldsMap.get(mapping.target_field_id);
        if (!mappedSourceField || !mappedTargetField) continue;

        const sourceField = sourceFieldNameMap.get(mappedSourceField.name);
        const targetField = targetFieldNameMap.get(mappedTargetField.name);
        if (!sourceField || !targetField) continue;

        if (!(sourceField.id in sourceRecordValues)) continue;
        const sourceVal = sourceRecordValues[sourceField.id];
        const mappedVal = this.mapSelectValueBetweenFields(
          sourceVal,
          sourceField,
          targetField
        );
        targetValues[targetField.id] = mappedVal;
      }

      if (Object.keys(targetValues).length === 0) {
        console.log('No explicit mapped values; relying on name-based merge for move_to_table');
      }

      const targetFieldMap = new Map(targetFields.map(f => [f.name, f]));
      const mergedTargetValues: Record<string, unknown> = {};
      const newValueFieldIds = new Set(newValues ? Object.keys(newValues) : []);

      if (newValues) {
        for (const [newValueFieldId, newValue] of Object.entries(newValues)) {
          const newValueField = allFieldsMap.get(newValueFieldId);
          if (!newValueField || newValue === undefined) continue;
          const targetField = targetFieldMap.get(newValueField.name);
          if (targetField) {
            const mappedVal = this.mapSelectValueBetweenFields(
              newValue,
              newValueField,
              targetField
            );
            mergedTargetValues[targetField.id] = mappedVal;
          }
        }
      }

      for (const [sourceFieldId, sourceValue] of Object.entries(sourceRecordValues)) {
        if (newValueFieldIds.has(sourceFieldId)) continue;
        const sourceField = sourceFieldMap.get(sourceFieldId) || allFieldsMap.get(sourceFieldId);
        if (!sourceField || sourceValue === undefined) continue;
        const targetField = targetFieldMap.get(sourceField.name);
        if (targetField && !(targetField.id in mergedTargetValues)) {
          const mappedVal = this.mapSelectValueBetweenFields(
            sourceValue,
            sourceField,
            targetField
          );
          mergedTargetValues[targetField.id] = mappedVal;
        }
      }

      for (const [targetFieldId, mappedValue] of Object.entries(targetValues)) {
        if (mergedTargetValues[targetFieldId] === undefined) {
          mergedTargetValues[targetFieldId] = mappedValue;
        }
      }

      const finalTargetValues = mergedTargetValues;

      // Sync masterlist first so it is canonical
      const masterlistFields = await this.getFields(masterlistTableId);
      await this.syncMasterlistWithTable(masterRecordId, targetTableId, masterlistTableId, finalTargetValues, targetFields, masterlistFields);

      // Always keep masterlist canonical; then create/update a single copy in target and remove other copies
      await this.removeExistingCopiesForMasterRecord(baseId, masterRecordId, [targetTableId, masterlistTableId]);

      // Upsert into target table to avoid duplicate copies
      const { data: existingTargetCopiesRaw, error: fetchTargetCopiesError } = await supabase
        .from("records")
        .select("id, values")
        .eq("table_id", targetTableId)
        .eq("values->>_source_record_id", masterRecordId);
      const existingTargetCopies = existingTargetCopiesRaw as Array<{ id: string; values: Record<string, unknown> }> | null;

      if (fetchTargetCopiesError) {
        console.error('Failed to fetch existing target copies', fetchTargetCopiesError);
        throw fetchTargetCopiesError;
      }

      let targetCopyId: string | null = null;
      let baseCopyValues: Record<string, unknown> = {};

      if (existingTargetCopies && existingTargetCopies.length > 0) {
        // Keep the first copy, delete any extras
        targetCopyId = existingTargetCopies[0].id as string;
        baseCopyValues = existingTargetCopies[0].values || {};

        if (existingTargetCopies.length > 1) {
          const extraIds = existingTargetCopies.slice(1).map((r) => r.id);
          const { error: deleteExtrasError } = await supabase
            .from("records")
            .delete()
            .eq("table_id", targetTableId)
            .in("id", extraIds);
          if (deleteExtrasError) {
            console.error('Failed to delete duplicate target copies', deleteExtrasError);
          }
        }
      }

      const copyValues = { ...baseCopyValues, ...finalTargetValues, _source_record_id: masterRecordId };

      if (targetCopyId) {
        const { error: updateCopyError } = await supabase
          .from("records")
          .update({ values: copyValues })
          .eq("id", targetCopyId)
          .eq("table_id", targetTableId);
        if (updateCopyError) throw updateCopyError;
      } else {
        const { error: createCopyError } = await supabase
          .from("records")
          .insert({ table_id: targetTableId, values: copyValues });
        if (createCopyError) throw createCopyError;
      }

      await this.pruneDuplicateCopies(targetTableId, masterRecordId);
    } else {
      console.log('?? Target is masterlist - skipping target table operation');
    }
  }

  static async executeSyncToTable(
    recordId: string, 
    action: AutomationAction, 
    targetTableId: string,
    masterlistTableId: string,
    baseId: string
  ): Promise<void> {
    // For sync, we update or upsert a single copy and keep masterlist canonical first
    const { data: sourceRecord, error: fetchError } = await supabase
      .from("records")
      .select("values, table_id")
      .eq("id", recordId)
      .single();

    if (fetchError) throw fetchError;

    const sourceRecordValues = sourceRecord.values || {};
    const masterRecordId =
      typeof sourceRecordValues?._source_record_id === 'string' && sourceRecordValues._source_record_id
        ? sourceRecordValues._source_record_id
        : recordId;

    if (!action.field_mappings || action.field_mappings.length === 0) {
      console.log('?? NO FIELD MAPPINGS: Cannot sync without mappings');
      return;
    }

    const [sourceFields, allBaseFields, targetFields] = await Promise.all([
      this.getFields(sourceRecord.table_id),
      this.getAllFields(baseId),
      this.getFields(targetTableId),
    ]);
    const sourceFieldNameMap = new Map(sourceFields.map(f => [f.name, f]));
    const allFieldsMap = new Map(allBaseFields.map(f => [f.id, f]));
    const targetFieldNameMap = new Map(targetFields.map(f => [f.name, f]));

    const targetValues: Record<string, unknown> = {};

    for (const mapping of action.field_mappings) {
      if (!mapping || typeof mapping !== 'object') continue;
      if (!mapping.source_field_id || !mapping.target_field_id) continue;
      const mappedSourceField = allFieldsMap.get(mapping.source_field_id);
      const mappedTargetField = allFieldsMap.get(mapping.target_field_id);
      if (!mappedSourceField || !mappedTargetField) continue;
      const sourceField = sourceFieldNameMap.get(mappedSourceField.name);
      const targetField = targetFieldNameMap.get(mappedTargetField.name);
      if (!sourceField || !targetField) continue;
      if (!(sourceField.id in sourceRecordValues)) continue;
      const mappedVal = this.mapSelectValueBetweenFields(
        sourceRecordValues[sourceField.id],
        sourceField,
        targetField
      );
      targetValues[targetField.id] = mappedVal;
    }

    if (Object.keys(targetValues).length === 0) {
      console.log('?? NO VALUES TO SYNC: No valid mappings after resolution');
      return;
    }

    targetValues['_source_record_id'] = masterRecordId;

    // Keep masterlist canonical before touching copies
    const masterlistFields = await this.getFields(masterlistTableId);
    await this.syncMasterlistWithTable(masterRecordId, targetTableId, masterlistTableId, targetValues, targetFields, masterlistFields);

    // Ensure only one copy exists and clean stray copies elsewhere
    await this.removeExistingCopiesForMasterRecord(baseId, masterRecordId, [targetTableId, masterlistTableId]);

    const { data: existingTargetCopiesRaw, error: fetchTargetCopiesError } = await supabase
      .from("records")
      .select("id, values")
      .eq("table_id", targetTableId)
      .eq("values->>_source_record_id", masterRecordId);
    if (fetchTargetCopiesError) throw fetchTargetCopiesError;

    const existingTargetCopies = existingTargetCopiesRaw as Array<{ id: string; values: Record<string, unknown> }> | null;
    let targetCopyId: string | null = null;
    if (existingTargetCopies && existingTargetCopies.length > 0) {
      targetCopyId = existingTargetCopies[0].id as string;
      if (existingTargetCopies.length > 1) {
        const extraIds = existingTargetCopies.slice(1).map((r) => r.id);
        const { error: deleteExtrasError } = await supabase
          .from("records")
          .delete()
          .eq("table_id", targetTableId)
          .in("id", extraIds);
        if (deleteExtrasError) {
          console.error('Failed to delete duplicate target copies during sync', deleteExtrasError);
        }
      }
    }

    if (targetCopyId) {
      const { error: updateCopyError } = await supabase
        .from("records")
        .update({ values: targetValues })
        .eq("id", targetCopyId)
        .eq("table_id", targetTableId);
      if (updateCopyError) throw updateCopyError;
    } else {
      const { error: createCopyError } = await supabase
        .from("records")
        .insert({ table_id: targetTableId, values: targetValues });
      if (createCopyError) throw createCopyError;
    }

    await this.pruneDuplicateCopies(targetTableId, masterRecordId);
  }

  static async executeShowInTable(
    recordId: string,
    action: AutomationAction,
    targetTableId: string,
    masterlistTableId: string
  ): Promise<void> {
    void masterlistTableId;
    // For show_in_table, we create a record that links back to the original
    // This is useful for creating views or filtered displays

    const { data: sourceRecord, error: fetchError } = await supabase
      .from("records")
      .select("values")
      .eq("id", recordId)
      .single();

    if (fetchError) throw fetchError;

    // Map field values
    const targetValues: Record<string, unknown> = {};

    for (const mapping of action.field_mappings) {
      const sourceValue = sourceRecord.values[mapping.source_field_id];
      targetValues[mapping.target_field_id] = sourceValue;
    }

    // Add a reference to the original record
    targetValues['_source_record_id'] = recordId;

    await this.createRecord(targetTableId, targetValues);
  }

  // Check and execute automations for a record update
  static async checkAndExecuteAutomations(
    tableId: string,
    recordId: string,
    newValues?: Record<string, unknown>,
    fullRecordValues?: Record<string, unknown>
  ): Promise<void> {
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("base_id, name, is_master_list")
      .eq("id", tableId)
      .single();

    if (tableError || !table) {
      console.error('Automation check aborted: table not found', tableError);
      return;
    }

    const baseId = table.base_id;
    const tableName = table.name;
    const isMasterlist = table.is_master_list;

    // Get all automations for this base (cached)
    const allAutomations = await this.getAutomations(baseId);
    console.log('AUTOMATION DEBUG: total automations for base', baseId, allAutomations.length);

    // Get list of changed field IDs (if newValues provided)
    const changedFieldIds = newValues ? Object.keys(newValues) : [];

    // If we have changed fields, get their metadata and mapped values for quick compare
    const changedFieldNames = new Set<string>();
    const changedFieldMeta = new Map<string, { name: string; type?: string | null; options?: Record<string, { name?: string }> | null }>();
    const changedFieldDisplay = new Map<string, string | unknown>();
    if (changedFieldIds.length > 0) {
      const { data: changedFields } = await supabase
        .from("fields")
        .select("id, name, type, options")
        .in("id", changedFieldIds);
      if (changedFields) {
        for (const field of changedFields) {
          changedFieldNames.add(field.name);
          changedFieldMeta.set(field.id, { name: field.name, type: field.type, options: field.options as Record<string, { name?: string }> | null });
          const rawVal = newValues?.[field.id];
          const mapped = this.mapSelectValueBetweenFields(rawVal, field, field);
          if (typeof rawVal === 'string' && rawVal.startsWith('option_') && field.options && (field.options as any)[rawVal]?.name) {
            changedFieldDisplay.set(field.id, (field.options as any)[rawVal].name);
          } else if (typeof rawVal === 'string' && field.options && (field.options as any)[rawVal]?.name) {
            // Fallback: option key is not prefixed, but options map contains a display name
            changedFieldDisplay.set(field.id, (field.options as any)[rawVal].name);
          } else {
            changedFieldDisplay.set(field.id, mapped);
          }
        }
      }
    }
    console.log('AUTOMATION DEBUG: change context', {
      table: tableName,
      changedFieldIds,
      changedFieldNames: Array.from(changedFieldNames),
      newValues
    });

    // Filter automations that apply to this table/record AND trigger field
    const applicabilityDebug: Array<{ id: string; name: string; reason: string }> = [];
    const applicableAutomations = allAutomations.filter((automation) => {
      if (!automation.enabled) {
        applicabilityDebug.push({ id: automation.id, name: automation.name, reason: 'disabled' });
        return false;
      }

      const triggerTableName = automation.trigger?.table_name?.trim();
      const normalizedTriggerTable = triggerTableName?.toLowerCase();
      const normalizedCurrentTable = tableName.toLowerCase();

      // If a table is specified, require it to match. If none is specified, allow base-wide execution (field check below still applies).
      if (normalizedTriggerTable) {
        if (normalizedTriggerTable !== normalizedCurrentTable) {
          applicabilityDebug.push({ id: automation.id, name: automation.name, reason: `table mismatch (${normalizedTriggerTable} != ${normalizedCurrentTable})` });
          return false;
        }
      }

      if (automation.trigger?.type === 'field_change') {
        if (changedFieldIds.length === 0) {
          applicabilityDebug.push({ id: automation.id, name: automation.name, reason: 'no changed fields for field_change trigger' });
          return false;
        }
        const triggerFieldId = automation.trigger?.field_id;
        const triggerFieldName = automation.trigger?.field_name;

        const normalizedTriggerFieldName = triggerFieldName?.trim().toLowerCase();
        const normalizedChangedFieldNames = new Set(Array.from(changedFieldNames).map(n => n.trim().toLowerCase()));

        const fieldIdMatches = !!(triggerFieldId && changedFieldIds.includes(triggerFieldId));
        const fieldNameMatches = !!(normalizedTriggerFieldName && normalizedChangedFieldNames.has(normalizedTriggerFieldName));

        // Prefer field name matching across tables; fall back to explicit field id
        if (!fieldIdMatches && !fieldNameMatches) {
          applicabilityDebug.push({ id: automation.id, name: automation.name, reason: `field mismatch (trigger id/name: ${triggerFieldId || 'n/a'}/${triggerFieldName || 'n/a'}; changed names: ${Array.from(changedFieldNames).join(',')})` });
          return false;
        }

        // Quick value pre-check for equals operator if we have the raw new value
        if (automation.trigger?.condition?.operator === 'equals' && newValues) {
          const triggerVal = automation.trigger.condition.value;
          const triggerValNormalized = typeof triggerVal === 'string' ? triggerVal.toLowerCase() : triggerVal;

          // Resolve the field id we should compare: prefer name match, then explicit id; otherwise fall back to any changed field
          let compareFieldId: string | undefined;
          if (fieldNameMatches && normalizedTriggerFieldName) {
            const match = Array.from(changedFieldMeta.entries()).find(([, meta]) => meta.name.trim().toLowerCase() === normalizedTriggerFieldName);
            compareFieldId = match?.[0];
          }
          if (!compareFieldId && fieldIdMatches && triggerFieldId) {
            compareFieldId = triggerFieldId;
          }

          const candidateFieldIds = compareFieldId ? [compareFieldId] : changedFieldIds;
          let conditionMet = false;
          let lastCompared: unknown = undefined;

          for (const fid of candidateFieldIds) {
            const maybeRaw = newValues[fid];
            const maybeDisplay = changedFieldDisplay.get(fid);
            let compareValue = typeof maybeDisplay === 'string' ? maybeDisplay : maybeRaw;
            const meta = changedFieldMeta.get(fid);
            const optionsMap = meta?.options as Record<string, { name?: string; label?: string }> | undefined;

            // For selects, if compareValue is an option key present in options, use its display name/label
            if (optionsMap && typeof compareValue === 'string') {
              const opt = optionsMap[compareValue];
              if (opt?.name || opt?.label) {
                compareValue = opt.name || opt.label || compareValue;
              }
            }
            lastCompared = compareValue;

            // Normalize strings for safer comparison (trim/lowercase)
            const normalize = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : v;
            const normalizedCompare = normalize(compareValue);
            const normalizedTrigger = normalize(triggerValNormalized);

            // If value is an option_* id and we have a display label, prefer the display label
            const matches =
              normalizedCompare === normalizedTrigger ||
              (typeof compareValue === 'string' && compareValue.toLowerCase() === normalizedTrigger);

            console.log('AUTOMATION DEBUG: equals check', {
              automationId: automation.id,
              automationName: automation.name,
              fieldId: fid,
              triggerValue: triggerVal,
              triggerValueNormalized: normalizedTrigger,
              compareValue,
              normalizedCompare,
              matches
            });

            if (matches) {
              conditionMet = true;
              break;
            }
          }

          if (!conditionMet) {
            applicabilityDebug.push({ id: automation.id, name: automation.name, reason: `condition not met (expected ${triggerValNormalized}, got ${lastCompared})` });
            return false;
          }
        }
      }

      applicabilityDebug.push({ id: automation.id, name: automation.name, reason: 'applicable' });
      return true;
    });

    if (applicableAutomations.length === 0) {
      console.log('AUTOMATION DEBUG: no applicable automations for table', tableId, 'record', recordId, 'changed fields', changedFieldIds, 'reasons', JSON.stringify(applicabilityDebug));
      return;
    }

    console.log('AUTOMATION DEBUG: applicable automations', applicableAutomations.map(a => ({ id: a.id, name: a.name, action: a.action?.type, target: a.action?.target_table_name, triggerTable: a.trigger?.table_name, triggerField: a.trigger?.field_name || a.trigger?.field_id })));

    let recordWasMoved = false;
    let newTableId = tableId;

    for (const automation of applicableAutomations) {
      try {
        const valuesForExecution = fullRecordValues || newValues;
        await this.executeAutomation(automation, recordId, valuesForExecution, baseId, tableId);

        const { data: recordAfter, error: recordAfterError } = await supabase
          .from("records")
          .select("table_id")
          .eq("id", recordId)
          .maybeSingle();
        if (recordAfterError && recordAfterError.code !== 'PGRST116') {
          console.error('Failed to read record after automation (tolerating):', recordAfterError);
        }

        const tableAfter = recordAfter?.table_id;
        if (tableAfter && tableAfter !== newTableId) {
          recordWasMoved = true;
          newTableId = tableAfter;
        }
      } catch (error) {
        console.error(`Automation error: ${automation.name} (${automation.id})`, error);
      }
    }

    // After forward automations, check for reverse automations (undo moves when condition is no longer met)
    // Only check if record was NOT moved by a forward automation (to prevent immediate reversal)
    // Also only check automations that have "move_to_table" action and the record is in their target table
    if (!recordWasMoved) {
      // Get current table name (in case it changed)
      const { data: currentTable } = await supabase
        .from("tables")
        .select("name")
        .eq("id", newTableId)
        .single();
      const currentTableName = currentTable?.name || tableName;

      for (const automation of allAutomations) {
        if (!automation.enabled || automation.action.type !== 'move_to_table') {
          continue;
        }
        if (automation.action.target_table_name === currentTableName) {
          const shouldReverse = await this.shouldReverseAutomation(automation, recordId, newValues, baseId, newTableId);
          if (shouldReverse) {
            try {
              await this.reverseMoveAutomation(automation, recordId, baseId, newTableId);
            } catch (error) {
              console.error(`Reverse automation error: ${automation.name}`, error);
            }
          }
        }
      }
    }
  }  static async shouldReverseAutomation(
    automation: Automation,
    recordId: string,
    newValues: Record<string, unknown> | undefined,
    baseId: string,
    currentTableId: string
  ): Promise<boolean> {
    const trigger = automation.trigger;
    
    // Only reverse field_change triggers with conditions
    if (trigger.type !== 'field_change' || !trigger.condition) {
      return false;
    }
    
    // Get current record values
    const { data: record, error: fetchError } = await supabase
      .from("records")
      .select("values, table_id")
      .eq("id", recordId)
      .single();

    if (fetchError) {
      return false;
    }

    // Merge newValues with record values
    const currentRecordValues = newValues ? { ...record.values, ...newValues } : record.values;

    // Get masterlist table
    const { data: masterlistTable } = await supabase
      .from("tables")
      .select("id")
      .eq("base_id", baseId)
      .eq("is_master_list", true)
      .single();

    const masterlistTableId = masterlistTable?.id;

    // Find the field to check
    const triggerFieldName = trigger.field_name;
    const triggerFieldId = trigger.field_id;
    
    if (!triggerFieldName && !triggerFieldId) {
      return false;
    }

    // Determine which table to check the field in
    const tableToCheck = (record.table_id === masterlistTableId && currentTableId !== masterlistTableId)
      ? currentTableId
      : record.table_id;

    // Find the field with robust fallback logic (same as executeAutomation)
    let fieldIdToCheck: string | undefined;
    let currentValue: unknown;

    if (triggerFieldName) {
      const { data: matchingFields } = await supabase
        .from("fields")
        .select("id")
        .eq("table_id", tableToCheck)
        .eq("name", triggerFieldName)
        .limit(1);

      if (matchingFields && matchingFields.length > 0) {
        fieldIdToCheck = matchingFields[0].id;
        if (fieldIdToCheck) {
          currentValue = currentRecordValues[fieldIdToCheck];
        }
        
        // If value is null/undefined and record is in masterlist, try masterlist field ID
        if ((currentValue === null || currentValue === undefined) && record.table_id === masterlistTableId) {
          const { data: masterlistFields } = await supabase
            .from("fields")
            .select("id")
            .eq("table_id", masterlistTableId)
            .eq("name", triggerFieldName)
            .limit(1);
          
          if (masterlistFields && masterlistFields.length > 0) {
            const masterlistFieldId = masterlistFields[0].id;
            const masterlistValue = currentRecordValues?.[masterlistFieldId];
            if (masterlistValue !== null && masterlistValue !== undefined) {
              fieldIdToCheck = masterlistFieldId;
              currentValue = masterlistValue;
            }
          }
        }
        
        // If still null/undefined, try to find any field with the same name that exists in record values
        // Include empty string values - they're valid and should be checked
        if ((currentValue === null || currentValue === undefined) && currentRecordValues) {
          const { data: allFieldsWithName } = await supabase
            .from("fields")
            .select("id, table_id")
            .eq("name", triggerFieldName);
          
          if (allFieldsWithName) {
            // Try each field ID to see if it exists in record values (including empty string)
            for (const field of allFieldsWithName) {
              if (field.id in currentRecordValues) {
                const value = currentRecordValues[field.id];
                // Accept any value including null, undefined, or empty string
                fieldIdToCheck = field.id;
                currentValue = value; // This could be null, undefined, or ''
                break;
              }
            }
          }
        }
      }
    } else if (triggerFieldId) {
      fieldIdToCheck = triggerFieldId;
      currentValue = currentRecordValues[triggerFieldId];
      
      // If value not found, try to find by field name
      if (currentValue === undefined || currentValue === null) {
        const { data: triggerField } = await supabase
          .from("fields")
          .select("id, name, table_id")
          .eq("id", triggerFieldId)
          .single();

        if (triggerField) {
          const needsLookup = triggerField.table_id !== tableToCheck;
          
          if (needsLookup) {
            const { data: matchingFields } = await supabase
              .from("fields")
              .select("id")
              .eq("table_id", tableToCheck)
              .eq("name", triggerField.name)
              .limit(1);
            
            if (matchingFields && matchingFields.length > 0) {
              fieldIdToCheck = matchingFields[0].id;
              if (fieldIdToCheck && currentRecordValues) {
                currentValue = currentRecordValues[fieldIdToCheck];
              }
            }
          }
        }
      }
    }

    if (!fieldIdToCheck) {
      console.log('⚠️ REVERSE CHECK: Could not find field, skipping reverse:', {
        fieldName: triggerFieldName,
        fieldId: triggerFieldId,
        tableToCheck,
        recordTableId: record.table_id
      });
      return false;
    }
    
    // Allow empty/null values to be checked - if value is empty and condition requires a specific value,
    // then condition is NOT met and we should reverse
    // Only skip if we truly couldn't find the field ID
    if (currentValue === undefined) {
      // Field exists but value is undefined - treat as empty and check condition
      currentValue = null;
      console.log('⚠️ REVERSE CHECK: Field value is undefined, treating as empty/null for condition check');
    }

    // Check if condition is NOT met (should reverse)
    const triggerValue = trigger.condition.value;
    let conditionMet = false;
    let currentValueToCheck = currentValue;
    let normalizedCurrentValue = '';
    const normalizedTriggerValue = String(triggerValue || '');

    // Handle single_select fields
    if (fieldIdToCheck) {
      const { data: field } = await supabase
        .from("fields")
        .select("type, options")
        .eq("id", fieldIdToCheck)
        .single();

      // Handle empty/null values - convert to empty string for comparison
      if (currentValue === null || currentValue === undefined || currentValue === '') {
        currentValueToCheck = '';
      } else if (field && field.type === 'single_select' && field.options) {
        const options = field.options as Record<string, { name?: string; label?: string; color: string }>;
        if (String(currentValue).startsWith('option_')) {
          const optionData = options[String(currentValue)];
          if (optionData) {
            currentValueToCheck = optionData.name || optionData.label || '';
          } else {
            // Option ID not found in options, treat as empty
            currentValueToCheck = '';
          }
        }
      }

      // Normalize both values to strings for comparison
      normalizedCurrentValue = String(currentValueToCheck || '');

      switch (trigger.condition.operator) {
        case 'equals':
          conditionMet = normalizedCurrentValue === normalizedTriggerValue;
          break;
        case 'not_equals':
          conditionMet = normalizedCurrentValue !== normalizedTriggerValue;
          break;
        case 'contains':
          conditionMet = normalizedCurrentValue.includes(normalizedTriggerValue);
          break;
        case 'greater_than':
          conditionMet = Number(normalizedCurrentValue) > Number(normalizedTriggerValue);
          break;
        case 'less_than':
          conditionMet = Number(normalizedCurrentValue) < Number(normalizedTriggerValue);
          break;
        case 'greater_than_or_equal':
          conditionMet = Number(normalizedCurrentValue) >= Number(normalizedTriggerValue);
          break;
        case 'less_than_or_equal':
          conditionMet = Number(normalizedCurrentValue) <= Number(normalizedTriggerValue);
          break;
      }
    }

    // Reverse if condition is NOT met
    const shouldReverse = !conditionMet;
    console.log('🔍 REVERSE CHECK RESULT:', {
      automationName: automation.name,
      fieldName: triggerFieldName,
      currentValue: currentValue,
      currentValueToCheck: currentValueToCheck,
      normalizedCurrentValue: normalizedCurrentValue,
      triggerValue: triggerValue,
      normalizedTriggerValue: normalizedTriggerValue,
      operator: trigger.condition.operator,
      conditionMet,
      shouldReverse
    });
    return shouldReverse;
  }

  // Reverse a move automation (move record back to source)
  static async reverseMoveAutomation(
    automation: Automation,
    recordId: string,
    baseId: string,
    currentTableId: string
  ): Promise<void> {
    void currentTableId;
    console.log(`↩️ REVERSING MOVE: ${automation.name} for record ${recordId}`);
    
    // Get masterlist table
    const { data: masterlistTable } = await supabase
      .from("tables")
      .select("id")
      .eq("base_id", baseId)
      .eq("is_master_list", true)
      .single();

    if (!masterlistTable) {
      throw new Error('Masterlist table not found');
    }

    const masterlistTableId = masterlistTable.id;

    // Determine source table from automation trigger
    // If trigger has table_name, use that; otherwise use masterlist as default
    const triggerTableName = automation.trigger.table_name;
    let sourceTableId: string | undefined;

    if (triggerTableName && triggerTableName.trim() !== '') {
      const { data: sourceTable } = await supabase
        .from("tables")
        .select("id")
        .eq("base_id", baseId)
        .eq("name", triggerTableName)
        .single();
      
      if (sourceTable) {
        sourceTableId = sourceTable.id;
      }
    }

    // Default to masterlist if no specific source table
    if (!sourceTableId) {
      sourceTableId = masterlistTableId;
    }

    // Get current record
    const { data: currentRecord, error: fetchError } = await supabase
      .from("records")
      .select("table_id, values")
      .eq("id", recordId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Only reverse if record is currently in the target table
    const targetTableName = automation.action.target_table_name;
    const { data: targetTable } = await supabase
      .from("tables")
      .select("id, name")
      .eq("base_id", baseId)
      .eq("name", targetTableName)
      .single();

    if (!targetTable || currentRecord.table_id !== targetTable.id) {
      console.log('⚠️ Record is not in target table, skipping reverse');
      return;
    }

    console.log(`↩️ Moving record from ${targetTable.name} back to source table`);

    // Move record back to source table
    const { error: moveError } = await supabase
      .from("records")
      .update({ table_id: sourceTableId })
      .eq("id", recordId)
      .eq("table_id", targetTable.id);

    if (moveError) {
      throw moveError;
    }

    console.log(`✅ Record moved back to source table`);

    // Sync masterlist with current values
    if (sourceTableId && sourceTableId !== masterlistTableId) {
      await this.syncMasterlistWithTable(recordId, sourceTableId, masterlistTableId, currentRecord.values);
    }
  }
}







