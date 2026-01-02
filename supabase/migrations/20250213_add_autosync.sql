-- Migration: Add auto-sync support to GHL integrations
-- Date: 2025-02-13
-- Description: Add columns to enable automatic background syncing of GHL data

-- Add auto-sync columns to ghl_integrations table
ALTER TABLE public.ghl_integrations 
ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_sync_interval_minutes integer DEFAULT 15 CHECK (auto_sync_interval_minutes IN (1, 5, 15, 30, 60)),
ADD COLUMN IF NOT EXISTS last_auto_sync_at timestamp with time zone;

-- Add comments for documentation
COMMENT ON COLUMN public.ghl_integrations.auto_sync_enabled IS 'Enable automatic background sync when base is open';
COMMENT ON COLUMN public.ghl_integrations.auto_sync_interval_minutes IS 'Auto-sync interval in minutes (1, 5, 15, 30, 60)';
COMMENT ON COLUMN public.ghl_integrations.last_auto_sync_at IS 'Timestamp of last automatic sync';

