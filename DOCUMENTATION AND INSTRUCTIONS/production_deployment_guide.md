# Production Deployment & Scaling Guide

## Pre-Production Checklist

### Infrastructure Requirements

#### Supabase Production Setup
```bash
# Production project setup checklist
□ Create production Supabase project
□ Configure custom domain (optional)
□ Set up database backups (daily)
□ Configure SSL certificates
□ Set up monitoring and alerts
□ Configure row-level security policies
□ Set up API rate limiting
□ Configure CORS settings
□ Set up webhook endpoints
□ Configure storage buckets with proper policies
```

#### Server Infrastructure
```yaml
# docker-compose.prod.yml - Production setup
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_ORIGINS=*
      - OLLAMA_HOST=0.0.0.0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://your-domain.com/
      - GENERIC_TIMEZONE=UTC
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - ollama
      - n8n

volumes:
  ollama_data:
  n8n_data:
  postgres_data:
  redis_data:
```

#### Nginx Configuration
```nginx
# nginx.conf - Production load balancer
events {
    worker_connections 1024;
}

http {
    upstream ollama_backend {
        server ollama:11434;
        keepalive 32;
    }
    
    upstream n8n_backend {
        server n8n:5678;
        keepalive 32;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Ollama API proxy
        location /ollama/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://ollama_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Large request handling for embeddings
            client_max_body_size 10M;
            proxy_read_timeout 300s;
            proxy_connect_timeout 10s;
        }

        # n8n proxy
        location /n8n/ {
            limit_req zone=api burst=10 nodelay;
            
            proxy_pass http://n8n_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # File upload endpoint
        location /upload {
            limit_req zone=upload burst=5 nodelay;
            client_max_body_size 100M;
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
            
            # Forward to your application
            proxy_pass http://your-app-backend;
        }

        # Health check endpoints
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### Scaling for 20,000+ PDFs

#### Database Scaling Strategy
```sql
-- Partitioning large tables for better performance
-- partition-strategy.sql

-- Partition documents table by notebook_id for better performance
CREATE TABLE documents_partitioned (
    LIKE documents INCLUDING ALL
) PARTITION BY HASH (metadata->>'notebook_id');

-- Create partitions (adjust number based on expected load)
DO $$
BEGIN
    FOR i IN 0..15 LOOP
        EXECUTE format('CREATE TABLE documents_part_%s PARTITION OF documents_partitioned 
                       FOR VALUES WITH (modulus 16, remainder %s)', i, i);
    END LOOP;
END $$;

-- Migrate existing data
INSERT INTO documents_partitioned SELECT * FROM documents;

-- Create optimized indexes on partitions
CREATE INDEX CONCURRENTLY idx_documents_part_embedding 
    ON documents_partitioned USING hnsw (embedding vector_cosine_ops);
CREATE INDEX CONCURRENTLY idx_documents_part_metadata 
    ON documents_partitioned USING gin (metadata);

-- Partition pdf_metadata by date for time-based queries
CREATE TABLE pdf_metadata_partitioned (
    LIKE pdf_metadata INCLUDING ALL
) PARTITION BY RANGE (extracted_at);

-- Create monthly partitions
DO $$
DECLARE
    start_date date := date_trunc('month', NOW());
    end_date date;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + interval '1 month';
        EXECUTE format('CREATE TABLE pdf_metadata_%s PARTITION OF pdf_metadata_partitioned 
                       FOR VALUES FROM (%L) TO (%L)', 
                       to_char(start_date, 'YYYY_MM'), start_date, end_date);
        start_date := end_date;
    END LOOP;
END $$;
```

#### Background Job Processing
```typescript
// lib/job-queue.ts - Background processing for large-scale operations
import { createClient } from '@supabase/supabase-js';

export class JobQueue {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async addBatchProcessingJob(notebookId: string, sourceIds: string[]) {
    // Split large batches into smaller chunks
    const chunkSize = 10; // Process 10 documents at a time
    const chunks = this.chunkArray(sourceIds, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      await this.supabase.from('processing_jobs').insert({
        job_type: 'batch_pdf_processing',
        notebook_id: notebookId,
        payload: {
          source_ids: chunks[i],
          batch_index: i,
          total_batches: chunks.length
        },
        status: 'pending',
        priority: 1,
        scheduled_at: new Date(Date.now() + (i * 30000)) // Stagger by 30 seconds
      });
    }
  }

  async addReportGenerationJob(reportId: string, priority: number = 1) {
    await this.supabase.from('processing_jobs').insert({
      job_type: 'report_generation',
      payload: { report_generation_id: reportId },
      status: 'pending',
      priority,
      scheduled_at: new Date()
    });
  }

  async getNextJob(): Promise<any> {
    const { data, error } = await this.supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;

    // Mark as processing
    await this.supabase
      .from('processing_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString() 
      })
      .eq('id', data.id);

    return data;
  }

  async completeJob(jobId: string, result: any) {
    await this.supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result
      })
      .eq('id', jobId);
  }

  async failJob(jobId: string, error: string) {
    await this.supabase
      .from('processing_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error
      })
      .eq('id', jobId);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Create processing_jobs table
