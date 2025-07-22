# Environment Configuration & Setup

## Required Supabase Secrets

### Edge Function Secrets
Add these secrets to your Supabase project:

```bash
# Supabase CLI commands to set secrets
supabase secrets set LLAMACLOUD_API_KEY="your_llamacloud_api_key_here"
supabase secrets set OLLAMA_BASE_URL="http://your-ollama-server:11434"
supabase secrets set N8N_WEBHOOK_BASE_URL="http://your-n8n-server:5678"
supabase secrets set N8N_API_KEY="your_n8n_api_key"

# These are automatically available in edge functions
# SUPABASE_URL (automatically set)
# SUPABASE_SERVICE_ROLE_KEY (automatically set)
```

### Environment Variables for Local Development
Create a `.env.local` file in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# LlamaCloud API
LLAMACLOUD_API_KEY=your_llamacloud_api_key

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434

# n8n Configuration
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key
```

## Required API Keys and Services

### 1. LlamaCloud API
- Sign up at: https://cloud.llamaindex.ai/
- Get API key from dashboard
- Used for: Advanced PDF parsing and metadata extraction

### 2. Ollama Setup
```bash
# Install Ollama locally or on server
curl -fsSL https://ollama.ai/install.sh | sh

# Pull required models
ollama pull qwen3:8b-q4_K_M
ollama pull nomic-embed-text:latest

# Start Ollama server
ollama serve
```

### 3. n8n Configuration
Update your existing n8n workflows with new webhook endpoints and enhanced functionality.

## Enhanced n8n Workflows

### 1. Enhanced PDF Processing Workflow
```json
{
  "name": "InsightsLM - Enhanced PDF Processing",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "enhanced-pdf-processing",
        "authentication": "headerAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook - PDF Upload"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$('Webhook - PDF Upload').item.json.supabaseUrl}}/functions/v1/process-pdf-with-metadata",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "supabaseApi",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"source_id\": \"{{$('Webhook - PDF Upload').item.json.body.source_id}}\",\n  \"file_path\": \"{{$('Webhook - PDF Upload').item.json.body.file_path}}\",\n  \"notebook_id\": \"{{$('Webhook - PDF Upload').item.json.body.notebook_id}}\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "name": "Process PDF with Metadata"
    }
  ]
}
```

### 2. Report Generation Workflow
```json
{
  "name": "InsightsLM - Report Generation",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "generate-town-planning-report",
        "authentication": "headerAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook - Report Request"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$('Webhook - Report Request').item.json.supabaseUrl}}/functions/v1/generate-report",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "supabaseApi",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"notebook_id\": \"{{$('Webhook - Report Request').item.json.body.notebook_id}}\",\n  \"template_id\": \"{{$('Webhook - Report Request').item.json.body.template_id}}\",\n  \"topic\": \"{{$('Webhook - Report Request').item.json.body.topic}}\",\n  \"address\": \"{{$('Webhook - Report Request').item.json.body.address}}\",\n  \"additional_context\": \"{{$('Webhook - Report Request').item.json.body.additional_context}}\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "name": "Generate Report"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "leftValue": "={{$json.success}}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "name": "Check Success"
    }
  ]
}
```

### 3. Enhanced Chat Workflow
```json
{
  "name": "InsightsLM - Enhanced Chat",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "enhanced-chat",
        "authentication": "headerAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook - Chat Message"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "leftValue": "={{$json.body.message}}",
              "rightValue": "generate report",
              "operator": {
                "type": "string",
                "operation": "contains"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "name": "Check for Report Request"
    }
  ]
}
```

## Supabase Storage Buckets

Create the following storage buckets in Supabase:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
('sources', 'sources', false),
('reports', 'reports', false);

-- Set up storage policies
CREATE POLICY "Allow authenticated users to upload sources" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'sources' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read their sources" ON storage.objects
  FOR SELECT USING (bucket_id = 'sources' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to download reports" ON storage.objects
  FOR SELECT USING (bucket_id = 'reports' AND auth.role() = 'authenticated');
```

## Frontend Integration Examples

### React Component for Report Generation
```typescript
// components/ReportGenerator.tsx
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function ReportGenerator({ notebookId }: { notebookId: string }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [topic, setTopic] = useState('');
  const [address, setAddress] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = async () => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          notebook_id: notebookId,
          template_id: selectedTemplate,
          topic,
          address
        }
      });

      if (error) throw error;

      // Handle success - maybe redirect to report status page
      console.log('Report generation started:', data);
      
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Generate Town Planning Report</h2>
      
      <div>
        <label className="block text-sm font-medium mb-1">Report Type</label>
        <select 
          value={selectedTemplate} 
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full border rounded-md px-3 py-2"
        >
          <option value="">Select report type...</option>
          {templates.map((template: any) => (
            <option key={template.id} value={template.id}>
              {template.display_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Residential Extension, Commercial Development"
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Address (Optional)</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g., 123 Main Street, Sydney NSW"
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <button
        onClick={generateReport}
        disabled={!selectedTemplate || !topic || isGenerating}
        className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
      >
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
}
```

## Deployment Checklist

### 1. Supabase Setup
- [ ] Run migration script
- [ ] Set up edge function secrets
- [ ] Create storage buckets
- [ ] Deploy edge functions
- [ ] Configure RLS policies

### 2. External Services
- [ ] Set up LlamaCloud account and API key
- [ ] Install and configure Ollama
- [ ] Update n8n workflows
- [ ] Configure n8n webhooks

### 3. Frontend Updates
- [ ] Add report generation components
- [ ] Update environment variables
- [ ] Test PDF upload with metadata extraction
- [ ] Test report generation flow

### 4. Testing
- [ ] Test PDF processing with LlamaCloud
- [ ] Test metadata extraction
- [ ] Test semantic chunking
- [ ] Test report generation end-to-end
- [ ] Test vector search performance

## Performance Optimization

### Database Indexes
The migration script includes optimized indexes for:
- Vector similarity searches
- Report generation queries
- Metadata lookups
- Chat message retrieval

### Caching Strategy
Consider implementing:
- Redis cache for frequent queries
- Vector search result caching
- Report template caching
- Generated section caching

### Scaling Considerations
For production with 20,000+ PDFs:
- Use connection pooling
- Implement background job queues
- Consider read replicas for vector searches
- Use CDN for generated reports
- Implement rate limiting