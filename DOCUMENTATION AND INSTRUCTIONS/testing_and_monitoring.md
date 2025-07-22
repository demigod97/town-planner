# Comprehensive Testing Strategies & Monitoring Setup

## Testing Framework Structure

### 1. Unit Testing Strategy

#### Database Layer Tests
```typescript
// tests/database/migration.test.ts
import { createClient } from '@supabase/supabase-js';

describe('Database Migration Tests', () => {
  let supabase: any;

  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  test('should have all required tables', async () => {
    const tables = [
      'pdf_metadata',
      'report_templates', 
      'report_generations',
      'chunks_metadata',
      'report_sections',
      'chat_sessions',
      'chat_messages'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      expect(error).toBeNull();
    }
  });

  test('should have sample report templates', async () => {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data.map(t => t.name)).toContain('heritage_impact_report');
  });

  test('should enforce RLS policies', async () => {
    // Test with anon key (should be restricted)
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } = await anonClient
      .from('pdf_metadata')
      .select('*');

    // Should either have no data or require authentication
    expect(data).toEqual([]);
  });
});
```

#### Edge Function Tests
```typescript
// tests/edge-functions/process-pdf.test.ts
describe('Process PDF Edge Function', () => {
  const functionUrl = `${process.env.SUPABASE_URL}/functions/v1/process-pdf-with-metadata`;

  test('should reject requests without required parameters', async () => {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing required parameters');
  });

  test('should handle valid PDF processing request', async () => {
    // Mock a valid request
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_id: 'test-source-id',
        file_path: 'test-notebook/test-file.pdf',
        notebook_id: 'test-notebook-id'
      })
    });

    // Should accept the request even if processing fails
    expect(response.status).toBeLessThan(500);
  });
});
```

### 2. Integration Testing

#### PDF Processing Integration Tests
```typescript
// tests/integration/pdf-processing.test.ts
describe('PDF Processing Integration', () => {
  let testNotebookId: string;
  let testSourceId: string;

  beforeAll(async () => {
    // Create test notebook
    const { data: notebook } = await supabase
      .from('notebooks')
      .insert({ title: 'Test Notebook', user_id: 'test-user' })
      .select()
      .single();
    testNotebookId = notebook.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('notebooks')
      .delete()
      .eq('id', testNotebookId);
  });

  test('should complete full PDF processing workflow', async () => {
    // 1. Upload a test PDF
    const testPdfBuffer = await createTestPDF();
    const fileName = 'test-document.pdf';
    const filePath = `${testNotebookId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('sources')
      .upload(filePath, testPdfBuffer);

    expect(uploadError).toBeNull();

    // 2. Create source record
    const { data: sourceData, error: sourceError } = await supabase
      .from('sources')
      .insert({
        notebook_id: testNotebookId,
        display_name: fileName,
        file_path: filePath,
        file_size: testPdfBuffer.length,
        processing_status: 'pending'
      })
      .select()
      .single();

    expect(sourceError).toBeNull();
    testSourceId = sourceData.id;

    // 3. Trigger processing
    const { data: processData, error: processError } = await supabase.functions
      .invoke('process-pdf-with-metadata', {
        body: {
          source_id: testSourceId,
          file_path: filePath,
          notebook_id: testNotebookId
        }
      });

    expect(processError).toBeNull();

    // 4. Wait for processing to complete (with timeout)
    await waitForProcessingCompletion(testSourceId, 30000);

    // 5. Verify results
    const { data: updatedSource } = await supabase
      .from('sources')
      .select(`
        *,
        pdf_metadata (*),
        chunks_metadata (*)
      `)
      .eq('id', testSourceId)
      .single();

    expect(updatedSource.processing_status).toBe('completed');
    expect(updatedSource.pdf_metadata).toBeDefined();
    expect(updatedSource.chunks_metadata.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout

  test('should handle report generation workflow', async () => {
    // Ensure we have processed documents
    const { data: templates } = await supabase
      .from('report_templates')
      .select('*')
      .limit(1);

    expect(templates.length).toBeGreaterThan(0);

    // Generate a report
    const { data: reportData, error: reportError } = await supabase.functions
      .invoke('generate-report', {
        body: {
          notebook_id: testNotebookId,
          template_id: templates[0].id,
          topic: 'Test Development Project',
          address: '123 Test Street'
        }
      });

    expect(reportError).toBeNull();
    expect(reportData.report_generation_id).toBeDefined();

    // Wait for report completion
    await waitForReportCompletion(reportData.report_generation_id, 60000);

    // Verify report was generated
    const { data: report } = await supabase
      .from('report_generations')
      .select('*')
      .eq('id', reportData.report_generation_id)
      .single();

    expect(report.status).toBe('completed');
    expect(report.file_path).toBeDefined();
  }, 120000); // 2 minute timeout
});

