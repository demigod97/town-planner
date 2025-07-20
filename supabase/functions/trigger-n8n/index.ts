import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface TriggerRequest {
  step: number;
  jobId: string;
  bucket?: string;
  path?: string;
  metadata?: any;
}

interface TriggerResponse {
  success: boolean;
  step: number;
  jobId: string;
  timestamp: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const requestBody: TriggerRequest = await req.json();
    const { step, jobId, bucket, path, metadata } = requestBody;
    
    console.log(`Triggering n8n step ${step} for job ${jobId}`);
    
    // Get webhook URLs from environment variables
    const webhookUrls: Record<number, string | undefined> = {
      1: Deno.env.get('N8N_WEBHOOK_STEP1'),
      2: Deno.env.get('N8N_WEBHOOK_STEP2'),
      3: Deno.env.get('N8N_WEBHOOK_STEP3'),
      // Add more steps as needed
    };
    
    const webhookUrl = webhookUrls[step];
    
    if (!webhookUrl) {
      console.error(`No webhook URL configured for step ${step}`);
      return new Response(JSON.stringify({
        error: `No webhook URL configured for step ${step}`,
        availableSteps: Object.keys(webhookUrls).filter(key => webhookUrls[parseInt(key)])
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Prepare the payload for n8n
    const payload = {
      jobId,
      bucket,
      path,
      step,
      metadata,
      timestamp: new Date().toISOString(),
      source: 'supabase-edge-function'
    };
    
    // Get n8n API key if available
    const n8nApiKey = Deno.env.get('VITE_N8N_API_KEY');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (n8nApiKey) {
      headers['Authorization'] = `Bearer ${n8nApiKey}`;
    }
    
    // Trigger the n8n webhook
    console.log(`Calling webhook: ${webhookUrl}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`N8N webhook returned ${response.status}: ${errorText}`);
      throw new Error(`N8N webhook returned ${response.status}: ${response.statusText}`);
    }
    
    // Try to parse the response from n8n
    let n8nResponse;
    const responseText = await response.text();
    try {
      n8nResponse = JSON.parse(responseText);
    } catch {
      n8nResponse = { message: responseText };
    }
    
    console.log(`Successfully triggered n8n step ${step} for job ${jobId}`);
    console.log(`N8N response:`, n8nResponse);
    
    const successResponse: TriggerResponse = {
      success: true,
      step,
      jobId,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify({
      ...successResponse,
      n8nResponse
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error in trigger-n8n function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);