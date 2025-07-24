# 🏙️ Town Planner RAG System

A **multi‑LLM, retrieval‑augmented generation (RAG)** platform for town‑planning professionals. Upload planning documents (PDF/DOCX), extract structured data & metadata, ask contextual questions, and auto‑generate professional reports with comprehensive error handling and offline support.

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Installation & Setup](#-installation--setup)
  - [Environment Configuration](#environment-configuration)
  - [Supabase Configuration](#supabase-configuration)
  - [N8N Configuration](#n8n-configuration)
  - [Edge Functions Setup](#edge-functions-setup)
  - [Ollama Setup (Optional)](#ollama-setup-optional)
- [🗄️ Database Schema](#️-database-schema)
- [🚨 Error Handling System](#-error-handling-system)
- [🔌 Edge Functions](#-edge-functions)
- [🤖 N8N Workflows](#-n8n-workflows)
- [📚 API Documentation](#-api-documentation)
- [🧪 Testing](#-testing)
- [🔧 Troubleshooting](#-troubleshooting)
- [📈 Monitoring & Analytics](#-monitoring--analytics)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🎯 Overview

The Town Planner RAG System is a comprehensive AI-powered platform designed for town planning professionals. It combines advanced document processing, semantic search, and multi-LLM capabilities to streamline planning workflows.

### Key Capabilities
- **Intelligent Document Processing**: AI-powered PDF parsing with metadata extraction
- **Multi-LLM Support**: Switch between Ollama (local), OpenAI, Gemini, and LlamaCloud
- **Semantic Search**: Vector-based document search with pgvector
- **Automated Report Generation**: Template-driven planning report creation
- **Real-time Collaboration**: Live updates and processing status
- **Comprehensive Error Handling**: Robust error recovery and offline support

## ✨ Key Features

| Area | Highlights |
|------|------------|
| **🔍 Document Ingestion** | • LlamaCloud OCR + markdown parsing<br>• AI metadata discovery<br>• Semantic chunking with table preservation |
| **🔎 Vector Search** | • Postgres `pgvector` extension<br>• Fast cosine similarity via `ivfflat` index<br>• Multi-query batch processing |
| **🤖 Multi‑LLM Support** | • Ollama (local), OpenAI, Gemini, LlamaCloud<br>• Provider fallbacks and circuit breakers<br>• Unified config via `LLM_DEFAULTS` |
| **📄 Report Engine** | • Template-driven content generation<br>• Section-by-section report building<br>• Context synthesis from multiple sources |
| **⚡ Real-time Workflows** | • n8n webhooks orchestrate processing<br>• Live status updates<br>• Background job processing |
| **🔒 Security & Multi‑Tenant** | • Supabase Auth + RLS on every table<br>• Per‑user storage buckets<br>• Comprehensive error logging |
| **🛡️ Error Handling** | • Graceful degradation<br>• Offline queue processing<br>• Circuit breakers and retry logic |

## 🏗️ Architecture

```mermaid
flowchart TD
  FE["React Frontend<br/>(Vite + TypeScript)"] -->|REST / WebSocket| SB[(Supabase<br/>DB + Storage + Auth)]
  FE -->|invoke()| EF[(Edge Functions<br/>Deno Runtime)]
  SB -->|triggers| EF
  EF -->|queue job| N8N[n8n Workflows<br/>Orchestration]
  N8N -->|embedding / chat| LLM[LLM Mesh<br/>Ollama · OpenAI · Gemini]
  SB -->|pgvector| LLM
  FE <-->|streams| N8N
  
  subgraph "Error Handling"
    EH[Error Handler]
    CB[Circuit Breaker]
    OQ[Offline Queue]
    NM[Network Monitor]
  end
  
  FE --> EH
  EH --> CB
  EH --> OQ
  EH --> NM
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Modern UI with type safety |
| **Styling** | Tailwind CSS + shadcn/ui | Consistent design system |
| **Backend** | Supabase (Postgres + Auth + Storage) | Full-stack backend platform |
| **Database** | PostgreSQL 15 + pgvector 0.7.0 | Vector database for semantic search |
| **Edge Runtime** | Supabase Edge Functions (Deno) | Serverless compute |
| **Orchestration** | n8n | Workflow automation and webhooks |
| **LLM Providers** | Ollama, OpenAI, Gemini, LlamaCloud | Multi-provider AI capabilities |
| **Error Handling** | Custom error system | Comprehensive error management |

## 📋 Prerequisites

- **Node.js 18+** and npm/pnpm
- **Supabase Account** with a project created
- **n8n Instance** (local Docker or hosted)
- **API Keys** for LLM providers:
  - LlamaCloud API key (for PDF parsing)
  - OpenAI API key (optional)
  - Gemini API key (optional)
- **Ollama** installed locally (optional, for local LLM)

## 🚀 Installation & Setup

### Environment Configuration

1. **Clone the repository**:
```bash
git clone <repository-url>
cd town-planner
npm install
```

2. **Create `.env.local`** file:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://ttbcziwdfkorkopgouar.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM Provider API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
LLAMACLOUD_API_KEY=llx-...

# Ollama Configuration (Local)
OLLAMA_BASE_URL=http://localhost:11434

# N8N Configuration
VITE_N8N_CHAT_WEBHOOK=https://n8n.coralshades.ai/webhook-test/hhlm-chat
VITE_N8N_INGEST_URL=https://n8n.coralshades.ai/webhook-test/ingest
VITE_N8N_TEMPLATE_URL=https://n8n.coralshades.ai/webhook-test/template
VITE_N8N_BASE_URL=https://n8n.coralshades.ai
VITE_N8N_API_KEY=your_n8n_api_key

# Development Configuration
NODE_ENV=development
VITE_APP_NAME=HHLM Town Planner
VITE_APP_VERSION=1.0.0
```

### Supabase Configuration

#### 1. **Link to Supabase Project**
```bash
npm install -g supabase
supabase link --project-ref ttbcziwdfkorkopgouar
```

#### 2. **Deploy Database Schema**
```bash
supabase db push
```

#### 3. **Set Up Storage Buckets**
Create the following storage buckets in Supabase:
- `sources` (private) - For uploaded PDF documents
- `reports` (private) - For generated reports

#### 4. **Configure Authentication**
- Enable email/password authentication
- Disable email confirmation for development
- Set up RLS policies (automatically applied via migrations)

### N8N Configuration

#### 1. **Start N8N Instance**
```bash
# Using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Or using npm
npx n8n
```

#### 2. **Import Workflows**
1. Open n8n UI at http://localhost:5678
2. Import the following workflows:
   - **Chat Handler** (`/webhook/hhlm-chat`) - Processes chat messages
   - **Document Ingest** (`/webhook/ingest`) - Handles file uploads
   - **Template Generator** (`/webhook/template`) - Creates report templates
   - **Embedding Generator** (`/webhook/generate-embeddings`) - Batch embedding creation

#### 3. **Configure Credentials**
Set up these credentials in n8n:

| Credential | Type | Configuration |
|------------|------|---------------|
| Supabase | HTTP Request | Base URL: `https://ttbcziwdfkorkopgouar.supabase.co`<br/>Headers: `Authorization: Bearer <service_role_key>` |
| Ollama | HTTP Request | Base URL: `http://localhost:11434` |
| OpenAI | HTTP Request | Base URL: `https://api.openai.com/v1`<br/>Headers: `Authorization: Bearer <api_key>` |

### Edge Functions Setup

#### 1. **Deploy Edge Functions**
```bash
# Deploy all functions
supabase functions deploy process-pdf-with-metadata --no-verify-jwt
supabase functions deploy batch-vector-search --no-verify-jwt
supabase functions deploy generate-report --no-verify-jwt
supabase functions deploy process-report-sections --no-verify-jwt
supabase functions deploy generate-embeddings --no-verify-jwt
supabase functions deploy trigger-n8n --no-verify-jwt
```

#### 2. **Set Environment Variables**
```bash
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set LLAMACLOUD_API_KEY=your_key
supabase secrets set OLLAMA_BASE_URL=http://host.docker.internal:11434
supabase secrets set N8N_WEBHOOK_BASE_URL=http://host.docker.internal:5678
supabase secrets set N8N_API_KEY=your_n8n_api_key
```

### Ollama Setup (Optional)

For local LLM capabilities:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull qwen3:8b-q4_K_M       # For chat/generation
ollama pull nomic-embed-text      # For embeddings

# Start Ollama server
ollama serve
```

## 🗄️ Database Schema

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| **`user_profiles`** | Extended user data | Preferences, LLM settings |
| **`notebooks`** | Project containers | Client details, project metadata |
| **`sources`** | Uploaded documents | Processing status, file metadata |
| **`metadata_schema`** | Dynamic field definitions | AI-discovered metadata fields |
| **`pdf_metadata`** & **`pdf_metadata_values`** | Extracted document metadata | Structured data extraction |
| **`document_chunks`** | Semantic text chunks | 400-token windows with embeddings |
| **`chunk_embeddings`** | Vector embeddings | 768D vectors with pgvector |
| **`chat_sessions`** & **`chat_messages`** | Conversation data | Multi-LLM chat history |
| **`report_templates`** & **`report_generations`** | Report system | Template-driven report creation |
| **`processing_jobs`** | Background tasks | Job queue and status tracking |

### Database Schema Details

#### User Management
```sql
-- Extended user profiles with LLM preferences
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  organization TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'viewer')),
  preferences JSONB DEFAULT '{"llm_model": "qwen3:8b-q4_K_M", "llm_provider": "ollama"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Document Processing
```sql
-- Document sources with processing status
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  display_name TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  metadata_extracted BOOLEAN DEFAULT FALSE,
  chunk_count INTEGER DEFAULT 0,
  embedding_count INTEGER DEFAULT 0,
  extracted_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Vector Search
```sql
-- Document chunks for semantic search
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_hash TEXT,
  chunk_index INTEGER NOT NULL,
  start_page INTEGER,
  end_page INTEGER,
  section_title TEXT,
  subsection_title TEXT,
  hierarchy_level INTEGER DEFAULT 0,
  chunk_type TEXT DEFAULT 'text' CHECK (chunk_type IN ('text', 'table', 'list', 'heading', 'caption')),
  word_count INTEGER,
  char_count INTEGER,
  embedding_generated BOOLEAN DEFAULT FALSE,
  embedding_model TEXT,
  embedding_generated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  search_text TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector embeddings with pgvector
CREATE TABLE chunk_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  embedding VECTOR(768),
  embedding_model TEXT,
  embedding_dimension INTEGER DEFAULT 768,
  content TEXT, -- Denormalized for faster search
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chunk_id, embedding_model)
);

-- Vector search index
CREATE INDEX idx_embeddings_vector ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops);
```

#### Error Logging
```sql
-- Comprehensive error logging
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  message TEXT NOT NULL,
  user_message TEXT NOT NULL,
  error_code TEXT,
  details JSONB,
  context JSONB,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  user_agent TEXT,
  url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Error analytics view
CREATE VIEW error_analytics AS
SELECT 
  error_type,
  severity,
  COUNT(*) as occurrence_count,
  COUNT(DISTINCT user_id) as affected_users,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence,
  AVG(CASE WHEN resolved THEN EXTRACT(EPOCH FROM (resolved_at - timestamp)) END) as avg_resolution_time
FROM error_logs 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY error_type, severity
ORDER BY occurrence_count DESC;
```

### Row Level Security (RLS)

All tables have RLS enabled with user-based policies:

```sql
-- Example RLS policies
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notebooks" ON notebooks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create notebooks" ON notebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebooks" ON notebooks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notebooks" ON notebooks
  FOR DELETE USING (auth.uid() = user_id);
```

## 🚨 Error Handling System

### Error Classification

The system categorizes errors into types and severity levels:

#### Error Types
- **`NETWORK`** - Connection and fetch failures
- **`API`** - Supabase and external API errors
- **`VALIDATION`** - Input validation failures
- **`AUTHENTICATION`** - Auth and permission errors
- **`FILE_UPLOAD`** - File processing errors
- **`PROCESSING`** - Background job failures
- **`LLM_PROVIDER`** - AI service errors
- **`STORAGE`** - File storage errors

#### Severity Levels
- **`CRITICAL`** - System-breaking errors requiring immediate attention
- **`HIGH`** - Major functionality impacted, user workflow blocked
- **`MEDIUM`** - Feature degradation, workarounds available
- **`LOW`** - Minor issues, minimal user impact

### Error Recovery Mechanisms

#### 1. **Circuit Breaker Pattern**
```typescript
// Automatically opens circuit after 5 failures
const circuitBreaker = new CircuitBreaker('api_operation', {
  failureThreshold: 5,
  timeout: 60000 // 1 minute
});
```

#### 2. **Retry with Exponential Backoff**
```typescript
await RetryHandler.withRetry(operation, {
  maxRetries: 3,
  delay: 1000,
  backoff: 2,
  shouldRetry: (error) => error.retryable
});
```

#### 3. **Offline Queue Processing**
```typescript
// Queue operations when offline
if (!navigator.onLine) {
  OfflineQueue.getInstance().addToQueue('upload_file', data, 'high');
}
```

#### 4. **Graceful Degradation**
```typescript
// Fallback to cached data or simplified functionality
const result = await GracefulDegradation.withFallback(
  primaryOperation,
  fallbackOperation,
  'context'
);
```

### User-Friendly Error Messages

| Technical Error | User Message | Action |
|----------------|--------------|--------|
| `TypeError: fetch failed` | "Connection problem. Please check your internet connection." | Retry button |
| `23505: duplicate key` | "This item already exists. Please use a different name." | Form validation |
| `PGRST116: No rows returned` | "No data found for your request." | Refresh or search |
| `File size exceeds limit` | "File is too large. Please choose a smaller file (max 50MB)." | File selection |

### Error Monitoring Dashboard

Access the error dashboard at `/error-dashboard` to view:
- **Error Statistics**: Total errors, affected users, critical issues
- **Error Breakdown**: By type, severity, and time period
- **Performance Metrics**: Response times and success rates
- **Recent Errors**: Latest error occurrences with context

## 🔌 Edge Functions

### Function Overview

| Function | Purpose | Trigger |
|----------|---------|---------|
| **`process-pdf-with-metadata`** | PDF parsing and metadata extraction | File upload |
| **`batch-vector-search`** | Multi-query semantic search | Chat and report generation |
| **`generate-report`** | Report scaffolding and section queries | Template generation |
| **`process-report-sections`** | Section content generation | Report processing |
| **`generate-embeddings`** | Batch embedding creation | Document processing |
| **`trigger-n8n`** | N8N webhook proxy | Various triggers |

### Function Details

#### Process PDF with Metadata
```typescript
// Handles PDF parsing with multiple providers
POST /functions/v1/process-pdf-with-metadata
{
  "source_id": "uuid",
  "file_path": "path/to/file.pdf",
  "notebook_id": "uuid",
  "llm_provider": "llamacloud|ollama|openai|gemini",
  "llm_config": { "model": "...", "temperature": 0.1 }
}
```

#### Batch Vector Search
```typescript
// Performs semantic search across multiple queries
POST /functions/v1/batch-vector-search
{
  "queries": ["query1", "query2"],
  "notebook_id": "uuid",
  "top_k": 10,
  "similarity_threshold": 0.7,
  "embedding_provider": "ollama|openai|gemini"
}
```

### Error Handling in Edge Functions

All edge functions include comprehensive error handling:

```typescript
try {
  // Function logic
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
} catch (error) {
  console.error('Function error:', error);
  
  // Update related records with error status
  await updateErrorStatus(error);
  
  return new Response(JSON.stringify({
    success: false,
    error: error.message,
    error_type: classifyError(error)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 500
  });
}
```

## 🤖 N8N Workflows

### Workflow Configuration

#### 1. **Chat Handler Workflow**
- **Webhook**: `/webhook/hhlm-chat`
- **Purpose**: Process chat messages with context retrieval
- **Flow**: Message → Context Search → LLM Processing → Response

#### 2. **Document Ingest Workflow**
- **Webhook**: `/webhook/ingest`
- **Purpose**: Handle file upload processing
- **Flow**: File Upload → PDF Processing → Chunking → Embedding Generation

#### 3. **Template Generator Workflow**
- **Webhook**: `/webhook/template`
- **Purpose**: Generate planning report templates
- **Flow**: Template Request → Section Generation → Document Assembly

#### 4. **Embedding Generator Workflow**
- **Webhook**: `/webhook/generate-embeddings`
- **Purpose**: Batch process document embeddings
- **Flow**: Chunk Batch → Embedding API → Database Storage

### Workflow Error Handling

Each workflow includes:
- **Error Nodes**: Catch and handle failures gracefully
- **Retry Logic**: Automatic retries with exponential backoff
- **Fallback Paths**: Alternative processing routes
- **Status Updates**: Real-time progress reporting

## 📚 API Documentation

### Authentication

All API calls require authentication via Supabase:

```typescript
// Client-side authentication
const { data: { user } } = await supabase.auth.getUser();
```

### Core API Functions

#### File Upload
```typescript
const result = await uploadFile(file, notebookId, userQuery);
// Returns: { id, display_name, file_size, processing_status }
```

#### Chat Operations
```typescript
const sessionId = await createChatSession(notebookId, sourceIds);
const response = await sendChatMessage(sessionId, message);
// Returns: { role: 'assistant', content: '...', metadata: {...} }
```

#### Report Generation
```typescript
const reportId = await generateReport({
  notebookId,
  templateId,
  topic,
  address,
  additionalContext
});
```

### Error Response Format

All API functions return consistent error responses:

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  error_type: ErrorType;
  severity: ErrorSeverity;
  retry_after?: number;
  suggestions?: string[];
}
```

## 🧪 Testing

### Test the Complete Setup

#### 1. **Database Connection**
```sql
-- Run in Supabase SQL editor
SELECT COUNT(*) FROM notebooks;
SELECT COUNT(*) FROM metadata_schema;
```

#### 2. **Edge Functions**
```bash
# Test PDF processing
curl -X POST https://ttbcziwdfkorkopgouar.supabase.co/functions/v1/process-pdf-with-metadata \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

#### 3. **N8N Webhooks**
```bash
# Test chat webhook
curl -X POST http://localhost:5678/webhook/hhlm-chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","message":"Hello"}'
```

#### 4. **Error Handling**
```bash
# Test error logging
npm run test:errors
```

### End-to-End Testing

Run the complete workflow:
1. **Upload a PDF** → Check processing status
2. **Start a chat** → Verify context retrieval
3. **Generate a report** → Confirm template creation
4. **Test offline mode** → Verify queue processing
5. **Trigger errors** → Confirm error handling

## 🔧 Troubleshooting

### Common Issues and Solutions

#### PDF Processing Stuck
```bash
# Check edge function logs
supabase functions logs process-pdf-with-metadata --follow

# Verify LlamaCloud API key
supabase secrets list | grep LLAMACLOUD

# Check processing jobs
SELECT * FROM processing_jobs WHERE status = 'processing';
```

#### Chat Not Working
```bash
# Verify n8n workflows are active
curl http://localhost:5678/api/v1/workflows

# Check webhook connectivity
curl -X POST http://localhost:5678/webhook/hhlm-chat \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Review chat session logs
SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT 5;
```

#### Embeddings Not Generated
```bash
# Check Ollama status
ollama list
curl http://localhost:11434/api/tags

# Verify embedding function
supabase functions logs generate-embeddings --follow

# Check embedding records
SELECT COUNT(*) FROM chunk_embeddings;
```

#### Network/Offline Issues
```bash
# Check offline queue status
localStorage.getItem('offline_queue')

# Monitor network status
navigator.onLine

# Review error logs
SELECT * FROM error_logs WHERE error_type = 'NETWORK' ORDER BY timestamp DESC;
```

### Debug Commands

```bash
# View all edge function logs
supabase functions logs --tail

# Check specific function
supabase functions logs process-pdf-with-metadata --tail

# Test Supabase connection
supabase status

# Check n8n logs
docker logs n8n -f

# Run error handling tests
npm run claude:check
```

## 📈 Monitoring & Analytics

### Performance Metrics

Monitor these key metrics:

| Metric | Target | Query |
|--------|--------|-------|
| **PDF Processing Time** | < 2 minutes | `SELECT AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))) FROM sources WHERE processing_status = 'completed'` |
| **Chat Response Time** | < 5 seconds | `SELECT AVG(response_time_ms) FROM chat_messages WHERE created_at > NOW() - INTERVAL '24 hours'` |
| **Error Rate** | < 5% | `SELECT (COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) * 100.0 / COUNT(*)) FROM error_logs WHERE timestamp > NOW() - INTERVAL '24 hours'` |
| **Embedding Success Rate** | > 95% | `SELECT (COUNT(*) FILTER (WHERE embedding_generated = true) * 100.0 / COUNT(*)) FROM document_chunks` |

### Error Analytics

Access comprehensive error analytics:

```sql
-- Error trends over time
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  error_type,
  COUNT(*) as error_count
FROM error_logs 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour, error_type
ORDER BY hour DESC;

-- Most affected users
SELECT 
  user_id,
  COUNT(*) as error_count,
  COUNT(DISTINCT error_type) as unique_error_types
FROM error_logs 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY error_count DESC
LIMIT 10;
```

### Health Checks

Automated health monitoring:

```typescript
// Health check endpoint
GET /api/health
{
  "status": "healthy",
  "services": {
    "database": "up",
    "edge_functions": "up", 
    "n8n": "up",
    "ollama": "up"
  },
  "metrics": {
    "error_rate": "2.1%",
    "avg_response_time": "1.2s",
    "active_users": 42
  }
}
```

## 🛡️ Security Checklist

- [x] **API Keys**: All keys stored as Supabase secrets
- [x] **RLS Policies**: Row-level security on all tables
- [x] **Storage ACL**: Private buckets with user-based access
- [x] **CORS**: Properly configured for production
- [x] **Input Validation**: Comprehensive validation on all inputs
- [x] **Error Sanitization**: No sensitive data in error messages
- [x] **Audit Logging**: All operations logged for security review

## 🚀 Deployment

### Production Checklist

#### Supabase
- [ ] Enable point-in-time recovery
- [ ] Configure backup retention
- [ ] Set up monitoring alerts
- [ ] Review and optimize RLS policies
- [ ] Enable audit logging

#### N8N
- [ ] Use environment variables for all credentials
- [ ] Set up error notification workflows
- [ ] Configure webhook authentication
- [ ] Enable execution history retention
- [ ] Set up monitoring dashboards

#### Edge Functions
- [ ] Optimize function performance
- [ ] Set appropriate timeout values
- [ ] Configure error alerting
- [ ] Enable function metrics
- [ ] Review memory usage

### Environment-Specific Configuration

| Environment | Database | N8N | Edge Functions | Error Logging |
|-------------|----------|-----|----------------|---------------|
| **Development** | Local Supabase | Docker container | Local deployment | Console + Local storage |
| **Staging** | Supabase staging | Hosted n8n | Staging functions | Database + External service |
| **Production** | Supabase production | Production n8n | Production functions | Full logging + Alerts |

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm install`
4. **Set up environment**: Copy `.env.example` to `.env.local`
5. **Run tests**: `npm run test`
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow project linting rules
- **Error Handling**: Use the error handling system for all operations
- **Testing**: Write tests for new functionality
- **Documentation**: Update README for significant changes

### Testing Guidelines

```bash
# Run all tests
npm run test

# Test Supabase integration
npm run test:supabase

# Test error handling
npm run claude:check

# Run end-to-end tests
npm run test:e2e
```

## 📞 Support & Resources

### Documentation Links
- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **N8N Documentation**: [https://docs.n8n.io/](https://docs.n8n.io/)
- **pgvector Guide**: [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- **Ollama Documentation**: [https://github.com/ollama/ollama](https://github.com/ollama/ollama)

### Getting Help

For support and questions:
- 📧 **Email**: support@townplanner.ai
- 💬 **Discord**: [Town Planner Community](https://discord.gg/townplanner)
- 🐛 **Issues**: [GitHub Issues](https://github.com/townplanner/issues)
- 📖 **Wiki**: [Project Wiki](https://github.com/townplanner/wiki)

### Quick Commands

```bash
# Start all services
npm run dev

# Check system health
npm run claude:health

# View error dashboard
npm run claude:errors

# Deploy edge functions
npm run functions:deploy

# Reset database
npm run supabase:reset
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎉 Acknowledgments

- **Supabase Team** for the excellent backend platform
- **N8N Community** for workflow automation capabilities
- **pgvector Contributors** for vector database functionality
- **Ollama Project** for local LLM capabilities
- **OpenAI & Google** for AI API services

---

**Built with ❤️ by the Town Planner Team**

*Last Updated: January 2025*