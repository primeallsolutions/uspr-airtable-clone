-- Migration: Email Feature Enhancements
-- Description: Adds email templates, attachments tracking, and email event tracking
-- Features: Templates with placeholders, attachment support, read receipts and tracking

-- ============================================
-- 1. Email Templates Table
-- Workspace-level email templates with variable placeholders
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  category text DEFAULT 'general' CHECK (category IN ('general', 'follow-up', 'outreach', 'welcome', 'reminder', 'notification', 'custom')),
  placeholders jsonb DEFAULT '[]', -- Array of placeholder names used in template
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_id ON public.email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON public.email_templates(is_active);

-- Updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trigger_update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- ============================================
-- 2. Email Tracking Columns
-- Add tracking columns to record_emails for open/click tracking
-- ============================================
ALTER TABLE public.record_emails
  ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_clicks jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS attachment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;

-- Index for template reference
CREATE INDEX IF NOT EXISTS idx_record_emails_template_id ON public.record_emails(template_id);

-- ============================================
-- 3. Email Events Table
-- Detailed tracking of all email events (opens, clicks, bounces, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id uuid NOT NULL REFERENCES public.record_emails(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  event_data jsonb DEFAULT '{}', -- Additional event metadata (link URL for clicks, error for bounces, etc.)
  ip_address text,
  user_agent text,
  location jsonb DEFAULT '{}', -- Geo data if available
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for email events
CREATE INDEX IF NOT EXISTS idx_email_events_email_id ON public.email_events(email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON public.email_events(created_at DESC);

-- ============================================
-- 4. Email Attachments Table
-- Track attachments sent with emails
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id uuid NOT NULL REFERENCES public.record_emails(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size integer NOT NULL, -- Size in bytes
  storage_path text, -- Path in Supabase storage (for stored attachments)
  document_id uuid, -- Reference to record document if attached from there
  checksum text, -- MD5 or SHA hash for integrity
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for email attachments
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON public.email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_document_id ON public.email_attachments(document_id);

-- ============================================
-- 5. Comments for Documentation
-- ============================================
COMMENT ON TABLE public.email_templates IS 'Workspace-level email templates with variable placeholders';
COMMENT ON TABLE public.email_events IS 'Detailed tracking of email events (opens, clicks, bounces)';
COMMENT ON TABLE public.email_attachments IS 'Tracks attachments sent with emails';

COMMENT ON COLUMN public.email_templates.placeholders IS 'JSON array of placeholder names used in template, e.g. ["record_name", "field:Email"]';
COMMENT ON COLUMN public.email_templates.category IS 'Template category for organization';

COMMENT ON COLUMN public.record_emails.opened_at IS 'Timestamp of first email open';
COMMENT ON COLUMN public.record_emails.open_count IS 'Number of times email was opened';
COMMENT ON COLUMN public.record_emails.clicked_at IS 'Timestamp of first link click';
COMMENT ON COLUMN public.record_emails.click_count IS 'Number of link clicks';
COMMENT ON COLUMN public.record_emails.link_clicks IS 'JSON array of clicked links with timestamps';
COMMENT ON COLUMN public.record_emails.template_id IS 'Reference to template used for this email';

COMMENT ON COLUMN public.email_events.event_type IS 'Type of email event: sent, delivered, opened, clicked, bounced, complained, failed';
COMMENT ON COLUMN public.email_events.event_data IS 'Additional event metadata like link URL, error message, etc.';

COMMENT ON COLUMN public.email_attachments.storage_path IS 'Path in Supabase storage bucket for stored attachments';
COMMENT ON COLUMN public.email_attachments.document_id IS 'Reference to record document if attachment came from document storage';

-- ============================================
-- 6. RPC Functions for Tracking Updates
-- ============================================

-- Function to increment email open count
CREATE OR REPLACE FUNCTION increment_email_open_count(email_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.record_emails
  SET open_count = COALESCE(open_count, 0) + 1
  WHERE id = email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment email click count
CREATE OR REPLACE FUNCTION increment_email_click_count(email_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.record_emails
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a link click to the link_clicks array
CREATE OR REPLACE FUNCTION add_email_link_click(email_id uuid, link_url text)
RETURNS void AS $$
BEGIN
  UPDATE public.record_emails
  SET link_clicks = COALESCE(link_clicks, '[]'::jsonb) || jsonb_build_object(
    'url', link_url,
    'clicked_at', now()
  )
  WHERE id = email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
