# Town Planning RAG System - Complete API Documentation

## Overview

The Town Planning RAG System provides a comprehensive REST API for document processing, metadata extraction, vector search, and report generation. The API is built on Supabase with custom Edge Functions for specialized operations.

### Base URLs
- **Supabase API**: `https://your-project.supabase.co`
- **Edge Functions**: `https://your-project.supabase.co/functions/v1`
- **REST API**: `https://your-project.supabase.co/rest/v1`

### Authentication
All API endpoints require authentication using Supabase JWT tokens:

```bash
# Using Supabase anon key for client operations
Authorization: Bearer <anon_key>

# Using service role key for server operations
Authorization: Bearer <service_role_key>
```

## Core Endpoints

### 1. Document Management

#### Upload and Process PDF
```http
POST /functions/v1/process-pdf-with-metadata
Content-Type: application/json
Authorization: Bearer <token>

{
  "source_id": "uuid",
  "file_path": "notebook-id/file.pdf",
  "notebook_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "metadata": {
    "id": "uuid",
    "prepared_for": "Client Name",
    "prepared_by": "Consultant Name",
    "address": "123 Main St",
    "document_title": "Heritage Assessment Report",
    "document_type": "heritage_report",
    "confidence_score": 0.85
  },
  "chunks_count": 24,
  "message": "PDF processed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Missing required parameters: source_id, file_path"
}
```

#### Get Source Documents
```http
GET /rest/v1/sources?select=*,pdf_metadata(*)&notebook_id=eq.{notebook_id}
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "display_name": "Heritage Report.pdf",
    "file_path": "notebook/file.pdf",
    "file_size": 1048576,
    "processing_status": "completed",
    "created_at": "2024-01-01T00:00:00Z",
    "pdf_metadata": [
      {
        "prepared_for": "Client Name",
        "address": "123 Main St",
        "document_type": "heritage_report"
      }
    ]
  }
]
```

#### Update Source Metadata
```http
PATCH /rest/v1/sources?id=eq.{source_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "display_name": "Updated Document Name",
  "document_type": "development_assessment"
}
```

### 2. Vector Search

#### Batch Vector Search
```http
POST /functions/v1/batch-vector-search
Content-Type: application/json
Authorization: Bearer <token>

{
  "queries": [
    "heritage impact assessment requirements",
    "building height restrictions",
    "parking requirements for commercial development"
  ],
  "notebook_id": "uuid",
  "top_k": 5
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "query": "heritage impact assessment requirements",
      "results": [
        {
          "id": 123,
          "content": "Heritage impact assessments must evaluate...",
          "metadata": {
            "source_id": "uuid",
            "section_title": "Heritage Requirements"
          },
          "similarity": 0.89
        }
      ],
      "error": null
    }
  ],
  "total_queries": 3
}
```

#### Single Vector Search (via Supabase RPC)
```http
POST /rest/v1/rpc/match_documents
Content-Type: application/json
Authorization: Bearer <token>

{
  "query_embedding": "[0.1, 0.2, 0.3, ...]",
  "match_threshold": 0.5,
  "match_count": 10,
  "filter_notebook_id": "uuid"
}
```

### 3. Report Generation

#### Generate Report
```http
POST /functions/v1/generate-report
Content-Type: application/json
Authorization: Bearer <token>

{
  "notebook_id": "uuid",
  "template_id": "uuid",
  "topic": "Residential Extension Heritage Assessment",
  "address": "123 Heritage Street, Sydney NSW",
  "additional_context": "Two-storey extension to existing Victorian terrace"
}
```

**Response:**
```json
{
  "success": true,
  "report_generation_id": "uuid",
  "message": "Report generation started",
  "sections_count": 12
}
```

#### Get Report Status
```http
GET /rest/v1/report_generations?select=*,report_templates(display_name)&id=eq.{report_id}
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "topic": "Residential Extension Heritage Assessment",
    "status": "processing",
    "progress": 75,
    "file_path": null,
    "created_at": "2024-01-01T00:00:00Z",
    "report_templates": {
      "display_name": "Heritage Impact Report"
    }
  }
]
```

#### Download Generated Report
```http
GET /storage/v1/object/reports/{file_path}
Authorization: Bearer <token>
```

#### Get Report Sections Detail
```http
GET /rest/v1/report_sections?select=*&report_generation_id=eq.{report_id}&order=section_order
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "section_name": "heritage_context",
    "subsection_name": "historical_significance",
    "status": "completed",
    "generated_content": "The subject property demonstrates significant...",
    "word_count": 342,
    "section_order": 31
  }
]
```

### 4. Report Templates

#### Get All Templates
```http
GET /rest/v1/report_templates?select=*&is_active=eq.true&order=display_name
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "heritage_impact_report",
    "display_name": "Heritage Impact Report",
    "description": "Assessment of development impact on heritage-listed properties",
    "category": "heritage",
    "structure": {
      "sections": [
        {
          "name": "introduction",
          "title": "Introduction",
          "order": 1,
          "subsections": [
            {
              "name": "purpose",
              "title": "Purpose and Scope"
            }
          ]
        }
      ]
    }
  }
]
```

