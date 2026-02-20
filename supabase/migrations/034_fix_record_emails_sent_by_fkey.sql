-- Fix record_emails.sent_by foreign key
-- sent_by stores auth user id; reference auth.users instead of profiles
-- so authenticated users without a profile row can still send emails

ALTER TABLE public.record_emails
DROP CONSTRAINT IF EXISTS record_emails_sent_by_fkey;

ALTER TABLE public.record_emails
ADD CONSTRAINT record_emails_sent_by_fkey
FOREIGN KEY (sent_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
