-- Document Locks Migration
-- Implements document locking to prevent concurrent edit conflicts

-- Create document_locks table
CREATE TABLE IF NOT EXISTS document_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_path TEXT NOT NULL,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    lock_type TEXT NOT NULL DEFAULT 'edit' CHECK (lock_type IN ('edit', 'signature', 'exclusive')),
    metadata JSONB DEFAULT '{}',
    
    -- Ensure unique active lock per document
    CONSTRAINT unique_active_lock UNIQUE (document_path, base_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_document_locks_document ON document_locks(document_path);
CREATE INDEX IF NOT EXISTS idx_document_locks_base ON document_locks(base_id);
CREATE INDEX IF NOT EXISTS idx_document_locks_user ON document_locks(locked_by);
CREATE INDEX IF NOT EXISTS idx_document_locks_expires ON document_locks(expires_at);

-- Function to acquire a lock
CREATE OR REPLACE FUNCTION acquire_document_lock(
    p_document_path TEXT,
    p_base_id UUID,
    p_user_id UUID,
    p_lock_type TEXT DEFAULT 'edit',
    p_duration_minutes INT DEFAULT 30
)
RETURNS TABLE (
    success BOOLEAN,
    lock_id UUID,
    message TEXT,
    existing_lock_user UUID,
    existing_lock_expires TIMESTAMPTZ
) AS $$
DECLARE
    v_existing_lock RECORD;
    v_new_lock_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Clean up expired locks first
    DELETE FROM document_locks 
    WHERE document_path = p_document_path 
    AND base_id = p_base_id 
    AND expires_at < NOW();
    
    -- Check for existing lock
    SELECT * INTO v_existing_lock
    FROM document_locks
    WHERE document_path = p_document_path
    AND base_id = p_base_id
    AND expires_at > NOW()
    FOR UPDATE;
    
    IF v_existing_lock IS NOT NULL THEN
        -- Lock exists
        IF v_existing_lock.locked_by = p_user_id THEN
            -- Same user - extend the lock
            v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
            
            UPDATE document_locks 
            SET expires_at = v_expires_at,
                locked_at = NOW(),
                lock_type = p_lock_type
            WHERE id = v_existing_lock.id
            RETURNING id INTO v_new_lock_id;
            
            RETURN QUERY SELECT 
                TRUE, 
                v_new_lock_id, 
                'Lock extended'::TEXT,
                NULL::UUID,
                NULL::TIMESTAMPTZ;
        ELSE
            -- Different user - lock denied
            RETURN QUERY SELECT 
                FALSE, 
                NULL::UUID, 
                'Document is locked by another user'::TEXT,
                v_existing_lock.locked_by,
                v_existing_lock.expires_at;
        END IF;
    ELSE
        -- No existing lock - acquire new lock
        v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
        
        BEGIN
            INSERT INTO document_locks (
                document_path,
                base_id,
                locked_by,
                expires_at,
                lock_type
            ) VALUES (
                p_document_path,
                p_base_id,
                p_user_id,
                v_expires_at,
                p_lock_type
            )
            RETURNING id INTO v_new_lock_id;
            
            RETURN QUERY SELECT 
                TRUE, 
                v_new_lock_id, 
                'Lock acquired'::TEXT,
                NULL::UUID,
                NULL::TIMESTAMPTZ;
        EXCEPTION
            WHEN unique_violation THEN
                -- Another transaction inserted a lock concurrently
                -- Re-select to get the existing lock info
                SELECT * INTO v_existing_lock
                FROM document_locks
                WHERE document_path = p_document_path
                AND base_id = p_base_id
                AND expires_at > NOW()
                FOR UPDATE;
                
                IF v_existing_lock IS NOT NULL THEN
                    IF v_existing_lock.locked_by = p_user_id THEN
                        -- Same user acquired the lock in concurrent transaction - extend it
                        v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
                        
                        UPDATE document_locks 
                        SET expires_at = v_expires_at,
                            locked_at = NOW(),
                            lock_type = p_lock_type
                        WHERE id = v_existing_lock.id
                        RETURNING id INTO v_new_lock_id;
                        
                        RETURN QUERY SELECT 
                            TRUE, 
                            v_new_lock_id, 
                            'Lock extended'::TEXT,
                            NULL::UUID,
                            NULL::TIMESTAMPTZ;
                    ELSE
                        -- Different user holds the lock
                        RETURN QUERY SELECT 
                            FALSE, 
                            NULL::UUID, 
                            'Document is locked by another user'::TEXT,
                            v_existing_lock.locked_by,
                            v_existing_lock.expires_at;
                    END IF;
                ELSE
                    -- Lock was inserted but then expired/deleted - shouldn't happen but handle it
                    RAISE EXCEPTION 'Lock acquisition failed due to race condition, please retry';
                END IF;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release a lock
CREATE OR REPLACE FUNCTION release_document_lock(
    p_document_path TEXT,
    p_base_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM document_locks
    WHERE document_path = p_document_path
    AND base_id = p_base_id
    AND locked_by = p_user_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    IF v_deleted > 0 THEN
        RETURN QUERY SELECT TRUE, 'Lock released'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'No lock found for this user'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check lock status
CREATE OR REPLACE FUNCTION check_document_lock(
    p_document_path TEXT,
    p_base_id UUID
)
RETURNS TABLE (
    is_locked BOOLEAN,
    locked_by UUID,
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    lock_type TEXT,
    time_remaining INTERVAL
) AS $$
BEGIN
    -- Clean up expired locks
    DELETE FROM document_locks 
    WHERE document_path = p_document_path 
    AND base_id = p_base_id 
    AND expires_at < NOW();
    
    RETURN QUERY
    SELECT 
        TRUE,
        dl.locked_by,
        dl.locked_at,
        dl.expires_at,
        dl.lock_type,
        dl.expires_at - NOW()
    FROM document_locks dl
    WHERE dl.document_path = p_document_path
    AND dl.base_id = p_base_id
    AND dl.expires_at > NOW()
    
    UNION ALL
    
    SELECT 
        FALSE,
        NULL::UUID,
        NULL::TIMESTAMPTZ,
        NULL::TIMESTAMPTZ,
        NULL::TEXT,
        NULL::INTERVAL
    WHERE NOT EXISTS (
        SELECT 1 FROM document_locks
        WHERE document_path = p_document_path
        AND base_id = p_base_id
        AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to force release a lock (admin only)
CREATE OR REPLACE FUNCTION force_release_document_lock(
    p_document_path TEXT,
    p_base_id UUID,
    p_admin_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_deleted INT;
BEGIN
    -- Check if user is base owner or has admin role
    SELECT EXISTS (
        SELECT 1 FROM bases 
        WHERE id = p_base_id AND owner = p_admin_user_id
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RETURN QUERY SELECT FALSE, 'Only base owner can force release locks'::TEXT;
        RETURN;
    END IF;
    
    DELETE FROM document_locks
    WHERE document_path = p_document_path
    AND base_id = p_base_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    IF v_deleted > 0 THEN
        RETURN QUERY SELECT TRUE, 'Lock force released'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'No lock found'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Scheduled job to clean up expired locks (run via pg_cron or external scheduler)
-- Clean locks that have been expired for more than 1 hour
CREATE OR REPLACE FUNCTION cleanup_expired_document_locks()
RETURNS INT AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM document_locks
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE document_locks ENABLE ROW LEVEL SECURITY;

-- Users can view locks for bases they have access to
CREATE POLICY "Users can view locks for their bases"
    ON document_locks
    FOR SELECT
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can insert locks for bases they have access to
CREATE POLICY "Users can create locks for their bases"
    ON document_locks
    FOR INSERT
    WITH CHECK (
        locked_by = auth.uid()
        AND base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can update their own locks
CREATE POLICY "Users can update their own locks"
    ON document_locks
    FOR UPDATE
    USING (locked_by = auth.uid());

-- Users can delete their own locks
CREATE POLICY "Users can delete their own locks"
    ON document_locks
    FOR DELETE
    USING (locked_by = auth.uid());

-- Base owners can delete any lock in their base
CREATE POLICY "Base owners can delete any lock"
    ON document_locks
    FOR DELETE
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
        )
    );

-- Revoke public access and grant execute only to authenticated role
-- This ensures SECURITY DEFINER functions are only callable by authenticated users
REVOKE ALL ON FUNCTION acquire_document_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION release_document_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION check_document_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION force_release_document_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired_document_locks FROM PUBLIC;

GRANT EXECUTE ON FUNCTION acquire_document_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_document_lock TO authenticated;
GRANT EXECUTE ON FUNCTION check_document_lock TO authenticated;
GRANT EXECUTE ON FUNCTION force_release_document_lock TO authenticated;
-- cleanup_expired_document_locks is for admin/cron jobs, not regular users

COMMENT ON TABLE document_locks IS 'Tracks active document locks to prevent concurrent editing conflicts';
COMMENT ON FUNCTION acquire_document_lock IS 'Attempts to acquire a lock on a document, returns success status';
COMMENT ON FUNCTION release_document_lock IS 'Releases a lock held by the current user';
COMMENT ON FUNCTION check_document_lock IS 'Checks if a document is currently locked';
COMMENT ON FUNCTION force_release_document_lock IS 'Admin function to force release any lock';

