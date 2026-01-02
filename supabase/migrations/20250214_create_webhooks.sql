-- Migration: Create incoming webhooks system
-- Date: 2025-02-14
-- Description: Add webhooks table and webhook_logs table for receiving data from external services

-- Create webhooks table
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  name text NOT NULL,
  secret_token text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  default_table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  field_mapping jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_triggered_at timestamp with time zone,
  total_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0
);

-- Create index for fast lookups by secret token
CREATE UNIQUE INDEX idx_webhooks_secret_token ON public.webhooks(secret_token);
CREATE INDEX idx_webhooks_base_id ON public.webhooks(base_id);

COMMENT ON TABLE public.webhooks IS 'Incoming webhooks for receiving data from external services';

-- Create webhook_logs table for tracking calls
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  request_payload jsonb NOT NULL,
  response_status integer NOT NULL,
  error_message text,
  record_id uuid REFERENCES public.records(id) ON DELETE SET NULL,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for efficient log queries
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Auto-delete old logs (keep last 30 days)
CREATE OR REPLACE FUNCTION delete_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webhook_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.webhook_logs IS 'Logs of all webhook calls for debugging and monitoring';

