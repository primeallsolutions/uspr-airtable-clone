// ============================================
// Email Feature Types
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

export type EmailEventType = 
  | 'sent' 
  | 'delivered' 
  | 'opened' 
  | 'clicked' 
  | 'bounced' 
  | 'complained' 
  | 'failed';

export type EmailTemplateCategory = 
  | 'general' 
  | 'follow-up' 
  | 'outreach' 
  | 'welcome' 
  | 'reminder' 
  | 'notification' 
  | 'custom';

// ============================================
// Email Recipient Types
// ============================================

export type EmailRecipient = {
  email: string;
  name?: string;
};

// ============================================
// Record Email Types
// ============================================

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
  status: EmailStatus;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
  }>;
  read_at?: string;
  sent_by?: string;
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

// ============================================
// Email Payload Types
// ============================================

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
    document_id?: string;
    storage_path?: string;
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
    content?: string;
  }>;
  headers?: Record<string, string>;
};

// ============================================
// Email Template Types
// ============================================

export type EmailTemplate = {
  id: string;
  workspace_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  category: EmailTemplateCategory;
  placeholders: string[];
  is_default: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// Email Event Types
// ============================================

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
// Email Attachment Types
// ============================================

export type EmailAttachment = {
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

// ============================================
// System Placeholders
// ============================================

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

// ============================================
// Email Feature Configuration
// ============================================

export type EmailConfig = {
  resend_api_key?: string;
  resend_from_email: string;
  resend_inbound_domain: string;
  email_from_name: string;
  webhook_secret?: string;
  max_attachment_size: number; // in bytes
};

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  resend_from_email: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
  resend_inbound_domain: process.env.RESEND_INBOUND_DOMAIN || 'inbound.allprimesolutions.com',
  email_from_name: process.env.EMAIL_FROM_NAME || 'US Prime Realty',
  max_attachment_size: 10 * 1024 * 1024, // 10MB
};
