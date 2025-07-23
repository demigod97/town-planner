# Town Planning RAG System - Troubleshooting Guide

## Common Issues and Solutions

### 1. PDF Processing Issues

#### Issue: PDF Processing Stuck in "Processing" Status
**Symptoms:**
- Source status remains "processing" for extended periods
- No metadata extracted after 10+ minutes
- No error messages in logs

**Root Causes:**
- LlamaCloud API timeout or failure
- Network connectivity issues
- Large PDF files exceeding processing limits
- Invalid PDF format or corrupted files

**Diagnosis:**
```sql
-- Check stuck processing jobs
SELECT s.id, s.display_name, s.created_at, s.processing_status, s.error_message
FROM sources s
WHERE s.processing_status = 'processing'
  AND s.created_at < NOW() - INTERVAL '10 minutes'
ORDER BY s.created_at DESC;

-- Check error logs
SELECT * FROM error_logs
WHERE component = 'pdf_processing'
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

**Solutions:**
1. **Check LlamaCloud API Status:**
   ```bash
   curl -X GET "https://api.llamaindex.ai/api/health" \
     -H "Authorization: Bearer $LLAMACLOUD_API_KEY"
   ```

2. **Restart Processing:**
   ```sql
   UPDATE sources 
   SET processing_status = 'pending', 
       error_message = NULL
   WHERE id = 'stuck-source-id';
   ```

3. **Manual Processing with Smaller Chunks:**
   ```typescript
   // Break large PDFs into smaller sections
   const chunks = await splitPDFIntoChunks(pdfFile, 10); // 10 page chunks
   for (const chunk of chunks) {
     await processChunk(chunk);
   }
   ```

#### Issue: Metadata Extraction Returns Empty Results
**Symptoms:**
- PDF processes successfully but no metadata extracted
- `pdf_metadata` table has null values for key fields
- Low confidence scores

**Diagnosis:**
```sql
-- Check metadata extraction quality
SELECT pm.*, s.display_name
FROM pdf_metadata pm
JOIN sources s ON pm.source_id = s.id
WHERE pm.confidence_score < 0.5 
   OR pm.prepared_for IS NULL
ORDER BY pm.extracted_at DESC;
```

**Solutions:**
1. **Improve Extraction Patterns:**
   ```typescript
   // Enhanced regex patterns for metadata extraction
   const enhancedPatterns = {
     prepared_for: [
       /(?:prepared for|client|for):?\s*([^\n]+)/i,
       /client\s*name:?\s*([^\n]+)/i,
       /commissioned\s*by:?\s*([^\n]+)/i
     ],
     address: [
       /(?:address|property|site|location):?\s*([^\n]+)/i,
       /subject\s*(?:property|site):?\s*([^\n]+)/i,
       /\d+\s+[^,\n]+(?:street|road|avenue|drive|lane)[^,\n]*,\s*[^,\n]+/i
     ]
   };
   ```

2. **Fallback to OCR Processing:**
   ```typescript
   if (metadata.confidence_score < 0.5) {
     const ocrResult = await processWithOCR(pdfFile);
     metadata = extractFromOCR(ocrResult);
   }
   ```

#### Issue: PDF Upload Fails
**Symptoms:**
- File upload returns error 413 (Entity Too Large)
- Upload timeout errors
- "Failed to upload to Supabase storage" error

**Solutions:**
1. **Check File Size Limits:**
   ```typescript
   const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
   if (file.size > MAX_FILE_SIZE) {
     throw new Error(`File size ${file.size} exceeds limit ${MAX_FILE_SIZE}`);
   }
   ```

2. **Implement Chunked Upload:**
   ```typescript
   async function uploadLargeFile(file: File, path: string) {
     const chunkSize = 5 * 1024 * 1024; // 5MB chunks
     const chunks = Math.ceil(file.size / chunkSize);
     
     for (let i = 0; i < chunks; i++) {
       const start = i * chunkSize;
       const end = Math.min(start + chunkSize, file.size);
       const chunk = file.slice(start, end);
       
       await uploadChunk(chunk, path, i, chunks);
     }
   }
   ```

3. **Configure Nginx/Proxy Settings:**
   ```nginx
   location /upload {
     client_max_body_size 100M;
     proxy_read_timeout 600s;
     proxy_send_timeout 600s;
   }
   ```

### 2. Vector Search Issues

#### Issue: Poor Search Relevance
**Symptoms:**
- Search results don't match query intent
- Low similarity scores across all results
- Missing expected documents in results

**Diagnosis:**
```sql
-- Check embedding quality
SELECT 
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as docs_with_embeddings,
  AVG(array_length(embedding::float[], 1)) as avg_embedding_dimension
