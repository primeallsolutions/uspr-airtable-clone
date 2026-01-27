-- Email Service Integration
-- This migration documents the email service integration for e-signature requests
-- Note: Email service (Nodemailer) is application-level and doesn't require database changes
-- The existing schema from 015_add_esignature_system.sql already supports email functionality

-- Add comments to document email-related fields
comment on column public.signature_request_signers.email is 'Email address where signature request notifications are sent';
comment on column public.signature_request_signers.status is 'Tracks email delivery: pending -> sent (email sent) -> viewed -> signed/declined';

comment on column public.signature_requests.status is 'Request workflow: draft -> sent (emails sent) -> in_progress -> completed/declined';

-- Ensure all necessary indexes exist for email-related queries
-- (These should already exist from migration 015, but ensuring they're present)

-- Index for querying signers by email (useful for email lookups)
create index if not exists idx_signature_request_signers_email_lookup 
  on public.signature_request_signers(email) 
  where status in ('sent', 'viewed', 'signed', 'declined');

-- Index for finding requests that need email notifications
create index if not exists idx_signature_requests_need_notification
  on public.signature_requests(status, created_at)
  where status in ('sent', 'in_progress');

-- Add a comment documenting the email integration
comment on table public.signature_request_signers is 
  'Signers for signature requests. Email notifications are sent when requests are sent. Uses Nodemailer with Gmail App Password authentication.';