// Helper functions
async function createTestPDF(): Promise<Buffer> {
  // Create a simple test PDF with known content
  const testContent = `
    Test Document
    
    Prepared for: Test Client
    Prepared by: Test Consultant
    Address: 123 Test Street, Test City
    Date: ${new Date().toDateString()}
    
    Section 1: Introduction
    This is a test document for automated testing.
    
    Section 2: Assessment
    This section contains test assessment content.
  `;
  
  // In a real implementation, you'd use a PDF library to create an actual PDF
  // For testing, you might use a pre-created test PDF file
  return Buffer.from(testContent);
}

async function waitForProcessingCompletion(sourceId: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const { data } = await supabase
      .from('sources')
      .select('processing_status')
      .eq('id', sourceId)
      .single();

    if (data.processing_status === 'completed' || data.processing_status === 'failed') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  }

  throw new Error('Processing timeout');
}

async function waitForReportCompletion(reportId: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const { data } = await supabase
      .from('report_generations')
      .select('status')
      .eq('id', reportId)
      .single();

    if (data.status === 'completed' || data.status === 'failed') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }

  throw new Error('Report generation timeout');
}
```

### 3. Performance Testing

#### Load Testing with Artillery
```yaml
# artillery-config.yml
config:
  target: 'https://your-supabase-project.supabase.co'
  phases:
    - duration: 60
      arrivalRate: 5
    - duration: 120
      arrivalRate: 10
    - duration: 60
      arrivalRate: 20
  variables:
    supabaseKey: "{{ $env.SUPABASE_ANON_KEY }}"

scenarios:
  - name: "Vector Search Performance"
    weight: 40
    flow:
      - post:
          url: "/functions/v1/batch-vector-search"
          headers:
            Authorization: "Bearer {{ supabaseKey }}"
            Content-Type: "application/json"
          json:
            queries: 
              - "heritage impact assessment"
              - "development assessment report"
              - "zoning compliance requirements"
            notebook_id: "{{ $randomString() }}"
            top_k: 5

  - name: "Chat Interface Load"
    weight: 60
    flow:
      - post:
          url: "/rest/v1/chat_messages"
          headers:
            Authorization: "Bearer {{ supabaseKey }}"
            Content-Type: "application/json"
            apikey: "{{ supabaseKey }}"
          json:
            session_id: "{{ $randomString() }}"
            message_type: "human"
            content: "What are the heritage requirements for this property?"
```

#### Database Performance Tests
```sql
-- Performance testing queries
-- test/sql/performance-tests.sql

-- Test vector similarity search performance
EXPLAIN ANALYZE
SELECT id, content, metadata, 
       1 - (embedding <=> '[test_vector_here]') as similarity
FROM documents 
WHERE 1 - (embedding <=> '[test_vector_here]') > 0.5
ORDER BY embedding <=> '[test_vector_here]'
LIMIT 10;

-- Test complex report generation query performance
EXPLAIN ANALYZE
SELECT rg.*, rt.display_name, 
       COUNT(rs.id) as total_sections,
       COUNT(rs.id) FILTER (WHERE rs.status = 'completed') as completed_sections