FROM documents;

-- Test similarity search
SELECT content, metadata, 
       1 - (embedding <=> '[your_test_embedding]'::vector) as similarity
FROM documents
WHERE metadata->>'notebook_id' = 'test-notebook'
ORDER BY similarity DESC
LIMIT 5;
```

**Solutions:**
1. **Verify Embedding Model:**
   ```bash
   # Check Ollama models
   curl http://localhost:11434/api/tags
   
   # Verify embedding dimensions match
   curl -X POST http://localhost:11434/api/embeddings \
     -H "Content-Type: application/json" \
     -d '{"model":"nomic-embed-text:latest","prompt":"test query"}'
   ```

2. **Re-generate Embeddings:**
   ```sql
   -- Mark documents for re-embedding
   UPDATE documents 
   SET embedding = NULL 
   WHERE metadata->>'notebook_id' = 'problem-notebook';
   ```

3. **Optimize Search Parameters:**
   ```typescript
   // Adjust similarity threshold and result count
   const searchResults = await supabase.rpc('match_documents', {
     query_embedding: embedding,
     match_threshold: 0.3, // Lower threshold for broader matches
     match_count: 10,      // More results for better coverage
     filter_notebook_id: notebookId
   });
   ```

#### Issue: Vector Search Timeout
**Symptoms:**
- Search requests timeout after 30+ seconds
- Database connection errors during search
- High CPU usage on database server

**Diagnosis:**
```sql
-- Check index usage
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, content, metadata, 1 - (embedding <=> '[test_vector]') as similarity
FROM documents
WHERE 1 - (embedding <=> '[test_vector]') > 0.5
ORDER BY embedding <=> '[test_vector]'
LIMIT 10;

-- Check database stats
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables 
WHERE tablename = 'documents';
```

**Solutions:**
1. **Optimize Vector Index:**
   ```sql
   -- Create or rebuild vector index
   DROP INDEX IF EXISTS idx_documents_embedding;
   CREATE INDEX CONCURRENTLY idx_documents_embedding 
   ON documents USING hnsw (embedding vector_cosine_ops)
   WITH (m = 16, ef_construction = 64);
   
   -- Analyze table statistics
   ANALYZE documents;
   ```

2. **Implement Search Caching:**
   ```typescript
   const cacheKey = `vector_search:${hashQuery(query)}:${notebookId}`;
   let results = await getFromCache(cacheKey);
   
   if (!results) {
     results = await performVectorSearch(query, notebookId);
     await setInCache(cacheKey, results, 300); // 5 minutes
   }
   ```

3. **Database Connection Pooling:**
   ```typescript
   // Configure connection pooling
   const supabase = createClient(url, key, {
     db: {
       schema: 'public',
     },
     global: {
       headers: { 'x-my-custom-header': 'my-app-name' },
     },
     realtime: {
       params: {
         eventsPerSecond: 10
       }
     }
   });
   ```

### 3. Report Generation Issues

#### Issue: Report Generation Fails
**Symptoms:**
- Report status stuck in "processing"
- Some sections completed but others failed
- "Generate Report" button doesn't respond

**Diagnosis:**
```sql
-- Check failed report sections
SELECT rg.topic, rs.section_name, rs.status, rs.query_used, rs.completed_at
FROM report_generations rg
JOIN report_sections rs ON rg.id = rs.report_generation_id
WHERE rg.status IN ('processing', 'failed')
ORDER BY rg.created_at DESC, rs.section_order;

-- Check Ollama connectivity
SELECT * FROM system_events 
WHERE event_type = 'ollama_error' 
  AND created_at > NOW() - INTERVAL '1 hour';
