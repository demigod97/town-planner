# Edge Functions Setup and Deployment Guide

## Overview

This guide covers deploying your custom edge functions for the town-planner project. We have created two main edge functions:

1. **`n8n-proxy`** - Comprehensive proxy for n8n workflow integration
2. **`trigger-n8n`** - Specific function for triggering n8n workflow steps

## 📁 File Structure

```
supabase/functions/
├── .env.example                 # Environment variables template
├── n8n-proxy/
│   └── index.ts                # Main proxy function
├── trigger-n8n/
│   └── index.ts                # Workflow trigger function
├── proxy/                      # Existing proxy (can be removed)
├── upload/
├── chat/
└── messages/
```

## 🚀 Deployment Steps

### 1. Set Up Environment Variables

First, configure your environment variables for the functions:

```bash
# Copy the example environment file
cp supabase/functions/.env.example supabase/functions/.env

# Edit the .env file with your actual values
# For local development:
VITE_N8N_CHAT_WEBHOOK=http://localhost:5678/webhook/hhlm-chat
VITE_N8N_INGEST_URL=http://localhost:5678/webhook/ingest
VITE_N8N_TEMPLATE_URL=http://localhost:5678/webhook/template
VITE_N8N_BASE_URL=http://localhost:5678
VITE_N8N_API_KEY=your-n8n-api-key

# N8N Workflow Steps (configure based on your n8n setup)
N8N_WEBHOOK_STEP1=http://localhost:5678/webhook/process-step1
N8N_WEBHOOK_STEP2=http://localhost:5678/webhook/process-step2
N8N_WEBHOOK_STEP3=http://localhost:5678/webhook/process-step3
```

### 2. Deploy Individual Functions

Deploy each function separately:

```bash
# Deploy the n8n proxy function
supabase functions deploy n8n-proxy --no-verify-jwt

# Deploy the trigger function
supabase functions deploy trigger-n8n --no-verify-jwt

# Deploy other existing functions if needed
supabase functions deploy upload
supabase functions deploy chat
supabase functions deploy messages
```

### 3. Deploy All Functions at Once

Alternatively, deploy all functions:

```bash
# Deploy all functions
supabase functions deploy
```

### 4. Set Environment Variables in Supabase

Set the environment variables in your Supabase project:

```bash
# Set n8n integration variables
supabase secrets set VITE_N8N_CHAT_WEBHOOK=http://localhost:5678/webhook/hhlm-chat
supabase secrets set VITE_N8N_INGEST_URL=http://localhost:5678/webhook/ingest
supabase secrets set VITE_N8N_TEMPLATE_URL=http://localhost:5678/webhook/template
supabase secrets set VITE_N8N_BASE_URL=http://localhost:5678
supabase secrets set VITE_N8N_API_KEY=your-actual-n8n-api-key

# Set workflow step webhooks
supabase secrets set N8N_WEBHOOK_STEP1=http://localhost:5678/webhook/process-step1
supabase secrets set N8N_WEBHOOK_STEP2=http://localhost:5678/webhook/process-step2
supabase secrets set N8N_WEBHOOK_STEP3=http://localhost:5678/webhook/process-step3
```

## 📡 Function Usage

### N8N Proxy Function

**Base URL**: `/functions/v1/n8n-proxy/`

**Endpoints**:
- `POST /functions/v1/n8n-proxy/chat` - Proxy to n8n chat webhook
- `POST /functions/v1/n8n-proxy/ingest` - Proxy to n8n ingest webhook
- `POST /functions/v1/n8n-proxy/template` - Proxy to n8n template webhook
- `POST /functions/v1/n8n-proxy/test` - Test connectivity to n8n services
- `GET /functions/v1/n8n-proxy/n8n/*` - Proxy to n8n API endpoints

