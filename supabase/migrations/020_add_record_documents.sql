-- Migration: Add Record-Level Document Bridge
-- Links documents directly to individual records in the Airtable-style database

-- Create record_documents table to track documents attached to specific records
CREATE TABLE IF NOT EXISTS record_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  document_path TEXT NOT NULL,
  document_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate attachments
  UNIQUE(record_id, document_path)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_record_documents_record ON record_documents(record_id);
CREATE INDEX IF NOT EXISTS idx_record_documents_base ON record_documents(base_id);
CREATE INDEX IF NOT EXISTS idx_record_documents_table ON record_documents(table_id);
CREATE INDEX IF NOT EXISTS idx_record_documents_created ON record_documents(created_at DESC);

-- Enable Row Level Security
ALTER TABLE record_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist (for idempotency)

DROP POLICY IF EXISTS "Users can view record documents for accessible bases" ON record_documents;
DROP POLICY IF EXISTS "Users can insert record documents for accessible bases" ON record_documents;
DROP POLICY IF EXISTS "Users can update record documents for accessible bases" ON record_documents;
DROP POLICY IF EXISTS "Users can delete record documents for accessible bases" ON record_documents;

-- Users can view record documents if they have access to the base
CREATE POLICY "Users can view record documents for accessible bases"
  ON record_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = record_documents.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can insert record documents if they have access to the base
CREATE POLICY "Users can insert record documents for accessible bases"
  ON record_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = record_documents.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can update record documents if they have access to the base
CREATE POLICY "Users can update record documents for accessible bases"
  ON record_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = record_documents.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can delete record documents if they have access to the base
CREATE POLICY "Users can delete record documents for accessible bases"
  ON record_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = record_documents.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_record_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at (idempotent)
DROP TRIGGER IF EXISTS trigger_record_documents_updated_at ON record_documents;
CREATE TRIGGER trigger_record_documents_updated_at
  BEFORE UPDATE ON record_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_record_documents_updated_at();

-- Add comment for documentation
COMMENT ON TABLE record_documents IS 'Links documents to individual records for the record-level document bridge feature';
