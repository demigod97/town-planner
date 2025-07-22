-- =====================================================
-- Town Planning RAG System - Complete Migration Script
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- ENHANCED EXISTING TABLES
-- =====================================================

-- Enhanced notebooks table for project/client management
ALTER TABLE IF EXISTS notebooks 
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'active' CHECK (project_status IN ('active', 'completed', 'archived')),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Enhanced sources table for better document management
ALTER TABLE IF EXISTS sources 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS metadata_extracted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS extracted_metadata JSONB DEFAULT '{}';

-- =====================================================
-- NEW TABLES FOR TOWN PLANNING SYSTEM
-- =====================================================

-- PDF Metadata table for storing extracted metadata from documents
CREATE TABLE IF NOT EXISTS pdf_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    
    -- Core metadata fields
    prepared_for TEXT,
    prepared_by TEXT,
    address TEXT,
    report_issued_date DATE,
    document_title TEXT,
    document_type TEXT,
    
    -- Additional metadata
    page_count INTEGER,
    sections JSONB DEFAULT '[]', -- Array of section titles and page ranges
    authors JSONB DEFAULT '[]', -- Array of authors/contributors
    keywords JSONB DEFAULT '[]', -- Extracted keywords
    
    -- Processing metadata
    extraction_method TEXT DEFAULT 'llamacloud',
    confidence_score DECIMAL(3,2),
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Full metadata JSON for flexibility
    raw_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Templates table for defining report structures
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    
    -- Template structure as JSON
    structure JSONB NOT NULL, -- Hierarchical sections and subsections
    
    -- Template configuration
    is_active BOOLEAN DEFAULT TRUE,
    version TEXT DEFAULT '1.0',
    
    -- Metadata
    created_by UUID, -- Reference to user if you have user system
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Generations table for tracking generated reports
CREATE TABLE IF NOT EXISTS report_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id),
    
    -- Generation parameters
    topic TEXT NOT NULL,
    address TEXT,
    additional_context TEXT,
    
    -- Generation status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0, -- 0-100
    
    -- Results
    generated_content TEXT, -- Full report content
    file_path TEXT, -- Path to generated file
    file_format TEXT DEFAULT 'markdown', -- markdown, docx, pdf
    file_size BIGINT,
    
    -- Processing metadata
    queries_generated JSONB DEFAULT '[]', -- Generated queries for sections
    sections_completed JSONB DEFAULT '{}', -- Track which sections are done
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks Metadata table for associating chunks with extracted metadata
CREATE TABLE IF NOT EXISTS chunks_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id INTEGER, -- Reference to vector store chunk
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    pdf_metadata_id UUID REFERENCES pdf_metadata(id) ON DELETE CASCADE,
    
    -- Chunk-specific metadata
    section_title TEXT,
    subsection_title TEXT,
    page_numbers INTEGER[],
    paragraph_index INTEGER,
    
    -- Content metadata
    content_type TEXT DEFAULT 'text', -- text, table, figure, heading
    confidence_score DECIMAL(3,2),
    
    -- Hierarchical structure
    hierarchy_level INTEGER DEFAULT 0,
    parent_chunk_id INTEGER,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Sections table for tracking individual report section generation
CREATE TABLE IF NOT EXISTS report_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_generation_id UUID REFERENCES report_generations(id) ON DELETE CASCADE,
    
    -- Section identification
    section_name TEXT NOT NULL,
    subsection_name TEXT,
    section_order INTEGER,
    
    -- Section generation
    query_used TEXT,
    chunks_retrieved JSONB DEFAULT '[]', -- Array of chunk IDs used
    generated_content TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    word_count INTEGER,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Sessions table (enhanced from existing chat_histories)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    session_name TEXT,
    
    -- Session metadata
    context_type TEXT DEFAULT 'general', -- general, report_generation, document_analysis
    active_report_id UUID REFERENCES report_generations(id),
    
    -- Session settings
    model_settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced chat messages (replacing n8n_chat_histories for better structure)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    -- Message content
    message_type TEXT NOT NULL CHECK (message_type IN ('human', 'ai', 'system')),
    content TEXT NOT NULL,
    
    -- AI-specific fields
    sources_used JSONB DEFAULT '[]', -- Source documents referenced
    chunks_used JSONB DEFAULT '[]', -- Specific chunks used
    citations JSONB DEFAULT '[]', -- Citation information
    
    -- Metadata
    token_count INTEGER,
    processing_time_ms INTEGER,
    model_used TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for pdf_metadata