**Example Usage**:
```javascript
// Test n8n connectivity
const response = await fetch('/functions/v1/n8n-proxy/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    field: 'chat',
    key: 'optional-api-key'
  })
});

// Send chat message via proxy
const chatResponse = await fetch('/functions/v1/n8n-proxy/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    sessionId: 'uuid',
    message: 'Hello, world!'
  })
});
```

### Trigger N8N Function

**Base URL**: `/functions/v1/trigger-n8n`

**Purpose**: Trigger specific n8n workflow steps

**Example Usage**:
```javascript
// Trigger workflow step 1
const response = await fetch('/functions/v1/trigger-n8n', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    step: 1,
    jobId: 'job-uuid',
    bucket: 'hh_pdf_library',
    path: 'user-id/file.pdf',
    metadata: {
      filename: 'document.pdf',
      userId: 'user-uuid'
    }
  })
});
```

## 🔧 Development and Testing

### Local Development

1. **Start Supabase locally**:
   ```bash
   supabase start
   ```

2. **Deploy functions locally**:
   ```bash
   supabase functions deploy n8n-proxy --local
   supabase functions deploy trigger-n8n --local
   ```

3. **Test functions**:
   ```bash
   # Test the proxy function
   curl -X POST http://localhost:54321/functions/v1/n8n-proxy/test \
     -H "Content-Type: application/json" \
     -d '{"field": "chat"}'

   # Test the trigger function
   curl -X POST http://localhost:54321/functions/v1/trigger-n8n \
     -H "Content-Type: application/json" \
     -d '{"step": 1, "jobId": "test-job"}'
   ```

### View Function Logs

Monitor function execution:

```bash
# View all function logs
supabase functions logs

# View specific function logs
supabase functions logs n8n-proxy
supabase functions logs trigger-n8n
```

## 🛠 Configuration in Your App

Update your frontend API calls to use the new functions:

```typescript
// In your API client (src/lib/api.ts)

// Use the n8n-proxy function
export async function sendChatViaProxy(sessionId: string, message: string) {
  return fetch('/functions/v1/n8n-proxy/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`
    },
    body: JSON.stringify({ sessionId, message })
  });
}

// Use the trigger function for workflow steps
export async function triggerProcessingStep(step: number, jobId: string, filePath: string) {
  return fetch('/functions/v1/trigger-n8n', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`
    },
    body: JSON.stringify({
      step,
      jobId,
      bucket: 'hh_pdf_library',
      path: filePath
    })
  });
}
```

## 📝 Adding New npm Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "functions:deploy": "supabase functions deploy",
    "functions:deploy:n8n-proxy": "supabase functions deploy n8n-proxy --no-verify-jwt",
    "functions:deploy:trigger": "supabase functions deploy trigger-n8n --no-verify-jwt",
    "functions:logs": "supabase functions logs",
    "functions:logs:proxy": "supabase functions logs n8n-proxy",
    "functions:logs:trigger": "supabase functions logs trigger-n8n"
  }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Function not found**: Make sure you've deployed the function
2. **Environment variables not set**: Use `supabase secrets list` to verify
3. **CORS errors**: The functions include CORS headers, but verify your frontend origin
4. **N8N connection issues**: Check that n8n is running and accessible

### Debug Steps

1. **Check function deployment**:
   ```bash
   supabase functions list
   ```

2. **Verify environment variables**:
   ```bash
   supabase secrets list
   ```

3. **Test locally first**:
   ```bash
   supabase functions serve n8n-proxy --debug
   ```

4. **Check function logs**:
   ```bash
   supabase functions logs n8n-proxy --follow
   ```

## 🔄 Migration from Old Proxy

If you want to replace the existing `proxy` function:

1. **Deploy the new n8n-proxy function**
2. **Update your frontend to use the new endpoints**
3. **Test thoroughly**
4. **Remove the old proxy function**:
   ```bash
   # Delete the old proxy function
   rm -rf supabase/functions/proxy
   ```

Your edge functions are now ready to handle n8n integration and workflow triggering!