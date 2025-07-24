import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookRequest {
  webhook_type: 'ingest' | 'chat' | 'template'
  webhook_url?: string
  payload: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { webhook_type, webhook_url, payload }: WebhookRequest = await req.json()

    if (!webhook_type || !payload) {
      throw new Error('Missing required parameters: webhook_type, payload')
    }

    // Get webhook URL from environment if not provided
    let finalWebhookUrl = webhook_url || ''
    
    if (webhook_type === 'chat' && !finalWebhookUrl) {
      finalWebhookUrl = Deno.env.get('N8N_CHAT_WEBHOOK_URL') || 'https://n8n.coralshades.ai/webhook-test/hhlm-chat'
    }
    
    if (!finalWebhookUrl) {
      throw new Error(`No webhook URL provided for ${webhook_type} webhook`)
    }

    console.log(`Triggering ${webhook_type} webhook: ${finalWebhookUrl}`)

    // Add webhook type to payload for n8n routing
    const enhancedPayload = {
      ...payload,
      webhook_type,
      timestamp: new Date().toISOString()
    }

    // Call the n8n webhook
    const response = await fetch(finalWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-Edge-Function/1.0'
      },
      body: JSON.stringify(enhancedPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`n8n webhook failed: ${response.status} ${errorText}`)
    }

    const responseData = await response.json().catch(() => ({}))

    console.log(`${webhook_type} webhook completed successfully`)

    return new Response(
      JSON.stringify({
        success: true,
        webhook_type,
        response: responseData,
        message: `${webhook_type} webhook triggered successfully`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error triggering n8n webhook:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to trigger n8n webhook'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})