const processingJobsTableSQL = `
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  notebook_id UUID REFERENCES notebooks(id),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 1,
  
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  result JSONB,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_status_priority ON processing_jobs(status, priority DESC, created_at);
CREATE INDEX idx_processing_jobs_notebook_id ON processing_jobs(notebook_id);
CREATE INDEX idx_processing_jobs_scheduled_at ON processing_jobs(scheduled_at);
`;
```

#### Caching Strategy
```typescript
// lib/cache.ts - Multi-level caching for performance
export class CacheManager {
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private readonly TTL = {
    short: 5 * 60 * 1000,      // 5 minutes
    medium: 30 * 60 * 1000,    // 30 minutes
    long: 60 * 60 * 1000,      // 1 hour
    veryLong: 24 * 60 * 60 * 1000 // 24 hours
  };

  // Vector search result caching
  async getCachedVectorSearch(query: string, notebookId: string): Promise<any> {
    const cacheKey = `vector:${notebookId}:${this.hashString(query)}`;
    
    // Check memory cache first
    const cached = this.memoryCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Check Redis cache
    const redisResult = await this.getFromRedis(cacheKey);
    if (redisResult) {
      // Update memory cache
      this.memoryCache.set(cacheKey, {
        data: redisResult,
        expires: Date.now() + this.TTL.medium
      });
      return redisResult;
    }

    return null;
  }

  async cacheVectorSearch(
    query: string, 
    notebookId: string, 
    results: any
  ): Promise<void> {
    const cacheKey = `vector:${notebookId}:${this.hashString(query)}`;
    
    // Cache in memory
    this.memoryCache.set(cacheKey, {
      data: results,
      expires: Date.now() + this.TTL.medium
    });

    // Cache in Redis for longer term
    await this.setInRedis(cacheKey, results, this.TTL.long);
  }

  // Report template caching
  async getCachedReportTemplates(): Promise<any> {
    const cacheKey = 'report_templates:all';
    
    const cached = this.memoryCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    return await this.getFromRedis(cacheKey);
  }

  async cacheReportTemplates(templates: any): Promise<void> {
    const cacheKey = 'report_templates:all';
    
    this.memoryCache.set(cacheKey, {
      data: templates,
      expires: Date.now() + this.TTL.veryLong
    });

    await this.setInRedis(cacheKey, templates, this.TTL.veryLong);
  }

  // Document metadata caching
  async getCachedDocumentMetadata(sourceId: string): Promise<any> {
    const cacheKey = `metadata:${sourceId}`;
    return this.getFromCache(cacheKey);
  }

  async cacheDocumentMetadata(sourceId: string, metadata: any): Promise<void> {
    const cacheKey = `metadata:${sourceId}`;
    await this.setInCache(cacheKey, metadata, this.TTL.long);
  }

  // Cache invalidation
  async invalidateNotebookCache(notebookId: string): Promise<void> {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(notebookId)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache
    await this.deleteFromRedis(`*${notebookId}*`);
  }

  // Utility methods
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async getFromCache(key: string): Promise<any> {
    // Check memory first
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Check Redis
    return await this.getFromRedis(key);
  }

  private async setInCache(key: string, data: any, ttl: number): Promise<void> {
    // Set in memory
    this.memoryCache.set(key, {
      data,
      expires: Date.now() + ttl
    });

    // Set in Redis
    await this.setInRedis(key, data, ttl);
  }

  private async getFromRedis(key: string): Promise<any> {
    // Implementation would depend on your Redis client
    // This is a placeholder for Redis operations
    return null;
  }

