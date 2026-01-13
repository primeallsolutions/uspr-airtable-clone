-- Migration: Add record_id to document_folders for record-scoped folders
-- This allows the Advanced Documents view to work at the record level

-- Add record_id column to document_folders
ALTER TABLE public.document_folders 
ADD COLUMN IF NOT EXISTS record_id UUID REFERENCES public.records(id) ON DELETE CASCADE;

-- Add index for record-scoped folder queries
CREATE INDEX IF NOT EXISTS idx_document_folders_record 
ON public.document_folders(record_id) 
WHERE record_id IS NOT NULL;

-- Add unique constraint for record-scoped folders
-- This allows the same path to exist for different records
ALTER TABLE public.document_folders 
DROP CONSTRAINT IF EXISTS document_folders_base_id_table_id_path_key;

-- Create new composite unique constraint that includes record_id
-- For table-scoped folders: base_id + table_id + path must be unique
-- For record-scoped folders: base_id + record_id + path must be unique
-- We handle this with partial unique indexes

-- Unique constraint for table-scoped folders (where record_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS document_folders_base_table_path_unique 
ON public.document_folders(base_id, COALESCE(table_id, '00000000-0000-0000-0000-000000000000'::uuid), path) 
WHERE record_id IS NULL;

-- Unique constraint for record-scoped folders
CREATE UNIQUE INDEX IF NOT EXISTS document_folders_base_record_path_unique 
ON public.document_folders(base_id, record_id, path) 
WHERE record_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.document_folders.record_id IS 'When set, scopes this folder to a specific record for row-level document isolation';
