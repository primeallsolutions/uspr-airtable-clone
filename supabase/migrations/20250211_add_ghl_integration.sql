-- Migration: Add Go High Level integration tables
-- Date: 2025-02-11
-- Note: No RLS policies - Supabase is used for data storage and auth only

-- Create ghl_integrations table
CREATE TABLE IF NOT EXISTS public.ghl_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_id uuid NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  location_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamp with time zone,
  webhook_id text,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  ghl_field_names jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_private_integration boolean NOT NULL DEFAULT true,
  CONSTRAINT ghl_integrations_base_id_unique UNIQUE(base_id)
);

-- Create index on location_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_location_id ON public.ghl_integrations(location_id);

-- Create index on base_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_base_id ON public.ghl_integrations(base_id);

-- Create ghl_sync_logs table
CREATE TABLE IF NOT EXISTS public.ghl_sync_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid NOT NULL REFERENCES public.ghl_integrations(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message text,
  synced_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index on integration_id for filtering logs
CREATE INDEX IF NOT EXISTS idx_ghl_sync_logs_integration_id ON public.ghl_sync_logs(integration_id);

-- Create index on contact_id for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_ghl_sync_logs_contact_id ON public.ghl_sync_logs(contact_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_ghl_sync_logs_created_at ON public.ghl_sync_logs(created_at DESC);