  private async setInRedis(key: string, data: any, ttl: number): Promise<void> {
    // Implementation would depend on your Redis client
    // This is a placeholder for Redis operations
  }

  private async deleteFromRedis(pattern: string): Promise<void> {
    // Implementation would depend on your Redis client
    // This is a placeholder for Redis operations
  }
}
```

### Cost Optimization Strategies

#### Supabase Cost Management
```typescript
// lib/cost-optimization.ts
export class CostOptimizer {
  
  // Implement tiered storage for old documents
  async archiveOldDocuments(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6); // Archive after 6 months

    // Move old documents to cold storage
    const { data: oldSources } = await supabase
      .from('sources')
      .select('*')
      .lt('created_at', cutoffDate.toISOString())
      .eq('processing_status', 'completed');

    for (const source of oldSources || []) {
      // Move file to archive storage bucket
      await this.moveToArchiveStorage(source.file_path);
      
      // Update database record
      await supabase
        .from('sources')
        .update({ 
          archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('id', source.id);
    }
  }

  // Optimize vector embeddings storage
  async optimizeEmbeddings(): Promise<void> {
    // Remove duplicate embeddings
    await supabase.rpc('remove_duplicate_embeddings');
    
    // Compress old embeddings
    await supabase.rpc('compress_old_embeddings');
  }

  // Clean up failed processing records
  async cleanupFailedRecords(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Clean up after 30 days

    // Remove failed processing jobs
    await supabase
      .from('processing_jobs')
      .delete()
      .eq('status', 'failed')
      .lt('created_at', cutoffDate.toISOString());

    // Clean up orphaned chunk metadata
    await supabase.rpc('cleanup_orphaned_chunks');
  }

  private async moveToArchiveStorage(filePath: string): Promise<void> {
    // Implementation for moving files to cheaper storage tier
    // This would involve copying to archive bucket and deleting from main bucket
  }
}

-- SQL functions for cost optimization
CREATE OR REPLACE FUNCTION remove_duplicate_embeddings()
RETURNS void AS $$
BEGIN
  DELETE FROM documents d1
  USING documents d2
  WHERE d1.id > d2.id 
    AND d1.content = d2.content
    AND d1.metadata->>'source_id' = d2.metadata->>'source_id';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_orphaned_chunks()
RETURNS void AS $$
BEGIN
  DELETE FROM chunks_metadata cm
  WHERE NOT EXISTS (
    SELECT 1 FROM sources s 
    WHERE s.id = cm.source_id
  );
END;
$$ LANGUAGE plpgsql;
```

### High Availability Setup

#### Database Replication
```sql
-- Read replica configuration for high availability
-- This would be configured through Supabase dashboard

-- Create read-only functions for reporting
CREATE OR REPLACE FUNCTION get_system_stats_readonly()
RETURNS TABLE (
  total_documents bigint,
  total_reports bigint,
  avg_processing_time numeric,
  success_rate numeric
) AS $$
BEGIN
  -- This function can run on read replicas
  RETURN QUERY
  SELECT 
    COUNT(*) as total_documents,
    (SELECT COUNT(*) FROM report_generations) as total_reports,
    AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time,
    (COUNT(*) FILTER (WHERE processing_status = 'completed') * 100.0 / COUNT(*)) as success_rate
  FROM sources
  WHERE created_at > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

#### Load Balancing Configuration
```yaml
# kubernetes/deployment.yaml - Kubernetes deployment for high availability
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          requests:
            memory: "4Gi"
            cpu: "2000m"
          limits:
            memory: "8Gi"
            cpu: "4000m"
        livenessProbe:
          httpGet:
            path: /api/tags
            port: 11434
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/tags
            port: 11434
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: ollama-service
spec:
  selector:
    app: ollama
  ports:
  - protocol: TCP
    port: 11434
    targetPort: 11434
  type: LoadBalancer
```

### Monitoring and Alerting in Production

#### Production Monitoring Setup
```typescript
// lib/production-monitoring.ts
export class ProductionMonitor {
  private alertThresholds = {
    maxProcessingTime: 300, // 5 minutes
    maxFailureRate: 10,     // 10%
    maxQueueSize: 100,      // 100 jobs
    maxResponseTime: 5000,  // 5 seconds
    minAvailability: 99.0   // 99%
  };

  async checkSystemHealth(): Promise<{ status: string; alerts: any[] }> {
    const checks = await Promise.allSettled([
      this.checkProcessingQueue(),
      this.checkFailureRates(),
      this.checkResponseTimes(),
      this.checkDiskSpace(),
      this.checkDatabaseConnections(),
      this.checkExternalServices()
    ]);

    const alerts: any[] = [];
    let overallStatus = 'healthy';

    checks.forEach((check, index) => {
      if (check.status === 'rejected') {
        alerts.push({
          type: 'system_check_failed',
          message: `Health check ${index} failed: ${check.reason}`,
          severity: 'critical'
        });
        overallStatus = 'unhealthy';
      } else if (check.value?.alert) {
        alerts.push(check.value.alert);
        if (check.value.alert.severity === 'critical') {
          overallStatus = 'degraded';
        }
      }
    });

    // Send alerts if critical issues found
    if (alerts.some(a => a.severity === 'critical')) {
      await this.sendCriticalAlert(alerts);
    }

    return { status: overallStatus, alerts };
  }

  private async checkProcessingQueue(): Promise<{ alert?: any }> {
    const { data } = await supabase
      .from('processing_jobs')
      .select('count')
      .eq('status', 'pending');

    const queueSize = data?.[0]?.count || 0;
    
    if (queueSize > this.alertThresholds.maxQueueSize) {
      return {
        alert: {
          type: 'queue_overload',
          message: `Processing queue has ${queueSize} pending jobs`,
          severity: 'warning'
        }
      };
    }

    return {};
  }

  private async checkFailureRates(): Promise<{ alert?: any }> {
    const { data } = await supabase.rpc('get_failure_rate_last_hour');
    
    const failureRate = data?.[0]?.failure_rate || 0;
    
    if (failureRate > this.alertThresholds.maxFailureRate) {
      return {
        alert: {
          type: 'high_failure_rate',
          message: `Failure rate is ${failureRate}%`,
          severity: 'critical'
        }
      };
    }

    return {};
  }

  private async sendCriticalAlert(alerts: any[]): Promise<void> {
    // Implementation for sending alerts via email, Slack, PagerDuty, etc.
    const alertMessage = {
      title: 'Town Planning System Critical Alert',
      message: `${alerts.length} critical issues detected`,
      details: alerts,
      timestamp: new Date().toISOString()
    };

    // Send to monitoring service
    await this.sendToMonitoringService(alertMessage);
    
    // Log to database
    await supabase.from('system_alerts').insert(alertMessage);
  }

  private async sendToMonitoringService(alert: any): Promise<void> {
    // Integration with monitoring services like DataDog, New Relic, etc.
    // This would be customized based on your monitoring stack
  }
}
```

### Security Hardening

#### Production Security Configuration
```sql
-- security-hardening.sql
-- Additional security measures for production

-- Create audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_sources_trigger
  AFTER INSERT OR UPDATE OR DELETE ON sources
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_pdf_metadata_trigger
  AFTER INSERT OR UPDATE OR DELETE ON pdf_metadata
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Enhanced RLS policies with IP restrictions
CREATE POLICY "IP restricted access" ON sources
  FOR ALL USING (
    inet_client_addr() << '10.0.0.0/8'::inet OR
    inet_client_addr() << '172.16.0.0/12'::inet OR
    inet_client_addr() << '192.168.0.0/16'::inet
  );

-- Rate limiting function
CREATE OR REPLACE FUNCTION check_rate_limit(user_identifier text, action_type text, limit_per_hour integer)
RETURNS boolean AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM audit_logs
  WHERE user_id = user_identifier
    AND action = action_type
    AND created_at > NOW() - INTERVAL '1 hour';
  
  RETURN current_count < limit_per_hour;
END;
$$ LANGUAGE plpgsql;
```

This production deployment guide covers:

1. **Infrastructure Setup** - Docker, Kubernetes, and load balancing
2. **Database Scaling** - Partitioning and optimization for large datasets
3. **Background Processing** - Job queues for handling large-scale operations
4. **Caching Strategies** - Multi-level caching for performance
5. **Cost Optimization** - Strategies to manage costs at scale
6. **High Availability** - Redundancy and failover mechanisms
7. **Production Monitoring** - Comprehensive health checks and alerting
8. **Security Hardening** - Audit logging and access controls

The system is designed to handle the 20,000+ PDF requirement with proper scaling, monitoring, and cost management strategies.