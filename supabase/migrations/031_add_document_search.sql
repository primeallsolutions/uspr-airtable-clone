-- Document Full-Text Search Migration
-- Adds search capabilities for document metadata and content

-- Create document_search_index table for storing extracted text
CREATE TABLE IF NOT EXISTS document_search_index (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_path TEXT NOT NULL,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    record_id UUID,
    
    -- Document metadata
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    
    -- Extracted/searchable content
    content_text TEXT, -- Extracted text from PDF/documents
    content_preview TEXT, -- First ~500 chars for display
    
    -- Full-text search vector
    search_vector TSVECTOR,
    
    -- Timestamps
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_extracted_at TIMESTAMPTZ,
    last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one index per document
    CONSTRAINT unique_document_search UNIQUE (document_path, base_id)
);

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_search_vector ON document_search_index USING GIN(search_vector);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_document_search_base ON document_search_index(base_id);
CREATE INDEX IF NOT EXISTS idx_document_search_table ON document_search_index(table_id);
CREATE INDEX IF NOT EXISTS idx_document_search_record ON document_search_index(record_id);
CREATE INDEX IF NOT EXISTS idx_document_search_mime ON document_search_index(mime_type);
CREATE INDEX IF NOT EXISTS idx_document_search_filename ON document_search_index(file_name);

-- ============================================================================
-- Materialized Tokens Table for Efficient Prefix Search Suggestions
-- ============================================================================
-- This table stores pre-extracted tokens from document content to enable
-- efficient prefix-based autocomplete queries using btree text_pattern_ops index.

CREATE TABLE IF NOT EXISTS document_search_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_search_id UUID NOT NULL REFERENCES document_search_index(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    document_path TEXT NOT NULL,
    token TEXT NOT NULL,
    
    -- Ensure unique tokens per document
    CONSTRAINT unique_token_per_document UNIQUE (document_search_id, token)
);

-- Btree index with text_pattern_ops for efficient prefix LIKE queries (token LIKE 'prefix%')
-- This index supports queries like: WHERE base_id = $1 AND token LIKE 'prefix%'
CREATE INDEX IF NOT EXISTS idx_document_search_tokens_prefix 
    ON document_search_tokens (base_id, token text_pattern_ops);

-- Additional index for lookups by document_search_id (for cleanup on updates)
CREATE INDEX IF NOT EXISTS idx_document_search_tokens_doc_id 
    ON document_search_tokens (document_search_id);

-- Trigger function to update search vector
CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.file_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content_preview, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content_text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector on insert/update
DROP TRIGGER IF EXISTS trigger_document_search_vector ON document_search_index;
CREATE TRIGGER trigger_document_search_vector
    BEFORE INSERT OR UPDATE OF file_name, content_text, content_preview
    ON document_search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_document_search_vector();

-- ============================================================================
-- Trigger function to maintain materialized tokens table
-- ============================================================================
CREATE OR REPLACE FUNCTION update_document_search_tokens()
RETURNS TRIGGER AS $$
DECLARE
    v_combined_text TEXT;
    v_tsvector TSVECTOR;
BEGIN
    -- Delete existing tokens for this document (on UPDATE or if replacing)
    DELETE FROM document_search_tokens WHERE document_search_id = NEW.id;
    
    -- Combine file_name, content_preview, and content_text for token extraction
    -- This matches the trigger columns (file_name, content_text, content_preview)
    -- Note: Including content_text may increase token volume significantly for large documents
    v_combined_text := COALESCE(NEW.file_name, '') || ' ' || COALESCE(NEW.content_preview, '') || ' ' || COALESCE(NEW.content_text, '');
    
    -- Convert to tsvector to get normalized/stemmed tokens
    v_tsvector := to_tsvector('english', v_combined_text);
    
    -- Insert unique tokens into the tokens table
    INSERT INTO document_search_tokens (document_search_id, base_id, document_path, token)
    SELECT 
        NEW.id,
        NEW.base_id,
        NEW.document_path,
        unnest(tsvector_to_array(v_tsvector))
    ON CONFLICT (document_search_id, token) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain tokens table after document_search_index changes