CREATE INDEX IF NOT EXISTS idx_pdf_metadata_source_id ON pdf_metadata(source_id);
CREATE INDEX IF NOT EXISTS idx_pdf_metadata_notebook_id ON pdf_metadata(notebook_id);
CREATE INDEX IF NOT EXISTS idx_pdf_metadata_address ON pdf_metadata(address);
CREATE INDEX IF NOT EXISTS idx_pdf_metadata_document_type ON pdf_metadata(document_type);
CREATE INDEX IF NOT EXISTS idx_pdf_metadata_report_issued_date ON pdf_metadata(report_issued_date);

-- Indexes for report_generations
CREATE INDEX IF NOT EXISTS idx_report_generations_notebook_id ON report_generations(notebook_id);
CREATE INDEX IF NOT EXISTS idx_report_generations_template_id ON report_generations(template_id);
CREATE INDEX IF NOT EXISTS idx_report_generations_status ON report_generations(status);
CREATE INDEX IF NOT EXISTS idx_report_generations_created_at ON report_generations(created_at);

-- Indexes for chunks_metadata
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_chunk_id ON chunks_metadata(chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_source_id ON chunks_metadata(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_pdf_metadata_id ON chunks_metadata(pdf_metadata_id);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_section_title ON chunks_metadata(section_title);

-- Indexes for report_sections
CREATE INDEX IF NOT EXISTS idx_report_sections_report_generation_id ON report_sections(report_generation_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_status ON report_sections(status);
CREATE INDEX IF NOT EXISTS idx_report_sections_section_order ON report_sections(section_order);

-- Indexes for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_notebook_id ON chat_sessions(notebook_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_context_type ON chat_sessions(context_type);

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enhanced indexes for sources
CREATE INDEX IF NOT EXISTS idx_sources_processing_status ON sources(processing_status);
CREATE INDEX IF NOT EXISTS idx_sources_document_type ON sources(document_type);
CREATE INDEX IF NOT EXISTS idx_sources_metadata_extracted ON sources(metadata_extracted);
CREATE INDEX IF NOT EXISTS idx_sources_file_hash ON sources(file_hash);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all relevant tables
DROP TRIGGER IF EXISTS update_pdf_metadata_updated_at ON pdf_metadata;
CREATE TRIGGER update_pdf_metadata_updated_at 
    BEFORE UPDATE ON pdf_metadata 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;
CREATE TRIGGER update_report_templates_updated_at 
    BEFORE UPDATE ON report_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_generations_updated_at ON report_generations;
CREATE TRIGGER update_report_generations_updated_at 
    BEFORE UPDATE ON report_generations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chunks_metadata_updated_at ON chunks_metadata;
CREATE TRIGGER update_chunks_metadata_updated_at 
    BEFORE UPDATE ON chunks_metadata 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update chunk count in sources
CREATE OR REPLACE FUNCTION update_source_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sources 
    SET chunk_count = (
        SELECT COUNT(*) 
        FROM chunks_metadata 
        WHERE source_id = COALESCE(NEW.source_id, OLD.source_id)
    )
    WHERE id = COALESCE(NEW.source_id, OLD.source_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update chunk count
DROP TRIGGER IF EXISTS update_chunk_count_trigger ON chunks_metadata;
CREATE TRIGGER update_chunk_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON chunks_metadata
    FOR EACH ROW EXECUTE FUNCTION update_source_chunk_count();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE pdf_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust based on your authentication system)
-- Note: You'll need to modify these based on your actual auth setup

-- PDF Metadata policies
CREATE POLICY "Users can view pdf_metadata for their notebooks" ON pdf_metadata
    FOR SELECT USING (
        notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

CREATE POLICY "Users can insert pdf_metadata for their notebooks" ON pdf_metadata
    FOR INSERT WITH CHECK (
        notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

CREATE POLICY "Users can update pdf_metadata for their notebooks" ON pdf_metadata
    FOR UPDATE USING (
        notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

CREATE POLICY "Users can delete pdf_metadata for their notebooks" ON pdf_metadata
    FOR DELETE USING (
        notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

-- Report Templates policies (public read, restricted write)
CREATE POLICY "Anyone can view active report templates" ON report_templates
    FOR SELECT USING (is_active = true);

-- Report Generations policies
CREATE POLICY "Users can manage their report generations" ON report_generations
    FOR ALL USING (
        notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

-- Report Sections policies
CREATE POLICY "Users can manage report sections for their reports" ON report_sections
    FOR ALL USING (
        report_generation_id IN (
            SELECT rg.id FROM report_generations rg
            JOIN notebooks n ON rg.notebook_id = n.id
            WHERE n.user_id = auth.uid() OR n.user_id IS NULL
        )
    );

-- Chunks Metadata policies
CREATE POLICY "Users can manage chunks metadata for their notebooks" ON chunks_metadata
    FOR ALL USING (
        source_id IN (
            SELECT s.id FROM sources s
            JOIN notebooks n ON s.notebook_id = n.id
            WHERE n.user_id = auth.uid() OR n.user_id IS NULL
        )
    );

-- Chat Sessions policies
CREATE POLICY "Users can manage their chat sessions" ON chat_sessions
    FOR ALL USING (
        notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

-- Chat Messages policies
CREATE POLICY "Users can manage messages in their sessions" ON chat_messages
    FOR ALL USING (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN notebooks n ON cs.notebook_id = n.id
            WHERE n.user_id = auth.uid() OR n.user_id IS NULL
        )
    );

-- =====================================================
-- INITIAL DATA - SAMPLE REPORT TEMPLATES
-- =====================================================

-- Insert sample report templates
INSERT INTO report_templates (name, display_name, description, category, structure) VALUES
(
    'heritage_impact_report',
    'Heritage Impact Report',
    'Assessment of development impact on heritage-listed properties',
    'heritage',
    '{
        "sections": [
            {
                "name": "executive_summary",
                "title": "Executive Summary",
                "order": 1,
                "subsections": []
            },
            {
                "name": "introduction",
                "title": "Introduction",
                "order": 2,
                "subsections": [
                    {"name": "purpose", "title": "Purpose and Scope"},
                    {"name": "methodology", "title": "Methodology"},
                    {"name": "site_location", "title": "Site Location and Description"}
                ]
            },
            {
                "name": "heritage_context",
                "title": "Heritage Context",
                "order": 3,
                "subsections": [
                    {"name": "heritage_listing", "title": "Heritage Listing Details"},
                    {"name": "historical_significance", "title": "Historical Significance"},
                    {"name": "architectural_significance", "title": "Architectural Significance"}
                ]
            },
            {
                "name": "proposal_assessment",
                "title": "Proposal Assessment",
                "order": 4,
                "subsections": [
                    {"name": "development_description", "title": "Development Description"},
                    {"name": "heritage_impact", "title": "Heritage Impact Analysis"},
                    {"name": "visual_impact", "title": "Visual Impact Assessment"}
                ]
            },
            {
                "name": "recommendations",
                "title": "Recommendations",
                "order": 5,
                "subsections": [
                    {"name": "mitigation_measures", "title": "Mitigation Measures"},
                    {"name": "conditions", "title": "Recommended Conditions"}
                ]
            },
            {
                "name": "conclusion",
                "title": "Conclusion",
                "order": 6,
                "subsections": []
            }
        ]
    }'
) ON CONFLICT (name) DO NOTHING;

-- Create vector search function for matching documents
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_notebook_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  source_id uuid,
  chunk_metadata jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    v.id,
    v.content,
    (v.embedding <#> query_embedding) * -1 AS similarity,
    cm.source_id,
    jsonb_build_object(
      'section_title', cm.section_title,
      'subsection_title', cm.subsection_title,
      'page_numbers', cm.page_numbers,
      'content_type', cm.content_type,
      'hierarchy_level', cm.hierarchy_level
    ) AS chunk_metadata
  FROM vectors v
  LEFT JOIN chunks_metadata cm ON v.id::text = cm.chunk_id::text
  LEFT JOIN sources s ON cm.source_id = s.id
  WHERE (v.embedding <#> query_embedding) * -1 > match_threshold
    AND (filter_notebook_id IS NULL OR s.notebook_id = filter_notebook_id)
  ORDER BY (v.embedding <#> query_embedding) ASC
  LIMIT match_count;
$$;