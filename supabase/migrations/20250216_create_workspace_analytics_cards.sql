-- Migration: Create workspace analytics cards
-- Date: 2025-02-16
-- Description: Store customizable analytics cards per workspace

CREATE TABLE public.workspace_analytics_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  base_id uuid NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  group_field_id uuid REFERENCES public.fields(id) ON DELETE SET NULL,
  value_field_id uuid REFERENCES public.fields(id) ON DELETE SET NULL,
  title text NOT NULL,
  chart_type text NOT NULL CHECK (chart_type IN ('number', 'bar', 'line', 'pie')),
  aggregation text NOT NULL DEFAULT 'count',
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_workspace_analytics_cards_workspace_id
  ON public.workspace_analytics_cards(workspace_id);
CREATE INDEX idx_workspace_analytics_cards_table_id
  ON public.workspace_analytics_cards(table_id);

COMMENT ON TABLE public.workspace_analytics_cards IS
  'Custom analytics cards scoped to a workspace';
COMMENT ON COLUMN public.workspace_analytics_cards.layout IS
  'Grid layout info for positioning cards in the dashboard';

CREATE OR REPLACE FUNCTION update_workspace_analytics_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workspace_analytics_cards_updated_at
  BEFORE UPDATE ON public.workspace_analytics_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_analytics_cards_updated_at();
