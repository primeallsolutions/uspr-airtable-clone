-- Migration: Create GHL sync trigger webhooks system
-- Date: 2025-02-15
-- Description: Add sync trigger webhooks table for server-side GHL sync triggering

-- Create ghl_sync_trigger_webhooks table
CREATE TABLE public.ghl_sync_trigger_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  name text NOT NULL,
  secret_token text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_triggered_at timestamp with time zone,
  total_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  
  -- Ensure base has GHL integration
  CONSTRAINT fk_base_has_ghl_integration FOREIGN KEY (base_id)
    REFERENCES public.bases(id) ON DELETE CASCADE
);

-- Create index for fast lookups by secret token
CREATE UNIQUE INDEX idx_ghl_sync_trigger_webhooks_secret_token 
  ON public.ghl_sync_trigger_webhooks(secret_token);
CREATE INDEX idx_ghl_sync_trigger_webhooks_base_id 
  ON public.ghl_sync_trigger_webhooks(base_id);

COMMENT ON TABLE public.ghl_sync_trigger_webhooks IS 
  'Trigger webhooks for initiating GHL sync operations from external services';
COMMENT ON COLUMN public.ghl_sync_trigger_webhooks.secret_token IS 
  'Unique authentication token for webhook endpoint';
COMMENT ON COLUMN public.ghl_sync_trigger_webhooks.is_enabled IS 
  'Whether this trigger webhook is active';
COMMENT ON COLUMN public.ghl_sync_trigger_webhooks.last_triggered_at IS 
  'Timestamp of last webhook trigger';

-- Extend webhook_logs table to support both webhook types
-- Make webhook_id nullable so it can reference either webhooks or ghl_sync_trigger_webhooks
ALTER TABLE public.webhook_logs 
  ALTER COLUMN webhook_id DROP NOT NULL;

-- Add optional reference to ghl_sync_trigger_webhooks
ALTER TABLE public.webhook_logs 
  ADD COLUMN ghl_sync_trigger_webhook_id uuid REFERENCES public.ghl_sync_trigger_webhooks(id) ON DELETE CASCADE;

-- Add index for ghl_sync_trigger_webhook_id
CREATE INDEX idx_webhook_logs_ghl_sync_trigger_webhook_id 
  ON public.webhook_logs(ghl_sync_trigger_webhook_id);

-- Add check to ensure one of the webhook references is set
ALTER TABLE public.webhook_logs 
  ADD CONSTRAINT chk_webhook_logs_reference 
  CHECK (
    (webhook_id IS NOT NULL AND ghl_sync_trigger_webhook_id IS NULL) OR
    (webhook_id IS NULL AND ghl_sync_trigger_webhook_id IS NOT NULL)
  );

COMMENT ON COLUMN public.webhook_logs.ghl_sync_trigger_webhook_id IS 
  'Reference to GHL sync trigger webhook (mutually exclusive with webhook_id)';

-- Add updated_at trigger for ghl_sync_trigger_webhooks
CREATE OR REPLACE FUNCTION update_ghl_sync_trigger_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ghl_sync_trigger_webhook_updated_at
  BEFORE UPDATE ON public.ghl_sync_trigger_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_sync_trigger_webhook_updated_at();