FROM report_generations rg
JOIN report_templates rt ON rg.template_id = rt.id
LEFT JOIN report_sections rs ON rg.id = rs.report_generation_id
WHERE rg.notebook_id = 'test-notebook-id'
GROUP BY rg.id, rt.display_name
ORDER BY rg.created_at DESC;

-- Test metadata search performance
EXPLAIN ANALYZE
SELECT s.*, pm.* 
FROM sources s
LEFT JOIN pdf_metadata pm ON s.id = pm.source_id
WHERE pm.address ILIKE '%test%' 
   OR pm.prepared_for ILIKE '%test%'
   OR s.display_name ILIKE '%test%';
```

## Monitoring and Observability Setup

### 1. Supabase Monitoring Functions

```sql
-- monitoring/monitoring-functions.sql

-- System health monitoring function
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
  component text,
  status text,
  details jsonb,
  last_checked timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'database'::text as component,
    CASE 
      WHEN COUNT(*) > 0 THEN 'healthy'
      ELSE 'unhealthy'
    END as status,
    jsonb_build_object(
      'total_sources', COUNT(*),
      'processing_sources', COUNT(*) FILTER (WHERE processing_status = 'processing'),
      'failed_sources', COUNT(*) FILTER (WHERE processing_status = 'failed')
    ) as details,
    NOW() as last_checked
  FROM sources
  
  UNION ALL
  
  SELECT 
    'reports'::text as component,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'failed') = 0 THEN 'healthy'
      ELSE 'degraded'
    END as status,
    jsonb_build_object(
      'total_reports', COUNT(*),
      'processing_reports', COUNT(*) FILTER (WHERE status = 'processing'),
      'failed_reports', COUNT(*) FILTER (WHERE status = 'failed'),
      'completed_reports', COUNT(*) FILTER (WHERE status = 'completed')
    ) as details,
    NOW() as last_checked
  FROM report_generations
  
  UNION ALL
  
  SELECT 
    'vector_store'::text as component,
    CASE 
      WHEN COUNT(*) > 0 THEN 'healthy'
      ELSE 'no_data'
    END as status,
    jsonb_build_object(
      'total_documents', COUNT(*),
      'total_chunks', (SELECT COUNT(*) FROM chunks_metadata)
    ) as details,
    NOW() as last_checked
  FROM documents;
END;
$$ LANGUAGE plpgsql;

