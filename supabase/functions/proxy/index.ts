import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Settings interface
interface Settings {
  chatUrl: string;
  ingestUrl: string;
  templateUrl: string;
  n8nBaseUrl: string;
  n8nApiKey: string;
}

// Get settings from Supabase or use defaults
function getSettings(): Settings {
  return {
    chatUrl: Deno.env.get('VITE_N8N_CHAT_WEBHOOK') || '',
    ingestUrl: Deno.env.get('VITE_N8N_INGEST_URL') || '',
    templateUrl: Deno.env.get('VITE_N8N_TEMPLATE_URL') || '',
    n8nBaseUrl: Deno.env.get('VITE_N8N_BASE_URL') || '',
    n8nApiKey: Deno.env.get('VITE_N8N_API_KEY') || '',
  };
}

// Handle test requests
async function handleTestRequest(req: Request, settings: Settings): Promise<Response> {
  try {
    const body = await req.json();
    const { field, key } = body;

    let testUrl: string;
    let testHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (field) {
      case 'chat':
        testUrl = settings.chatUrl;
        break;
      case 'ingest':
        testUrl = settings.ingestUrl;
        break;
      case 'template':
        testUrl = settings.templateUrl;
        break;
      case 'n8n':
        // For n8n API key test, we'll test the health endpoint
        testUrl = `${settings.n8nBaseUrl}/healthz`;
        testHeaders['Authorization'] = `Bearer ${key}`;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid field' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!testUrl) {
      return new Response(JSON.stringify({ error: 'Test URL not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Testing ${field} at ${testUrl}`);
    
    // Make a simple HEAD request to test connectivity
    const testResponse = await fetch(testUrl, {
      method: field === 'n8n' ? 'GET' : 'HEAD',
      headers: testHeaders,
    });

    console.log(`Test response status: ${testResponse.status}`);

    if (testResponse.ok || testResponse.status === 405) {
      // 405 Method Not Allowed is also OK for HEAD requests
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: `HTTP ${testResponse.status}` }), {
        status: testResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Extract slug from path: /functions/v1/proxy/{slug}
    const slug = pathSegments[pathSegments.length - 1];
    
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing slug parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = getSettings();
    let targetUrl: string;

    // Map slug to target URL
    switch (slug) {
      case 'chat':
        targetUrl = settings.chatUrl;
        break;
      case 'ingest':
        targetUrl = settings.ingestUrl;
        break;
      case 'template':
        targetUrl = settings.templateUrl;
        break;
      case 'test':
        return handleTestRequest(req, settings);
      default:
        // Handle n8n/* routes
        if (slug.startsWith('n8n')) {
          const n8nPath = url.pathname.replace('/functions/v1/proxy/n8n', '');
          targetUrl = settings.n8nBaseUrl + n8nPath;
        } else {
          return new Response(JSON.stringify({ error: 'Invalid slug' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
    }

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Target URL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prepare headers for the proxied request
    const proxyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization for n8n API calls
    if (slug.startsWith('n8n') && settings.n8nApiKey) {
      proxyHeaders['Authorization'] = `Bearer ${settings.n8nApiKey}`;
    }

    // Get request body if present
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text();
    }

    console.log(`Proxying ${req.method} request to: ${targetUrl}`);
    console.log(`Headers:`, proxyHeaders);
    
    // Forward the request to the target URL
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      body: body,
    });

    const responseText = await response.text();
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response body: ${responseText}`);

    // Mirror the response back to the client
    return new Response(responseText, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });

  } catch (error: any) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy request failed', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);