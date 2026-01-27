-- Migration: Add Meta (Facebook/Instagram) integration tables
-- Date: 2026-01-21
-- Description: User-level OAuth integration for Facebook and Instagram

-- Create meta_integrations table (user-level, not base-level)
CREATE TABLE IF NOT EXISTS public.meta_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'bearer',
  expires_at timestamp with time zone NOT NULL,
  refresh_token text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meta_integrations_user_id_unique UNIQUE(user_id)
);

-- Create index on user_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_meta_integrations_user_id ON public.meta_integrations(user_id);

-- Create meta_connected_accounts table
-- Stores Facebook Pages and Instagram Business accounts
CREATE TABLE IF NOT EXISTS public.meta_connected_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid NOT NULL REFERENCES public.meta_integrations(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  account_id text NOT NULL,
  account_name text NOT NULL,
  account_username text,
  profile_picture_url text,
  access_token text,
  follower_count integer,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meta_connected_accounts_unique UNIQUE(integration_id, platform, account_id)
);

-- Create index on integration_id for filtering accounts by user
CREATE INDEX IF NOT EXISTS idx_meta_connected_accounts_integration_id ON public.meta_connected_accounts(integration_id);

-- Create index on platform for filtering by Facebook/Instagram
CREATE INDEX IF NOT EXISTS idx_meta_connected_accounts_platform ON public.meta_connected_accounts(platform);

-- Create index on account_id for quick account lookups
CREATE INDEX IF NOT EXISTS idx_meta_connected_accounts_account_id ON public.meta_connected_accounts(account_id);

-- Create composite index for active accounts
CREATE INDEX IF NOT EXISTS idx_meta_connected_accounts_active ON public.meta_connected_accounts(integration_id, is_active) WHERE is_active = true;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_meta_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_meta_connected_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-update updated_at
CREATE TRIGGER trigger_meta_integrations_updated_at
  BEFORE UPDATE ON public.meta_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_integrations_updated_at();

CREATE TRIGGER trigger_meta_connected_accounts_updated_at
  BEFORE UPDATE ON public.meta_connected_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_connected_accounts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.meta_integrations IS 'Stores user-level Meta OAuth integrations for Facebook and Instagram';
COMMENT ON TABLE public.meta_connected_accounts IS 'Stores connected Facebook Pages and Instagram Business accounts';
COMMENT ON COLUMN public.meta_integrations.user_id IS 'References the user who connected their Meta account';
COMMENT ON COLUMN public.meta_integrations.access_token IS 'Meta OAuth access token (encrypted in production)';
COMMENT ON COLUMN public.meta_integrations.expires_at IS 'Token expiration timestamp (Meta tokens last 60 days)';
COMMENT ON COLUMN public.meta_connected_accounts.platform IS 'Platform type: facebook or instagram';
COMMENT ON COLUMN public.meta_connected_accounts.account_id IS 'Meta platform account ID (Page ID or Instagram Business Account ID)';
COMMENT ON COLUMN public.meta_connected_accounts.access_token IS 'Page-specific access token (for Facebook Pages)';
COMMENT ON COLUMN public.meta_connected_accounts.metadata IS 'Additional platform-specific data (insights, settings, etc.)';