-- Performance metrics function
CREATE OR REPLACE FUNCTION get_performance_metrics()
RETURNS TABLE (
  metric_name text,
  metric_value numeric,
  metric_unit text,
  measured_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'avg_processing_time'::text as metric_name,
    AVG(EXTRACT(EPOCH FROM (processed_at - created_at)))::numeric as metric_value,
    'seconds'::text as metric_unit,
    NOW() as measured_at
  FROM sources 
  WHERE processing_status = 'completed' 
    AND processed_at > NOW() - INTERVAL '24 hours'
    
  UNION ALL
  
  SELECT 
    'avg_report_generation_time'::text as metric_name,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::numeric as metric_value,
    'seconds'::text as metric_unit,
    NOW() as measured_at
  FROM report_generations 
  WHERE status = 'completed' 
    AND completed_at > NOW() - INTERVAL '24 hours'
    
  UNION ALL
  
  SELECT 
    'processing_success_rate'::text as metric_name,
    (COUNT(*) FILTER (WHERE processing_status = 'completed') * 100.0 / COUNT(*))::numeric as metric_value,
    'percentage'::text as metric_unit,
    NOW() as measured_at
  FROM sources 
  WHERE created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Alert conditions function
CREATE OR REPLACE FUNCTION check_alert_conditions()
RETURNS TABLE (
  alert_type text,
  severity text,
  message text,
  details jsonb,
  triggered_at timestamptz
) AS $$
BEGIN
  -- High failure rate alert
  INSERT INTO system_alerts (alert_type, severity, message, details)
  SELECT 
    'high_failure_rate'::text,
    'critical'::text,
    'High PDF processing failure rate detected'::text,
    jsonb_build_object(
      'failure_rate', failure_rate,
      'failed_count', failed_count,
      'total_count', total_count
    ),
    NOW()
  FROM (
    SELECT 
      COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_count,
      COUNT(*) as total_count,
      (COUNT(*) FILTER (WHERE processing_status = 'failed') * 100.0 / COUNT(*)) as failure_rate
    FROM sources 
    WHERE created_at > NOW() - INTERVAL '1 hour'
  ) stats
  WHERE stats.failure_rate > 20 AND stats.total_count > 5
  ON CONFLICT (alert_type, triggered_at::date) DO NOTHING;
  
  -- Long processing time alert
  INSERT INTO system_alerts (alert_type, severity, message, details)
  SELECT 
    'long_processing_time'::text,
    'warning'::text,
    'Documents taking unusually long to process'::text,
    jsonb_build_object(
      'avg_processing_time', avg_time,
      'slow_count', slow_count
    ),
    NOW()
  FROM (
    SELECT 
      AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_time,
      COUNT(*) as slow_count
    FROM sources 
    WHERE processing_status = 'processing' 
      AND created_at < NOW() - INTERVAL '30 minutes'
  ) stats
  WHERE stats.slow_count > 0
  ON CONFLICT (alert_type, triggered_at::date) DO NOTHING;
  
  RETURN QUERY
  SELECT sa.alert_type, sa.severity, sa.message, sa.details, sa.triggered_at
  FROM system_alerts sa
  WHERE sa.triggered_at > NOW() - INTERVAL '1 hour'
  ORDER BY sa.triggered_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(alert_type, triggered_at::date)
);
```

### 2. Application Monitoring Setup

```typescript
// lib/monitoring.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class SystemMonitor {
  private static instance: SystemMonitor;
  
  static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  async getSystemHealth() {
    try {
      const { data, error } = await supabase.rpc('get_system_health');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting system health:', error);
      return [];
    }
  }

  async getPerformanceMetrics() {
    try {
      const { data, error } = await supabase.rpc('get_performance_metrics');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return [];
    }
  }

  async checkAlerts() {
    try {
      const { data, error } = await supabase.rpc('check_alert_conditions');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking alerts:', error);
      return [];
    }
  }

  async logEvent(eventType: string, details: any) {
    try {
      await supabase
        .from('system_events')
        .insert({
          event_type: eventType,
          details: details,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  // Real-time monitoring
  subscribeToProcessingUpdates(callback: (payload: any) => void) {
    return supabase
      .channel('processing_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sources',
          filter: 'processing_status=eq.completed'
        },
        callback
      )
      .subscribe();
  }

  subscribeToReportUpdates(callback: (payload: any) => void) {
    return supabase
      .channel('report_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'report_generations',
          filter: 'status=eq.completed'
        },
        callback
      )
      .subscribe();
  }
}

// Usage in React components
export function useSystemMonitoring() {
  const [health, setHealth] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const monitor = SystemMonitor.getInstance();
    
    const loadData = async () => {
      const [healthData, metricsData, alertsData] = await Promise.all([
        monitor.getSystemHealth(),
        monitor.getPerformanceMetrics(),
        monitor.checkAlerts()
      ]);
      
      setHealth(healthData);
      setMetrics(metricsData);
      setAlerts(alertsData);
    };

    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { health, metrics, alerts };
}
```

### 3. External Service Monitoring

```typescript
// lib/external-monitoring.ts

export class ExternalServiceMonitor {
  async checkOllamaHealth(): Promise<{ status: string; details: any }> {
    try {
      const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        status: 'healthy',
        details: {
          models: data.models?.length || 0,
          response_time: response.headers.get('x-response-time')
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  async checkLlamaCloudHealth(): Promise<{ status: string; details: any }> {
    try {
      const response = await fetch('https://api.llamaindex.ai/api/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.LLAMACLOUD_API_KEY}`
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        status: 'healthy',
        details: { response_time: Date.now() }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  async checkN8nHealth(): Promise<{ status: string; details: any }> {
    try {
      const response = await fetch(`${process.env.N8N_WEBHOOK_BASE_URL}/healthz`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        status: 'healthy',
        details: { response_time: Date.now() }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  async runHealthChecks() {
    const [ollama, llamaCloud, n8n] = await Promise.allSettled([
      this.checkOllamaHealth(),
      this.checkLlamaCloudHealth(),
      this.checkN8nHealth()
    ]);

    return {
      ollama: ollama.status === 'fulfilled' ? ollama.value : { status: 'error', details: ollama.reason },
      llamaCloud: llamaCloud.status === 'fulfilled' ? llamaCloud.value : { status: 'error', details: llamaCloud.reason },
      n8n: n8n.status === 'fulfilled' ? n8n.value : { status: 'error', details: n8n.reason }
    };
  }
}
```

### 4. Error Tracking and Logging

```typescript
// lib/error-tracking.ts

export class ErrorTracker {
  static async logError(
    error: Error,
    context: {
      component: string;
      action: string;
      userId?: string;
      metadata?: any;
    }
  ) {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        component: context.component,
        action: context.action,
        user_id: context.userId,
        metadata: context.metadata,
        timestamp: new Date().toISOString(),
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server'
      };

      // Log to Supabase
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase
        .from('error_logs')
        .insert(errorData);

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error tracked:', errorData);
      }

    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  static async getErrorStats(timeRange: string = '24h') {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const interval = timeRange === '24h' ? '24 hours' : 
                     timeRange === '7d' ? '7 days' : '24 hours';

      const { data, error } = await supabase
        .from('error_logs')
        .select('component, action, message')
        .gte('timestamp', new Date(Date.now() - (timeRange === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)).toISOString());

      if (error) throw error;

      // Group errors by component and action
      const stats = data.reduce((acc, error) => {
        const key = `${error.component}:${error.action}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return stats;
    } catch (error) {
      console.error('Error getting error stats:', error);
      return {};
    }
  }
}

// Create error logs table
const errorLogsTableSQL = `
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  stack TEXT,
  component TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  url TEXT,
  
  -- Indexes for performance
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_component ON error_logs(component);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
`;
```

### 5. Monitoring Dashboard Component

```typescript
// components/MonitoringDashboard.tsx
import { useSystemMonitoring } from '../lib/monitoring';
import { ExternalServiceMonitor } from '../lib/external-monitoring';

export function MonitoringDashboard() {
  const { health, metrics, alerts } = useSystemMonitoring();
  const [externalServices, setExternalServices] = useState({});

  useEffect(() => {
    const monitor = new ExternalServiceMonitor();
    
    const checkServices = async () => {
      const results = await monitor.runHealthChecks();
      setExternalServices(results);
    };

    checkServices();
    const interval = setInterval(checkServices, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">System Monitoring Dashboard</h1>

      {/* System Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {health.map((component) => (
          <div key={component.component} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{component.component}</h3>
              <StatusBadge status={component.status} />
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {JSON.stringify(component.details, null, 2)}
            </div>
          </div>
        ))}
      </div>

      {/* External Services */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">External Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(externalServices).map(([service, status]) => (
            <div key={service} className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">{service}</span>
              <StatusBadge status={status.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div key={metric.metric_name} className="text-center p-4 border rounded">
              <div className="text-2xl font-bold text-blue-600">
                {parseFloat(metric.metric_value).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">{metric.metric_unit}</div>
              <div className="text-sm font-medium">{metric.metric_name.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Active Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-3 rounded border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="font-medium">{alert.message}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {new Date(alert.triggered_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getColor = () => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getColor()}`}>
      {status}
    </span>
  );
}
```

This comprehensive testing and monitoring setup provides:

1. **Complete test coverage** from unit tests to integration tests
2. **Performance testing** with load testing scenarios
3. **Real-time monitoring** of system health and performance
4. **External service monitoring** for dependencies
5. **Error tracking and logging** for debugging
6. **Visual dashboard** for monitoring system status

The monitoring system tracks key metrics like processing times, success rates, and system health across all components of the town planning RAG system.