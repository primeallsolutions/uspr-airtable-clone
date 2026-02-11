-- Create table to track checklist item completion state for records
CREATE TABLE record_checklist_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(record_id, checklist_item_id)
);

-- Create indexes for performance
CREATE INDEX idx_record_checklist_completions_record_id ON record_checklist_completions(record_id);
CREATE INDEX idx_record_checklist_completions_item_id ON record_checklist_completions(checklist_item_id);
CREATE INDEX idx_record_checklist_completions_completed ON record_checklist_completions(is_completed);

-- Enable RLS
ALTER TABLE record_checklist_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view/edit checklist completions for records in their base
CREATE POLICY "Users can manage checklist completions for base records"
  ON record_checklist_completions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM records r
      JOIN tables t ON r.table_id = t.id
      JOIN bases b ON t.base_id = b.id
      WHERE r.id = record_checklist_completions.record_id
      AND b.owner = auth.uid()
    )
  );