#### Get Template by ID
```http
GET /rest/v1/report_templates?select=*&id=eq.{template_id}
Authorization: Bearer <token>
```

#### Create Custom Template (Admin only)
```http
POST /rest/v1/report_templates
Content-Type: application/json
Authorization: Bearer <service_role_key>

{
  "name": "custom_assessment_report",
  "display_name": "Custom Assessment Report",
  "description": "Customized assessment report template",
  "category": "custom",
  "structure": {
    "sections": [
      {
        "name": "executive_summary",
        "title": "Executive Summary",
        "order": 1,
        "subsections": []
      }
    ]
  }
}
```

### 5. Chat Interface

#### Create Chat Session
```http
POST /rest/v1/chat_sessions
Content-Type: application/json
Authorization: Bearer <token>

{
  "notebook_id": "uuid",
  "session_name": "Heritage Consultation Chat",
  "context_type": "general"
}
```

#### Send Chat Message
```http
POST /rest/v1/chat_messages
Content-Type: application/json
Authorization: Bearer <token>

{
  "session_id": "uuid",
  "message_type": "human",
  "content": "What are the heritage requirements for alterations to Victorian terraces?"
}
```

#### Get Chat History
```http
GET /rest/v1/chat_messages?select=*&session_id=eq.{session_id}&order=created_at
Authorization: Bearer <token>
```

### 6. Metadata Management

#### Get PDF Metadata
```http
GET /rest/v1/pdf_metadata?select=*&source_id=eq.{source_id}
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "source_id": "uuid",
    "prepared_for": "City Council",
    "prepared_by": "Heritage Consultants Pty Ltd",
    "address": "45 Historic Lane, Heritage Suburb NSW 2000",
    "report_issued_date": "2024-01-15",
    "document_title": "Heritage Impact Assessment",
    "document_type": "heritage_assessment",
    "page_count": 34,
    "sections": [
      {
        "title": "Introduction",
        "level": 1,
        "page_start": 3,
        "page_end": 5
      }
    ],
    "keywords": ["heritage", "Victorian", "conservation", "impact"],
    "confidence_score": 0.92,
    "extracted_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Search by Metadata
```http
GET /rest/v1/pdf_metadata?or=(address.ilike.*heritage*,prepared_for.ilike.*council*)&order=extracted_at.desc
Authorization: Bearer <token>
```

### 7. Project Management

#### Get Notebooks (Projects)
```http
GET /rest/v1/notebooks?select=*&order=created_at.desc
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Heritage Precinct Development",
    "description": "Assessment of multiple properties in heritage precinct",
    "client_name": "City Planning Department",
    "project_type": "heritage",
    "address": "Heritage Precinct, Old Town",
    "contact_email": "planning@council.gov.au",
    "project_status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Create New Project
```http
POST /rest/v1/notebooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Commercial Development Assessment",
  "description": "Multi-use commercial development proposal",
  "client_name": "ABC Development Group",
  "project_type": "development",
  "address": "123-127 Commercial Road, Business District",
  "contact_email": "projects@abcdev.com.au",
  "contact_phone": "+61 2 9876 5432"
}
```

#### Update Project
```http
PATCH /rest/v1/notebooks?id=eq.{notebook_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "project_status": "completed",
  "description": "Updated project description"
}
```

### 8. System Monitoring

#### Get System Health
```http
POST /rest/v1/rpc/get_system_health
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "component": "database",
    "status": "healthy",
    "details": {
      "total_sources": 1245,
      "processing_sources": 3,
      "failed_sources": 2
    },
    "last_checked": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Performance Metrics
```http
POST /rest/v1/rpc/get_performance_metrics
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "metric_name": "avg_processing_time",
    "metric_value": 145.67,
    "metric_unit": "seconds",
    "measured_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Check Alerts
```http
POST /rest/v1/rpc/check_alert_conditions
Authorization: Bearer <token>
```

## Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `500` - Internal Server Error

### Error Response Format
```json
{
  "code": "error_code",
  "message": "Human readable error message",
  "details": {
    "field": "Additional error details",
    "hint": "Suggestion for fixing the error"
  },
  "hint": "General hint for resolution"
}
```

### Common Errors

#### Invalid Authentication
```json
{
  "code": "PGRST301",
  "message": "JWT expired",
  "details": {},
  "hint": "Please refresh your authentication token"
}
```

