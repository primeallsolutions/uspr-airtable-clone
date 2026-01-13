-- Migration: Add analytics card filters + record updated timestamps
-- Date: 2026-01-12
-- Description: Store filter configuration on analytics cards and track record updates

ALTER TABLE public.workspace_analytics_cards
  ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_match text NOT NULL DEFAULT 'all'
    CHECK (filter_match IN ('all', 'any'));

COMMENT ON COLUMN public.workspace_analytics_cards.filters IS
  'Filter conditions applied before aggregation';
COMMENT ON COLUMN public.workspace_analytics_cards.filter_match IS
  'Whether all or any conditions must match';

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.records
  SET updated_at = created_at
  WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION update_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_records_updated_at ON public.records;

CREATE TRIGGER trigger_update_records_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW
  EXECUTE FUNCTION update_records_updated_at();
