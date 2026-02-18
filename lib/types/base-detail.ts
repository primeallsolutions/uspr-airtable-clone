export type SupabaseUser = {
  id: string;
  email?: string;
};

export type BaseRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  workspace_id: string;
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

// ============================================
// Record Email Types
// ============================================

export type EmailDirection = 'inbound' | 'outbound';

export type EmailStatus = 
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'bounced' 
  | 'opened' 
  | 'clicked';

export type EmailRecipient = {
  email: string;
  name?: string;
};

export type EmailAttachment = {
  filename: string;
  content_type: string;
  size: number;
  url?: string; // URL to download attachment
  storage_path?: string; // Supabase storage path
  document_id?: string; // Reference to record document
  checksum?: string;
};

export type RecordEmail = {
  id: string;
  record_id: string;
  direction: EmailDirection;
  from_email: string;
  from_name?: string;
  to_email: string;
  to_name?: string;
  cc_emails?: EmailRecipient[];
  bcc_emails?: EmailRecipient[];
  subject?: string;
  body_text?: string;
  body_html?: string;
  message_id?: string;
  in_reply_to?: string;
  thread_id?: string;
  attachments?: EmailAttachment[];
  status: EmailStatus;
  sent_by?: string;
  read_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Tracking fields
  opened_at?: string;
  open_count?: number;
  clicked_at?: string;
  click_count?: number;
  link_clicks?: Array<{ url: string; clicked_at: string }>;
  attachment_count?: number;
  template_id?: string;
};

export type RecordEmailAddress = {
  id: string;
  record_id: string;
  email_address: string;
  is_active: boolean;
  created_at: string;
};

export type SendEmailPayload = {
  record_id: string;
  to: string;
  to_name?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  in_reply_to?: string;
  template_id?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded content
    content_type: string;
    document_id?: string; // If from record documents
    storage_path?: string; // Path in storage
  }>;
};

export type InboundEmailPayload = {
  from: string;
  from_name?: string;
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
  in_reply_to?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    content?: string; // Base64 encoded
  }>;
  headers?: Record<string, string>;
};

// ============================================
// Email Template Types
// ============================================

export type EmailTemplateCategory = 
  | 'general' 
  | 'follow-up' 
  | 'outreach' 
  | 'welcome' 
  | 'reminder' 
  | 'notification' 
  | 'custom';

export type EmailTemplate = {
  id: string;
  workspace_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  category: EmailTemplateCategory;
  placeholders: string[]; // Array of placeholder names
  is_default: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type CreateEmailTemplatePayload = {
  workspace_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  category?: EmailTemplateCategory;
  is_default?: boolean;
};

export type UpdateEmailTemplatePayload = {
  name?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  category?: EmailTemplateCategory;
  is_default?: boolean;
  is_active?: boolean;
};

// ============================================
// Email Event Types (Tracking)
// ============================================

export type EmailEventType = 
  | 'sent' 
  | 'delivered' 
  | 'opened' 
  | 'clicked' 
  | 'bounced' 
  | 'complained' 
  | 'failed';

export type EmailEvent = {
  id: string;
  email_id: string;
  event_type: EmailEventType;
  event_data: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  location?: {
    city?: string;
    country?: string;
    region?: string;
  };
  created_at: string;
};

export type EmailStats = {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  open_rate: number; // Percentage
  click_rate: number; // Percentage
};

// ============================================
// Email Attachment Types (Extended)
// ============================================

export type EmailAttachmentRecord = {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  size: number;
  storage_path?: string;
  document_id?: string;
  checksum?: string;
  created_at: string;
};

export type AttachmentForSending = {
  filename: string;
  content: string; // Base64 encoded
  content_type: string;
  size: number;
  document_id?: string;
  storage_path?: string;
};

// System placeholders available in templates
export const SYSTEM_PLACEHOLDERS = [
  'record_name',
  'record_email', 
  'record_id',
  'sender_name',
  'date',
  'time',
  'company_name',
] as const;

export type SystemPlaceholder = typeof SYSTEM_PLACEHOLDERS[number];