#### Rate Limiting
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests",
  "details": {
    "limit": 100,
    "window": "1 hour",
    "retry_after": 3600
  },
  "hint": "Please wait before making additional requests"
}
```

#### Processing Timeout
```json
{
  "code": "PROCESSING_TIMEOUT",
  "message": "Document processing timed out",
  "details": {
    "source_id": "uuid",
    "timeout": "300 seconds"
  },
  "hint": "Large documents may require more time. Please check status later."
}
```

## Rate Limits

### Default Limits
- **Authentication requests**: 60 per hour per IP
- **PDF processing**: 10 per hour per user
- **Report generation**: 5 per hour per user
- **Vector search**: 100 per hour per user
- **General API calls**: 1000 per hour per user

### Headers
Rate limit information is included in response headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Webhook Events
The system can send webhooks for various events:

#### Document Processing Complete
```json
{
  "event": "document.processing.completed",
  "data": {
    "source_id": "uuid",
    "notebook_id": "uuid",
    "processing_time": 145.67,
    "chunks_count": 24,
    "metadata_extracted": true
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Report Generation Complete
```json
{
  "event": "report.generation.completed",
  "data": {
    "report_generation_id": "uuid",
    "status": "completed",
    "file_path": "report_uuid_timestamp.md",
    "sections_completed": 12,
    "total_sections": 12
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### System Alert
```json
{
  "event": "system.alert",
  "data": {
    "alert_type": "high_failure_rate",
    "severity": "warning",
    "message": "Processing failure rate above threshold",
    "details": {
      "failure_rate": 15.5,
      "threshold": 10.0
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Webhook Configuration
```http
POST /rest/v1/webhook_configs
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://your-app.com/webhooks/town-planning",
  "events": ["document.processing.completed", "report.generation.completed"],
  "secret": "your_webhook_secret"
}
```

## SDK and Integration Examples

### JavaScript/TypeScript SDK
```typescript
// SDK usage example
import { TownPlanningAPI } from '@your-org/town-planning-sdk';

const api = new TownPlanningAPI({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-anon-key'
});

// Process a PDF
const result = await api.documents.process({
  notebookId: 'notebook-uuid',
  file: pdfFile,
  filename: 'heritage-report.pdf'
});

// Generate a report
const report = await api.reports.generate({
  notebookId: 'notebook-uuid',
  templateId: 'heritage-template-uuid',
  topic: 'Heritage Assessment',
  address: '123 Historic Street'
});

// Search documents
const searchResults = await api.search.vector({
  queries: ['heritage requirements', 'building restrictions'],
  notebookId: 'notebook-uuid',
  topK: 5
});
```

### Python SDK
```python
# Python SDK usage example
from town_planning_api import TownPlanningClient

client = TownPlanningClient(
    supabase_url="https://your-project.supabase.co",
    supabase_key="your-anon-key"
)

# Process PDF
result = client.documents.process(
    notebook_id="notebook-uuid",
    file_path="heritage-report.pdf"
)

# Generate report
report = client.reports.generate(
    notebook_id="notebook-uuid",
    template_id="heritage-template-uuid",
    topic="Heritage Assessment",
    address="123 Historic Street"
)

# Vector search
results = client.search.vector(
    queries=["heritage requirements", "building restrictions"],
    notebook_id="notebook-uuid",
    top_k=5
)
```

### cURL Examples

#### Process PDF
```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-pdf-with-metadata \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "source-uuid",
    "file_path": "notebook/file.pdf",
    "notebook_id": "notebook-uuid"
  }'
```

#### Generate Report
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-report \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notebook_id": "notebook-uuid",
    "template_id": "template-uuid",
    "topic": "Heritage Assessment",
    "address": "123 Historic Street"
  }'
```

#### Vector Search
```bash
curl -X POST https://your-project.supabase.co/functions/v1/batch-vector-search \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["heritage requirements"],
    "notebook_id": "notebook-uuid",
    "top_k": 5
  }'
```

## Testing

### Test Data Setup
```sql
-- Create test data for API testing
INSERT INTO notebooks (id, title, user_id) VALUES 
('test-notebook-uuid', 'Test Project', 'test-user');

INSERT INTO sources (id, notebook_id, display_name, processing_status) VALUES 
('test-source-uuid', 'test-notebook-uuid', 'Test Document.pdf', 'completed');

INSERT INTO pdf_metadata (source_id, notebook_id, document_title, document_type) VALUES 
('test-source-uuid', 'test-notebook-uuid', 'Test Heritage Report', 'heritage_report');
```

### API Testing
```javascript
// Jest test examples
describe('Town Planning API', () => {
  test('should process PDF successfully', async () => {
    const response = await fetch(`${API_BASE}/functions/v1/process-pdf-with-metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_id: 'test-source-uuid',
        file_path: 'test/document.pdf',
        notebook_id: 'test-notebook-uuid'
      })
    });
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.chunks_count).toBeGreaterThan(0);
  });
  
  test('should generate report successfully', async () => {
    const response = await fetch(`${API_BASE}/functions/v1/generate-report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notebook_id: 'test-notebook-uuid',
        template_id: 'heritage-template-uuid',
        topic: 'Test Development',
        address: 'Test Address'
      })
    });
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.report_generation_id).toBeDefined();
  });
});
```

This comprehensive API documentation provides complete coverage of all endpoints, request/response formats, error handling, rate limits, webhooks, and integration examples for the Town Planning RAG system.