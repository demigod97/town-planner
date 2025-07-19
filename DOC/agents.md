# MCP / AI-Agent Contract

## Web Functions Exposed

### Chat Interface
```
POST /functions/v1/proxy/chat
Content-Type: application/json

Request:
{
  "query": "What are the setback requirements?",
  "sessionId": "uuid"
}

Response (Stream):
{
  "token": "The setback requirements...",
  "citations": [
    {
      "fileId": "uuid",
      "filename": "zoning_code.pdf", 
      "page": 15,
      "text": "..."
    }
  ]
}
```

### Document Ingestion
```
POST /functions/v1/proxy/ingest
Content-Type: multipart/form-data

Request:
- file: PDF binary data

Response:
{
  "jobId": "uuid",
  "status": "processing"
}
```

### Template Generation
```
POST /functions/v1/proxy/template
Content-Type: application/json

Request:
{
  "sessionId": "uuid",
  "permitType": "residential",
  "address": "123 Main St",
  "applicant": "John Doe"
}

Response:
{
  "templateId": "uuid",
  "downloadUrl": "signed_url"
}
```

### Connection Testing
```
POST /functions/v1/proxy/test
Content-Type: application/json

Request:
{
  "field": "chat|ingest|template|n8n",
  "key": "webhook_url_or_api_key"
}

Response:
{
  "ok": true
} | {
  "ok": false,
  "error": "Connection failed"
}
```

## Supabase Schema

### hh_chat_sessions
```sql
id          UUID PRIMARY KEY
title       TEXT NOT NULL DEFAULT 'New Chat'
user_id     UUID REFERENCES auth.users
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### hh_uploads
```sql
id          UUID PRIMARY KEY
filename    TEXT NOT NULL
file_path   TEXT
file_size   BIGINT NOT NULL
user_id     UUID REFERENCES auth.users
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Future Tables (TBD)
- `hh_chat_messages` - Chat history storage
- `hh_templates` - Generated permit templates
- `hh_pdf_vectors` - Document embeddings
- `hh_telemetry` - Usage analytics

## n8n Workflow Integration

### Workflow IDs (Placeholders)
- **Chat Workflow**: Processes user queries → RAG retrieval → LLM response
- **Ingest Workflow**: PDF upload → OCR → chunking → embedding → storage
- **Template Workflow**: Session context → permit form → document generation

### Expected I/O
```javascript
// Chat workflow input
{
  "query": "string",
  "sessionId": "uuid",
  "sources": ["fileId1", "fileId2"]
}

// Chat workflow output
{
  "response": "string",
  "citations": [...],
  "tokenUsage": {...}
}
```

## LLM Provider Configuration

Settings are managed via `useSettings` hook and stored in localStorage:

```typescript
interface Settings {
  chatUrl: string;        // n8n chat webhook
  ingestUrl: string;      // n8n ingest webhook  
  templateUrl: string;    // n8n template webhook
  n8nBaseUrl: string;     // n8n file upload
  llmProvider: 'OPENAI' | 'OLLAMA';
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}
```

## File Locations

### Core Hooks
- `src/hooks/useSettings.tsx` - Settings context & persistence
- `src/hooks/useAuth.ts` - Supabase authentication
- `src/hooks/useSession.tsx` - Chat session management

### API Layer
- `src/lib/api.ts` - Proxy function calls
- `supabase/functions/proxy/index.ts` - Edge function router

### UI Components
- `src/components/SettingsModal.tsx` - Configuration panel
- `src/components/ChatStream.tsx` - Chat interface
- `src/components/SourcesSidebar.tsx` - PDF management

### Assets
- `public/lottie/thinking.json` - Loading animation
- `src/index.css` - Design system tokens