```

**Solutions:**
1. **Check Ollama Service:**
   ```bash
   # Verify Ollama is running
   curl http://localhost:11434/api/tags
   
   # Test text generation
   curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{"model":"qwen3:8b-q4_K_M","prompt":"Test prompt","stream":false}'
   ```

2. **Restart Failed Sections:**
   ```sql
   UPDATE report_sections 
   SET status = 'pending', 
       started_at = NULL,
       error_message = NULL
   WHERE report_generation_id = 'failed-report-id'
     AND status = 'failed';
   ```

3. **Increase Timeout Values:**
   ```typescript
   // Increase timeout for large reports
   const ollamaResponse = await fetch(ollamaUrl, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       model: 'qwen3:8b-q4_K_M',
       prompt: prompt,
       stream: false,
       options: { 
         timeout: 300000 // 5 minutes
       }
     }),
     signal: AbortSignal.timeout(600000) // 10 minutes
   });
   ```

#### Issue: Generated Reports Have Poor Quality
**Symptoms:**
- Generic or irrelevant content
- Missing specific details from source documents
- Inconsistent formatting or structure

**Solutions:**
1. **Improve Query Generation:**
   ```typescript
   // More specific queries for better context
   const generateSectionQuery = (section: string, topic: string, address?: string) => {
     return `Find detailed information about "${section}" specifically for ${topic}` +
            `${address ? ` at ${address}` : ''}. Include relevant regulations, ` +
            `requirements, standards, and any specific compliance measures.`;
   };
   ```

2. **Enhanced Prompt Engineering:**
   ```typescript
   const prompt = `
   You are a professional town planning consultant with 20+ years of experience.
   
   Write a detailed section for a planning report about "${sectionTitle}".
   
   Context from source documents:
   ${context}
   
   Requirements:
   - Be specific and technical
   - Reference relevant planning controls and regulations
   - Include quantitative details where available
   - Use professional language appropriate for statutory submissions
   - Cite specific document sources where information is drawn from
   
   Section content:
   `;
   ```

3. **Quality Control Checks:**
   ```typescript
   function validateReportSection(content: string): boolean {
     return content.length > 200 &&                    // Minimum length
            !content.includes('I don\'t have enough') && // No generic responses
            /\d+/.test(content) &&                       // Contains numbers/specifics
            content.split('\n').length > 3;             // Multiple paragraphs
   }
   ```

### 4. Authentication and Authorization Issues

#### Issue: JWT Token Expired
**Symptoms:**
- 401 Unauthorized errors
- "JWT expired" error messages
- Users logged out unexpectedly

**Solutions:**
1. **Implement Token Refresh:**
   ```typescript
   async function refreshToken() {
     const { data, error } = await supabase.auth.refreshSession();
     if (error) {
       // Redirect to login
       window.location.href = '/login';
     }
     return data;
   }
   
   // Set up automatic refresh
   setInterval(refreshToken, 50 * 60 * 1000); // Refresh every 50 minutes
   ```

2. **Handle Token Expiry in API Calls:**
   ```typescript
   async function apiCallWithRetry(apiCall: () => Promise<any>) {
     try {
       return await apiCall();
     } catch (error) {
       if (error.message.includes('JWT expired')) {
         await refreshToken();
         return await apiCall(); // Retry with new token
       }
       throw error;
     }
   }
   ```

#### Issue: Row Level Security Blocking Access
**Symptoms:**
- Empty results from API calls
- Users can't see their own data
- "Permission denied" errors

**Diagnosis:**
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('sources', 'pdf_metadata', 'report_generations');

-- Test policy conditions
SELECT current_user, auth.uid();
```

**Solutions:**
1. **Verify User Context:**
   ```sql
   -- Temporarily disable RLS for testing
   ALTER TABLE sources DISABLE ROW LEVEL SECURITY;
   -- Re-enable after testing
   ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
   ```

2. **Fix Policy Conditions:**
   ```sql
   -- Update RLS policy to handle missing user_id
   CREATE POLICY "Users can access their notebooks" ON sources
     FOR ALL USING (
       notebook_id IN (
         SELECT id FROM notebooks 
         WHERE user_id = auth.uid() OR user_id IS NULL
       )
     );
   ```

### 5. Performance Issues

