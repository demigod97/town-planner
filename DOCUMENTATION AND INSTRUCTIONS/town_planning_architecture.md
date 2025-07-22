# Town Planning RAG System - Complete Architecture

## System Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │────│  Supabase API    │────│   n8n Workflows │
│                 │    │  + Edge Functions │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        │
                         ┌──────▼──────┐        ┌──────▼──────┐
                         │  Supabase   │        │   Ollama    │
                         │  Vector DB  │        │ Local Models│
                         │ + Postgres  │        │             │
                         └─────────────┘        └─────────────┘
                                │
                         ┌──────▼──────┐
                         │ LlamaCloud  │
                         │  API for    │
                         │PDF Parsing  │
                         └─────────────┘
```

## Core Components

### 1. Database Schema

#### Enhanced Tables for Town Planning System

**documents** (existing - enhanced)
- Enhanced vector storage with better metadata support

**pdf_metadata** (new)
- Stores extracted metadata from PDFs

**report_templates** (new)
- Defines structure for different report types

**report_generations** (new)
- Tracks generated reports and their status

**chunks_metadata** (new)
- Associates chunks with extracted metadata

**sources** (enhanced)
- Enhanced document management

**notebooks** (enhanced)
- Project/client management

### 2. Edge Functions

#### process-pdf-with-metadata
- Integrates with LlamaCloud API
- Extracts structured content and metadata
- Handles semantic chunking

#### generate-report
- Orchestrates report generation process
- Manages batch vector searches
- Assembles final reports

#### batch-vector-search
- Performs multiple vector searches efficiently
- Returns structured results for report sections

#### query-generator
- Generates semantic queries for report sections
- Uses report templates to create targeted queries

### 3. n8n Workflows (Enhanced)

#### Enhanced PDF Processing Workflow
- Integrates LlamaCloud for better parsing
- Extracts and stores metadata
- Performs semantic chunking

#### Report Generation Workflow
- Handles user requests for report generation
- Orchestrates the entire report creation process
- Manages file output and downloads

#### Metadata Extraction Workflow
- Specialized workflow for metadata processing
- Validates and enriches extracted data

### 4. Frontend Components

#### Report Generator Interface
- Select report types
- Input address/topic
- Configure report parameters

#### Enhanced Chat Interface
- Existing chat with report generation capabilities
- Context-aware responses

#### Report Management
- Download generated reports
- View report history
- Manage templates

## Data Flow

### PDF Processing Flow
1. User uploads PDF → React Frontend
2. Frontend calls Supabase Edge Function
3. Edge Function sends to LlamaCloud API
4. Structured content returned + metadata extracted
5. Semantic chunking performed
6. Chunks + metadata stored in Supabase
7. Vector embeddings generated via n8n
8. Status updates sent to frontend

### Report Generation Flow
1. User selects report type + inputs → Frontend
2. Frontend calls report generation edge function
3. Edge function loads report template structure
4. Generates semantic queries for each section
5. Performs batch vector searches
6. Sends context to Ollama for content generation
7. Assembles final report (Markdown/DOCX/PDF)
8. Returns download link to user

## Security & Configuration

### Environment Variables
- LLAMACLOUD_API_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OLLAMA_BASE_URL
- N8N_WEBHOOK_BASE_URL

### RLS Policies
- Row-level security for multi-tenant support
- User-based access control for reports
- Organization-level data isolation

## Scalability Considerations

### For 20,000 PDFs
- Batch processing workflows
- Chunked embedding generation
- Efficient vector search indexes
- Caching layer for common queries
- Background processing queues

### Performance Optimizations
- Vector index optimization
- Semantic caching
- Report template caching
- Parallel processing workflows