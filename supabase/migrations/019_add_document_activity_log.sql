-- Document Activity Log Schema
-- This migration creates the activity logging system for the Document Management System

-- Create document_activity_log table
CREATE TABLE IF NOT EXISTS public.document_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_id UUID NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.records(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'upload', 'download', 'view', 'edit', 'delete', 'rename', 'move',
    'folder_create', 'folder_rename', 'folder_delete',
    'signature_request', 'signature_sent', 'signature_viewed', 'signature_signed', 'signature_declined', 'signature_completed',
    'template_create', 'template_edit', 'template_delete', 'document_generate',
    'share_create', 'share_revoke'
  )),
  document_path TEXT, -- Path to the document (null for folder actions)
  folder_path TEXT, -- Path to the folder
  document_name TEXT, -- Display name of the document
  metadata JSONB DEFAULT '{}', -- Additional action-specific data
  ip_address TEXT, -- Client IP address
  user_agent TEXT, -- Browser/client info
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_activity_base_id ON public.document_activity_log(base_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_table_id ON public.document_activity_log(table_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_user_id ON public.document_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_action ON public.document_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_document_activity_created_at ON public.document_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_activity_document_path ON public.document_activity_log(document_path);

-- Enable RLS
ALTER TABLE public.document_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist (for idempotency)

DROP POLICY IF EXISTS "Users can view document activity for accessible bases" ON public.document_activity_log;
DROP POLICY IF EXISTS "Users can create document activity for accessible bases" ON public.document_activity_log;
DROP POLICY IF EXISTS "Service role has full access to document activity" ON public.document_activity_log;

-- Users can view activity for bases they have access to
CREATE POLICY "Users can view document activity for accessible bases"
  ON public.document_activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bases
      WHERE bases.id = document_activity_log.base_id
      AND (
        bases.owner = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_memberships wm
          JOIN public.workspaces w ON w.id = wm.workspace_id
          WHERE w.id = bases.workspace_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

-- Users can insert activity for bases they have access to
CREATE POLICY "Users can create document activity for accessible bases"
  ON public.document_activity_log
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.bases
      WHERE bases.id = document_activity_log.base_id
      AND (
        bases.owner = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_memberships wm
          JOIN public.workspaces w ON w.id = wm.workspace_id
          WHERE w.id = bases.workspace_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

-- Service role can do anything (for server-side logging)
CREATE POLICY "Service role has full access to document activity"
  ON public.document_activity_log
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Enable Realtime for activity feed (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'document_activity_log'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_activity_log;
  END IF;
END $$;

-- Comment
COMMENT ON TABLE public.document_activity_log IS 'Tracks all document-related activities for the Activity Feed feature';
