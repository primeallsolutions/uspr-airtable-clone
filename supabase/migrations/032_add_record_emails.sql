-- Migration: Add Record Emails System
-- Description: Creates tables for storing emails linked to records
-- This enables bi-directional email communication tied to database records

-- ============================================
-- 1. Create record_emails table
-- Stores all emails (both sent and received) associated with records
-- ============================================
CREATE TABLE IF NOT EXISTS public.record_emails (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id uuid NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  to_name text,
  cc_emails jsonb DEFAULT '[]', -- Array of {email, name} objects
  bcc_emails jsonb DEFAULT '[]', -- Array of {email, name} objects
  subject text,
  body_text text,
  body_html text,
  message_id text, -- Resend message ID or inbound email ID
  in_reply_to text, -- For threading - references parent message_id
  thread_id text, -- Groups related emails together
  attachments jsonb DEFAULT '[]', -- Array of attachment metadata
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
  sent_by uuid REFERENCES public.profiles(id), -- User who sent (for outbound)
  read_at timestamp with time zone, -- When the email was read (for inbound)
  metadata jsonb DEFAULT '{}', -- Additional metadata (headers, etc.)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_record_emails_record_id ON public.record_emails(record_id);
CREATE INDEX IF NOT EXISTS idx_record_emails_message_id ON public.record_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_record_emails_thread_id ON public.record_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_record_emails_direction ON public.record_emails(direction);
CREATE INDEX IF NOT EXISTS idx_record_emails_created_at ON public.record_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_emails_status ON public.record_emails(status);

-- ============================================
-- 2. Create record_email_addresses table
-- Maps unique email addresses to records for inbound email routing
-- ============================================
CREATE TABLE IF NOT EXISTS public.record_email_addresses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id uuid NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  email_address text NOT NULL UNIQUE, -- e.g., "rec_abc123@inbound.allprimesolutions.com"
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_record_email_addresses_email ON public.record_email_addresses(email_address);
CREATE INDEX IF NOT EXISTS idx_record_email_addresses_record_id ON public.record_email_addresses(record_id);

-- ============================================
-- 3. Create updated_at trigger for record_emails
-- ============================================
CREATE OR REPLACE FUNCTION update_record_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_record_emails_updated_at ON public.record_emails;
CREATE TRIGGER trigger_update_record_emails_updated_at
  BEFORE UPDATE ON public.record_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_record_emails_updated_at();

-- ============================================
-- 4. Comments for documentation
-- ============================================
COMMENT ON TABLE public.record_emails IS 'Stores all emails (sent and received) associated with records';
COMMENT ON TABLE public.record_email_addresses IS 'Maps unique email addresses to records for inbound email routing';

COMMENT ON COLUMN public.record_emails.direction IS 'Whether email was inbound (received) or outbound (sent)';
COMMENT ON COLUMN public.record_emails.message_id IS 'Unique identifier from Resend or email provider';
COMMENT ON COLUMN public.record_emails.in_reply_to IS 'References parent message for threading';
COMMENT ON COLUMN public.record_emails.thread_id IS 'Groups related emails in a conversation thread';
COMMENT ON COLUMN public.record_emails.attachments IS 'JSON array of attachment metadata objects';
COMMENT ON COLUMN public.record_emails.sent_by IS 'User ID who sent the email (for outbound only)';
COMMENT ON COLUMN public.record_emails.read_at IS 'Timestamp when inbound email was read by user';

COMMENT ON COLUMN public.record_email_addresses.email_address IS 'Unique email address like rec_xyz@inbound.domain.com';
COMMENT ON COLUMN public.record_email_addresses.is_active IS 'Whether this address is active for receiving emails';
