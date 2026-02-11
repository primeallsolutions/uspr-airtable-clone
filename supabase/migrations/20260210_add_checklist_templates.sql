-- Migration: Add Checklist Templates
-- Allows creating reusable task/checklist templates at the base level

-- Create checklist_templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique names per base
  UNIQUE(base_id, name)
);

-- Create checklist_items table for individual tasks in a template
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_checklist_templates_base ON checklist_templates(base_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_created ON checklist_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_items_template ON checklist_items(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_order ON checklist_items(order_index);

-- Enable Row Level Security
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklist_templates
DROP POLICY IF EXISTS "Users can view checklist templates for accessible bases" ON checklist_templates;
DROP POLICY IF EXISTS "Users can insert checklist templates for accessible bases" ON checklist_templates;
DROP POLICY IF EXISTS "Users can update checklist templates for accessible bases" ON checklist_templates;
DROP POLICY IF EXISTS "Users can delete checklist templates for accessible bases" ON checklist_templates;

-- Users can view checklist templates if they have access to the base
CREATE POLICY "Users can view checklist templates for accessible bases"
  ON checklist_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = checklist_templates.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can insert checklist templates if they have access to the base
CREATE POLICY "Users can insert checklist templates for accessible bases"
  ON checklist_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = checklist_templates.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can update checklist templates if they have access to the base
CREATE POLICY "Users can update checklist templates for accessible bases"
  ON checklist_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = checklist_templates.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can delete checklist templates if they have access to the base
CREATE POLICY "Users can delete checklist templates for accessible bases"
  ON checklist_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = checklist_templates.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- RLS Policies for checklist_items (inherit access from parent template)
DROP POLICY IF EXISTS "Users can view checklist items for accessible bases" ON checklist_items;
DROP POLICY IF EXISTS "Users can insert checklist items for accessible bases" ON checklist_items;
DROP POLICY IF EXISTS "Users can update checklist items for accessible bases" ON checklist_items;
DROP POLICY IF EXISTS "Users can delete checklist items for accessible bases" ON checklist_items;

-- Users can view checklist items if they have access to the base
CREATE POLICY "Users can view checklist items for accessible bases"
  ON checklist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      LEFT JOIN bases b ON b.id = ct.base_id
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE ct.id = checklist_items.checklist_template_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can insert checklist items if they have access to the base
CREATE POLICY "Users can insert checklist items for accessible bases"
  ON checklist_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      LEFT JOIN bases b ON b.id = ct.base_id
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE ct.id = checklist_items.checklist_template_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can update checklist items if they have access to the base
CREATE POLICY "Users can update checklist items for accessible bases"
  ON checklist_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      LEFT JOIN bases b ON b.id = ct.base_id
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE ct.id = checklist_items.checklist_template_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can delete checklist items if they have access to the base
CREATE POLICY "Users can delete checklist items for accessible bases"
  ON checklist_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      LEFT JOIN bases b ON b.id = ct.base_id
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE ct.id = checklist_items.checklist_template_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Create function to update the updated_at timestamp for checklist_templates
CREATE OR REPLACE FUNCTION update_checklist_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for checklist_templates updated_at (idempotent)
DROP TRIGGER IF EXISTS update_checklist_templates_updated_at_trigger ON checklist_templates;
CREATE TRIGGER update_checklist_templates_updated_at_trigger
BEFORE UPDATE ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION update_checklist_templates_updated_at();

-- Create function to update the updated_at timestamp for checklist_items
CREATE OR REPLACE FUNCTION update_checklist_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for checklist_items updated_at (idempotent)
DROP TRIGGER IF EXISTS update_checklist_items_updated_at_trigger ON checklist_items;
CREATE TRIGGER update_checklist_items_updated_at_trigger
BEFORE UPDATE ON checklist_items
FOR EACH ROW
EXECUTE FUNCTION update_checklist_items_updated_at();