-- Uses AFTER trigger since we need the row's id to be available
DROP TRIGGER IF EXISTS trigger_document_search_tokens ON document_search_index;
CREATE TRIGGER trigger_document_search_tokens
    AFTER INSERT OR UPDATE OF file_name, content_text, content_preview
    ON document_search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_document_search_tokens();

-- Function to search documents
CREATE OR REPLACE FUNCTION search_documents(
    p_base_id UUID,
    p_query TEXT,
    p_table_id UUID DEFAULT NULL,
    p_mime_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    document_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    content_preview TEXT,
    rank REAL,
    indexed_at TIMESTAMPTZ,
    table_id UUID,
    record_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dsi.document_path,
        dsi.file_name,
        dsi.mime_type,
        dsi.content_preview,
        ts_rank(dsi.search_vector, websearch_to_tsquery('english', p_query)) AS rank,
        dsi.indexed_at,
        dsi.table_id,
        dsi.record_id
    FROM document_search_index dsi
    WHERE 
        dsi.base_id = p_base_id
        AND (p_table_id IS NULL OR dsi.table_id = p_table_id)
        AND (p_mime_type IS NULL OR dsi.mime_type = p_mime_type)
        AND dsi.search_vector @@ websearch_to_tsquery('english', p_query)
    ORDER BY rank DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to search with highlights
CREATE OR REPLACE FUNCTION search_documents_with_highlights(
    p_base_id UUID,
    p_query TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    document_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    highlighted_preview TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dsi.document_path,
        dsi.file_name,
        dsi.mime_type,
        ts_headline(
            'english',
            COALESCE(dsi.content_text, dsi.file_name),
            websearch_to_tsquery('english', p_query),
            'MaxFragments=2, MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
        ) AS highlighted_preview,
        ts_rank(dsi.search_vector, websearch_to_tsquery('english', p_query)) AS rank
    FROM document_search_index dsi
    WHERE 
        dsi.base_id = p_base_id
        AND dsi.search_vector @@ websearch_to_tsquery('english', p_query)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get search suggestions based on existing documents
-- Uses materialized tokens table with btree text_pattern_ops index for efficient prefix search
CREATE OR REPLACE FUNCTION get_document_search_suggestions(
    p_base_id UUID,
    p_prefix TEXT,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    suggestion TEXT,
    document_count BIGINT
) AS $$
DECLARE
    v_normalized_prefix TEXT;
BEGIN
    -- Normalize the prefix using to_tsvector to match how tokens are stored
    -- This ensures the prefix is stemmed the same way as indexed tokens
    -- Select only the first stemmed token from the tsvector
    SELECT word INTO v_normalized_prefix
    FROM unnest(tsvector_to_array(to_tsvector('english', p_prefix))) AS word
    LIMIT 1;
    
    -- If normalization produced no result (e.g., stop words only), use original prefix lowercased
    IF v_normalized_prefix IS NULL OR v_normalized_prefix = '' THEN
        v_normalized_prefix := lower(p_prefix);
    END IF;
    
    -- Query the materialized tokens table using the btree text_pattern_ops index
    -- The index efficiently supports: WHERE base_id = $1 AND token LIKE 'prefix%'
    RETURN QUERY
    SELECT 
        dst.token AS suggestion,
        COUNT(DISTINCT dst.document_path) AS document_count
    FROM document_search_tokens dst
    WHERE 
        dst.base_id = p_base_id
        AND dst.token LIKE v_normalized_prefix || '%'
    GROUP BY dst.token
    ORDER BY document_count DESC, dst.token
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to index a document
CREATE OR REPLACE FUNCTION index_document(
    p_document_path TEXT,
    p_base_id UUID,
    p_table_id UUID DEFAULT NULL,
    p_record_id UUID DEFAULT NULL,
    p_file_name TEXT DEFAULT NULL,
    p_mime_type TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_content_text TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_preview TEXT;
BEGIN
    -- Generate preview from content
    v_preview := CASE 
        WHEN p_content_text IS NOT NULL THEN 
            LEFT(p_content_text, 500)
        ELSE 
            NULL
    END;
    
    INSERT INTO document_search_index (
        document_path,
        base_id,
        table_id,
        record_id,
        file_name,
        mime_type,
        file_size,
        content_text,
        content_preview,
        content_extracted_at
    ) VALUES (
        p_document_path,
        p_base_id,
        p_table_id,
        p_record_id,
        COALESCE(p_file_name, split_part(p_document_path, '/', -1)),
        p_mime_type,
        p_file_size,
        p_content_text,
        v_preview,
        CASE WHEN p_content_text IS NOT NULL THEN NOW() ELSE NULL END
    )
    ON CONFLICT (document_path, base_id) DO UPDATE SET
        table_id = EXCLUDED.table_id,
        record_id = EXCLUDED.record_id,
        file_name = COALESCE(EXCLUDED.file_name, document_search_index.file_name),
        mime_type = COALESCE(EXCLUDED.mime_type, document_search_index.mime_type),
        file_size = COALESCE(EXCLUDED.file_size, document_search_index.file_size),
        content_text = COALESCE(EXCLUDED.content_text, document_search_index.content_text),
        content_preview = COALESCE(v_preview, document_search_index.content_preview),
        content_extracted_at = CASE 
            WHEN EXCLUDED.content_text IS NOT NULL THEN NOW() 
            ELSE document_search_index.content_extracted_at 
        END,
        last_modified = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to remove document from index
CREATE OR REPLACE FUNCTION remove_document_from_index(
    p_document_path TEXT,
    p_base_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM document_search_index
    WHERE document_path = p_document_path
    AND base_id = p_base_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE document_search_index ENABLE ROW LEVEL SECURITY;

-- Users can view search index for bases they have access to
CREATE POLICY "Users can view search index for their bases"
    ON document_search_index
    FOR SELECT
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can insert index entries for bases they have access to
CREATE POLICY "Users can index documents for their bases"
    ON document_search_index
    FOR INSERT
    WITH CHECK (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can update index entries for bases they have access to
CREATE POLICY "Users can update search index for their bases"
    ON document_search_index
    FOR UPDATE
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can delete index entries for bases they have access to
CREATE POLICY "Users can delete search index for their bases"
    ON document_search_index
    FOR DELETE
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for document_search_tokens table
-- ============================================================================
ALTER TABLE document_search_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view tokens for bases they have access to
CREATE POLICY "Users can view search tokens for their bases"
    ON document_search_tokens
    FOR SELECT
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can insert tokens for bases they have access to (populated via trigger)
CREATE POLICY "Users can insert search tokens for their bases"
    ON document_search_tokens
    FOR INSERT
    WITH CHECK (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- Users can delete tokens for bases they have access to (managed via trigger/cascade)
CREATE POLICY "Users can delete search tokens for their bases"
    ON document_search_tokens
    FOR DELETE
    USING (
        base_id IN (
            SELECT id FROM bases WHERE owner = auth.uid()
            UNION
            SELECT base_id FROM base_memberships WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- Backfill existing tokens from document_search_index
-- ============================================================================
-- This populates the tokens table for any existing documents in the search index
-- Includes file_name, content_preview, and content_text to match the trigger function
INSERT INTO document_search_tokens (document_search_id, base_id, document_path, token)
SELECT 
    dsi.id,
    dsi.base_id,
    dsi.document_path,
    unnest(tsvector_to_array(to_tsvector('english', COALESCE(dsi.file_name, '') || ' ' || COALESCE(dsi.content_preview, '') || ' ' || COALESCE(dsi.content_text, ''))))
FROM document_search_index dsi
ON CONFLICT (document_search_id, token) DO NOTHING;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION search_documents TO authenticated;
GRANT EXECUTE ON FUNCTION search_documents_with_highlights TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_search_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION index_document TO authenticated;
GRANT EXECUTE ON FUNCTION remove_document_from_index TO authenticated;

COMMENT ON TABLE document_search_index IS 'Full-text search index for documents';
COMMENT ON TABLE document_search_tokens IS 'Materialized tokens from documents for efficient prefix-based autocomplete queries';
COMMENT ON FUNCTION search_documents IS 'Search documents using full-text search';
COMMENT ON FUNCTION search_documents_with_highlights IS 'Search documents with highlighted matches';
COMMENT ON FUNCTION get_document_search_suggestions IS 'Get autocomplete suggestions for search using btree text_pattern_ops index';
COMMENT ON FUNCTION index_document IS 'Add or update a document in the search index';
COMMENT ON FUNCTION update_document_search_tokens IS 'Trigger function to maintain materialized tokens table';