#### Issue: Slow Database Queries
**Symptoms:**
- API responses taking 10+ seconds
- Dashboard loading slowly
- Database CPU at 100%

**Diagnosis:**
```sql
-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
WHERE mean_time > 1000 -- Queries taking more than 1 second
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;
```

**Solutions:**
1. **Add Missing Indexes:**
   ```sql
   -- Common indexes for performance
   CREATE INDEX CONCURRENTLY idx_sources_notebook_processing 
   ON sources(notebook_id, processing_status);
   
   CREATE INDEX CONCURRENTLY idx_pdf_metadata_address 
   ON pdf_metadata USING gin (to_tsvector('english', address));
   
   CREATE INDEX CONCURRENTLY idx_report_generations_status_created 
   ON report_generations(status, created_at DESC);
   ```

2. **Optimize Large Queries:**
   ```sql
   -- Use pagination for large result sets
   SELECT * FROM sources 
   WHERE notebook_id = $1
   ORDER BY created_at DESC
   LIMIT 25 OFFSET $2;
   
   -- Use targeted queries instead of SELECT *
   SELECT id, display_name, processing_status, created_at
   FROM sources 
   WHERE notebook_id = $1;
   ```

3. **Implement Query Caching:**
   ```typescript
   // Cache expensive aggregation queries
   const cacheKey = `stats:notebook:${notebookId}`;
   let stats = await getFromCache(cacheKey);
   
   if (!stats) {
     stats = await supabase.rpc('get_notebook_stats', {
       notebook_id: notebookId
     });
     await setInCache(cacheKey, stats, 300); // 5 minutes
   }
   ```

### 6. External Service Issues

#### Issue: Ollama Model Not Responding
**Symptoms:**
- Embedding requests timeout
- Text generation fails
- "Connection refused" errors

**Diagnosis:**
```bash
# Check if Ollama is running
ps aux | grep ollama

# Check Ollama logs
docker logs ollama-container

# Test API directly
curl -v http://localhost:11434/api/version
```

**Solutions:**
1. **Restart Ollama Service:**
   ```bash
   # Docker restart
   docker restart ollama-container
   
   # System service restart
   sudo systemctl restart ollama
   ```

2. **Check Model Availability:**
   ```bash
   # List installed models
   curl http://localhost:11434/api/tags
   
   # Pull missing models
   ollama pull qwen3:8b-q4_K_M
   ollama pull nomic-embed-text:latest
   ```

3. **Configure Resource Limits:**
   ```yaml
   # docker-compose.yml
   services:
     ollama:
       deploy:
         resources:
           limits:
             memory: 8G
           reservations:
             memory: 4G
   ```

#### Issue: LlamaCloud API Errors
**Symptoms:**
- PDF parsing fails consistently
- "API key invalid" errors
- Rate limit exceeded messages

**Solutions:**
1. **Verify API Key:**
   ```bash
   curl -X GET "https://api.llamaindex.ai/api/parsing/jobs" \
     -H "Authorization: Bearer $LLAMACLOUD_API_KEY"
   ```

2. **Implement Rate Limiting:**
   ```typescript
   class RateLimiter {
     private queue: Array<() => Promise<any>> = [];
     private processing = false;
     
     async add<T>(fn: () => Promise<T>): Promise<T> {
       return new Promise((resolve, reject) => {
         this.queue.push(async () => {
           try {
             const result = await fn();
             resolve(result);
           } catch (error) {
             reject(error);
           }
         });
         
         if (!this.processing) {
           this.processQueue();
         }
       });
     }
     
     private async processQueue() {
       this.processing = true;
       
       while (this.queue.length > 0) {
         const fn = this.queue.shift()!;
         await fn();
         await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
       }
       
       this.processing = false;
     }
   }
   ```

### 7. Frontend Issues

#### Issue: File Upload Not Working
**Symptoms:**
- Drag and drop doesn't respond
- Upload progress bar stuck at 0%
- "Network error" messages

**Solutions:**
1. **Check CORS Configuration:**
   ```typescript
   // Verify Supabase CORS settings
   const supabase = createClient(url, key, {
     global: {
       headers: {
         'Access-Control-Allow-Origin': '*',
       }
     }
   });
   ```

