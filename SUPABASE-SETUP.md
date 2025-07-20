# Supabase Setup Guide for Town Planner

This guide will help you set up Supabase for the town-planner project.

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Docker installed and running
- Node.js 18+ installed

## Quick Setup

### 1. Initialize Supabase Project

If you haven't already, link to your Supabase project:

```bash
# Login to Supabase
supabase login

# Link to existing project (use project ID from supabase/config.toml)
supabase link --project-ref ttbcziwdfkorkopgouar

# OR create a new project
supabase projects create town-planner
```

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Supabase credentials:
   ```bash
   # Get these from your Supabase dashboard
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 3. Database Setup

Run the migrations to set up your database:

```bash
# Apply all migrations
npm run supabase:migrate

# OR reset and apply all migrations
npm run supabase:reset
```

### 4. Generate TypeScript Types

Update the TypeScript types from your database schema:

```bash
npm run supabase:types
```

### 5. Deploy Edge Functions

Deploy the edge functions to Supabase:

```bash
supabase functions deploy --no-verify-jwt proxy
supabase functions deploy upload
supabase functions deploy chat
supabase functions deploy messages
```

### 6. Test the Setup

Run the comprehensive test suite:

```bash
npm run test:supabase
```

## Database Schema Overview

### Core Tables

1. **hh_chat_sessions** - Chat session management
2. **hh_chat_messages** - Chat message history  
3. **hh_uploads** - File upload tracking
4. **hh_templates** - Generated permit templates
5. **hh_pdf_vectors** - Document embeddings for RAG
6. **user_profiles** - Extended user profile data

### Storage Buckets

1. **hh_pdf_library** - PDF document storage
2. **hh_templates** - Generated template file storage

### Security Features

- **Row Level Security (RLS)** enabled on all tables
- User-specific access policies
- Admin role support for system management
- Private storage buckets with signed URLs

## Edge Functions

### 1. Proxy Function (`/functions/v1/proxy/*`)
- Routes requests to n8n workflows
- Handles API key authentication
- Provides CORS support

### 2. Upload Function (`/functions/v1/upload`)
- Handles PDF file uploads
- Creates database records
- Generates signed URLs

### 3. Chat Function (`/functions/v1/chat`)
- Manages chat sessions
- Stores messages
- Integrates with n8n workflows

### 4. Messages Function (`/functions/v1/messages`)
- Retrieves chat history
- Session management
- Message deletion

## Development Workflow

### Local Development

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. View Supabase dashboard:
   ```bash
   supabase dashboard
   ```

### Making Schema Changes

1. Create a new migration:
   ```bash
   supabase migration new your-migration-name
   ```

2. Edit the migration file in `supabase/migrations/`

3. Apply the migration:
   ```bash
   npm run supabase:migrate
   ```

4. Update TypeScript types:
   ```bash
   npm run supabase:types
   ```

### Deploying Changes

1. Push database changes:
   ```bash
   supabase db push
   ```

2. Deploy edge functions:
   ```bash
   supabase functions deploy
   ```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Found**
   - Verify `.env` file exists and has correct values
   - Check variable names match exactly

2. **Database Connection Errors**
   - Ensure Supabase project is active
   - Verify network connectivity
   - Check API keys are valid

3. **RLS Policy Issues**
   - Verify user authentication
   - Check policy definitions in migrations
   - Use service role key for admin operations

4. **Storage Upload Failures**
   - Check bucket permissions
   - Verify file size limits
   - Ensure proper authentication

### Getting Help

1. **Check Test Results**
   ```bash
   npm run test:supabase
   ```

2. **View Logs**
   ```bash
   npm run logs:supabase
   ```

3. **Supabase Dashboard**
   - Check logs in the dashboard
   - Verify table structures
   - Test SQL queries

### Reset Everything

If you need to start fresh:

```bash
# Reset local database
npm run supabase:reset

# OR reset remote database (DESTRUCTIVE!)
supabase db reset --linked
```

## Production Deployment

### Environment Variables

Ensure these are set in your production environment:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Security Checklist

- [ ] RLS policies are properly configured
- [ ] Service role key is kept secure
- [ ] Storage buckets are private
- [ ] Auth settings are configured
- [ ] Email templates are customized
- [ ] Rate limiting is enabled

### Monitoring

- Set up Supabase alerts
- Monitor database performance
- Track storage usage
- Review edge function logs

## API Reference

### Edge Function Endpoints

```bash
# Upload file
POST /functions/v1/upload
Authorization: Bearer <user-token>
Content-Type: multipart/form-data

# Send chat message
POST /functions/v1/chat
Authorization: Bearer <user-token>
Content-Type: application/json
{
  "sessionId": "optional-uuid",
  "message": "Your question here",
  "sources": ["upload-id-1", "upload-id-2"]
}

# Get chat sessions
GET /functions/v1/chat
Authorization: Bearer <user-token>

# Get session messages
GET /functions/v1/messages?sessionId=<uuid>
Authorization: Bearer <user-token>

# Delete session
DELETE /functions/v1/messages?sessionId=<uuid>
Authorization: Bearer <user-token>
```

For more details, see the individual function files in `supabase/functions/`.