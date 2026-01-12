-- Migration: Add Document Version History
-- Track versions of documents for rollback and comparison

-- Create document_versions table
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_path TEXT NOT NULL,
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  version_path TEXT NOT NULL, -- Path to the versioned file in storage
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT, -- Optional version notes/comment
  is_current BOOLEAN DEFAULT false,
  
  -- Ensure unique version numbers per document
  UNIQUE(document_path, base_id, version_number)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_document_versions_path ON document_versions(document_path, base_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_base ON document_versions(base_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created ON document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_current ON document_versions(is_current) WHERE is_current = true;

-- Enable Row Level Security
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view document versions if they have access to the base
CREATE POLICY "Users can view document versions for accessible bases"
  ON document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = document_versions.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can insert document versions if they have access to the base
CREATE POLICY "Users can insert document versions for accessible bases"
  ON document_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = document_versions.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can update document versions if they have access to the base
CREATE POLICY "Users can update document versions for accessible bases"
  ON document_versions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = document_versions.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Users can delete document versions if they have access to the base
CREATE POLICY "Users can delete document versions for accessible bases"
  ON document_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bases b
      LEFT JOIN base_memberships bm ON bm.base_id = b.id
      WHERE b.id = document_versions.base_id
      AND (b.owner = auth.uid() OR bm.user_id = auth.uid())
    )
  );

-- Function to automatically create a version when a document is updated
CREATE OR REPLACE FUNCTION create_document_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Get the next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
  FROM document_versions
  WHERE document_path = NEW.document_path AND base_id = NEW.base_id;
  
  -- Update is_current to false for all previous versions
  UPDATE document_versions
  SET is_current = false
  WHERE document_path = NEW.document_path 
    AND base_id = NEW.base_id 
    AND is_current = true;
  
  -- Set the new version number and mark as current
  NEW.version_number := next_version;
  NEW.is_current := true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-versioning
CREATE TRIGGER trigger_document_version_number
  BEFORE INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION create_document_version();

-- Add comment for documentation
COMMENT ON TABLE document_versions IS 'Stores version history for documents, enabling rollback and comparison features';
