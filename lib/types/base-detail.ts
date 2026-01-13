export type SupabaseUser = {
  id: string;
  email?: string;
};

export type BaseRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  last_opened_at?: string | null;
};

export type TableRow = {
  id: string;
  base_id: string;
  name: string;
  order_index: number;
  is_master_list: boolean;
};

export type FieldType = 
  // Text Input Types
  | 'text'           // Single Line text
  | 'long_text'      // Multi Line text or Text Box List
  // Numeric Types
  | 'number'         // General numbers
  | 'monetary'       // Currency/money values
  // Date/Time Types
  | 'date'           // Date only
  | 'datetime'       // Date and time
  // Contact Types
  | 'email'          // Email addresses
  | 'phone'          // Phone numbers
  // Selection Types
  | 'single_select'  // Dropdown (Single) - choose one option
  | 'multi_select'   // Dropdown (Multiple) - choose multiple options
  | 'radio_select'   // Radio button selection (single choice)
  | 'checkbox'       // Boolean true/false or multi-checkbox
  // Other Types
  | 'link';          // URL links

export type FieldRow = {
  id: string;
  table_id: string;
  name: string;
  type: FieldType;
  order_index: number;
  options: Record<string, unknown> | null;
};

export type RecordRow = {
  id: string;
  table_id: string;
  values: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export type AutomationTrigger = {
  type: 'field_change' | 'record_created' | 'record_updated';
  table_name?: string; // Optional: if not specified, applies to all tables in base
  field_id?: string; // Deprecated: use field_name instead for cross-table support
  field_name?: string; // Field name (works across all tables with this field name)
  condition?: {
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal';
    value: string | number;
  };
};

export type AutomationAction = {
  type: 'create_record' | 'update_record' | 'copy_fields' | 'copy_to_table' | 'move_to_table' | 'sync_to_table' | 'show_in_table';
  target_table_name: string; // Changed to table name for base-level automations
  field_mappings: Array<{
    source_field_id: string;
    target_field_id: string;
  }>;
  preserve_original?: boolean;
  sync_mode?: 'one_way' | 'two_way';
  duplicate_handling?: 'skip' | 'update' | 'create_new';
  visibility_field_id?: string;
  visibility_value?: string;
  status_field_id?: string; // Field ID that contains the status value
  status_value?: string; // Status value that triggers this automation
};

export type Automation = {
  id: string;
  name: string;
  base_id: string; // Changed from table_id to base_id
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
  created_at: string;
};

export type ViewMode = 'grid' | 'kanban';
export type TopTab = 'data' | 'automations' | 'interfaces' | 'forms' | 'documents';
export type SortDirection = 'asc' | 'desc';

export type Condition = {
  field_id: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
};

export type CreateTableData = {
  name: string;
  base_id: string;
  order_index: number;
};

export type CreateFieldData = {
  name: string;
  type: FieldType;
  table_id: string;
  order_index: number;
  options?: Record<string, unknown>;
};

export type UpdateCellData = {
  recordId: string;
  fieldId: string;
  value: unknown;
};

export type SavingCell = {
  recordId: string;
  fieldId: string;
} | null;