2. **Handle Upload Errors:**
   ```typescript
   const uploadFile = async (file: File) => {
     try {
       const { data, error } = await supabase.storage
         .from('sources')
         .upload(filePath, file, {
           onUploadProgress: (progress) => {
             setUploadProgress((progress.loaded / progress.total) * 100);
           }
         });
         
       if (error) throw error;
       
     } catch (error) {
       console.error('Upload failed:', error);
       setError(`Upload failed: ${error.message}`);
     }
   };
   ```

#### Issue: Real-time Updates Not Working
**Symptoms:**
- Processing status doesn't update in UI
- Chat messages don't appear immediately
- Report progress not updating

**Solutions:**
1. **Check Realtime Connection:**
   ```typescript
   const channel = supabase.channel('processing_updates');
   
   channel.on('postgres_changes', {
     event: 'UPDATE',
     schema: 'public',
     table: 'sources'
   }, (payload) => {
     console.log('Received update:', payload);
     updateUI(payload);
   });
   
   channel.subscribe((status) => {
     console.log('Subscription status:', status);
   });
   ```

2. **Implement Fallback Polling:**
   ```typescript
   useEffect(() => {
     const pollForUpdates = async () => {
       const { data } = await supabase
         .from('sources')
         .select('id, processing_status')
         .in('id', processingSourceIds);
       
       updateProcessingStatus(data);
     };
     
     const interval = setInterval(pollForUpdates, 5000);
     return () => clearInterval(interval);
   }, [processingSourceIds]);
   ```

## Debugging Procedures

### 1. Enable Debug Logging
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Log slow queries
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
SELECT pg_reload_conf();
```

### 2. Check System Resources
```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top -p $(pgrep -d',' ollama)

# Check database connections
SELECT count(*) FROM pg_stat_activity;
```

### 3. Monitor Edge Function Logs
```bash
# Check Supabase edge function logs
supabase functions logs --project-ref YOUR_PROJECT_REF

# Check specific function logs
supabase functions logs process-pdf-with-metadata --project-ref YOUR_PROJECT_REF
```

### 4. Database Health Check
```sql
-- Check for locks
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Check table bloat
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
       n_dead_tup, n_live_tup,
       ROUND(n_dead_tup * 100.0 / (n_live_tup + n_dead_tup), 2) as dead_percentage
FROM pg_stat_user_tables 
WHERE n_dead_tup > 1000
ORDER BY dead_percentage DESC;
```

## Emergency Recovery Procedures

### 1. Service Recovery
```bash
#!/bin/bash
# emergency-recovery.sh

# Stop all services
docker-compose down

# Check disk space
if [ $(df / | tail -1 | awk '{print $5}' | sed 's/%//g') -gt 90 ]; then
    echo "WARNING: Disk space critical"
    # Clean up old logs
    find /var/log -name "*.log" -mtime +7 -delete
fi

# Start services with health checks
docker-compose up -d

# Wait for services to be ready
sleep 30

# Verify services
curl -f http://localhost:11434/api/tags || echo "Ollama not ready"
curl -f http://localhost:5678/healthz || echo "n8n not ready"
```

### 2. Database Recovery
```sql
-- Emergency database cleanup
BEGIN;

-- Clean up stuck processing jobs
UPDATE sources 
SET processing_status = 'failed',
    error_message = 'Emergency recovery - processing stuck'
WHERE processing_status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';

-- Clean up old failed jobs
DELETE FROM processing_jobs 
WHERE status = 'failed' 
  AND created_at < NOW() - INTERVAL '7 days';

-- Vacuum and analyze
VACUUM ANALYZE;

COMMIT;
```

### 3. Data Backup and Restore
```bash
# Backup critical data
pg_dump -h localhost -U postgres -d your_db \
  --table=sources --table=pdf_metadata --table=notebooks \
  --table=report_templates --table=report_generations \
  > critical_data_backup.sql

# Restore from backup
psql -h localhost -U postgres -d your_db < critical_data_backup.sql
```

This troubleshooting guide provides comprehensive coverage of common issues, diagnostic procedures, and recovery steps for the Town Planning RAG system. Keep this guide handy for production support and system maintenance.