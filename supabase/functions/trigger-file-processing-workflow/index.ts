
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface FileProcessingRequest {
  sourceId: string;
  filePath: string;
  notebookId: string;
  fileName: string;
  fileSize: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceId, filePath, notebookId, fileName, fileSize }: FileProcessingRequest = await req.json();
    
    console.log(`Triggering file processing workflow for source ${sourceId}`);
    
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_BASE_URL');
    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    
    if (!n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_BASE_URL not configured');
    }
    
    // Prepare payload for n8n file processing workflow
    const payload = {
      sourceId,
      filePath,
      notebookId,
      fileName,
      fileSize,
      timestamp: new Date().toISOString(),
      source: 'supabase-file-trigger'
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (n8nApiKey) {
      headers['Authorization'] = `Bearer ${n8nApiKey}`;
    }
    
    // Call n8n file processing webhook
    const fileWebhookUrl = `${n8nWebhookUrl}/webhook/process-file-upload`;
    console.log(`Calling n8n file processing webhook: ${fileWebhookUrl}`);
    
    const response = await fetch(fileWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`N8N file processing webhook failed: ${response.status} - ${errorText}`);
      throw new Error(`N8N file processing webhook returned ${response.status}: ${response.statusText}`);
    }
    
    let n8nResponse;
    const responseText = await response.text();
    try {
      n8nResponse = JSON.parse(responseText);
    } catch {
      n8nResponse = { message: responseText };
    }
    
    console.log(`Successfully triggered file processing workflow for source ${sourceId}`);
    
    return new Response(JSON.stringify({
      success: true,
      sourceId,
      filePath,
      timestamp: new Date().toISOString(),
      n8nResponse
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error in trigger-file-processing-workflow function:', error);
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
