import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  sessionId?: string;
  message: string;
  sources?: string[]; // Upload IDs to use as context
}

interface ChatResponse {
  sessionId: string;
  response: string;
  sources?: any[];
  metadata?: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body: ChatRequest = await req.json();
      const { sessionId, message, sources = [] } = body;

      if (!message?.trim()) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let currentSessionId = sessionId;

      // Create new session if not provided
      if (!currentSessionId) {
        const { data: newSession, error: sessionError } = await supabase
          .from('hh_chat_sessions')
          .insert({
            title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
            user_id: user.id
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Session creation error:', sessionError);
          return new Response(JSON.stringify({ error: 'Failed to create session' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        currentSessionId = newSession.id;
      }

      // Store user message
      const { error: messageError } = await supabase
        .from('hh_chat_messages')
        .insert({
          session_id: currentSessionId,
          role: 'user',
          content: message,
          metadata: { sources }
        });

      if (messageError) {
        console.error('Message storage error:', messageError);
      }

      // Get relevant context from vector search if sources provided
      let context = '';
      let usedSources: any[] = [];

      if (sources.length > 0) {
        // For now, we'll simulate context retrieval
        // In production, this would use the search_similar_vectors function
        context = `Context from ${sources.length} uploaded documents...`;
        usedSources = sources.map(id => ({ id, filename: 'document.pdf' }));
      }

      // Forward to n8n workflow for AI processing
      const n8nChatUrl = Deno.env.get('VITE_N8N_CHAT_WEBHOOK');
      const n8nApiKey = Deno.env.get('VITE_N8N_API_KEY');

      let aiResponse = 'I understand your question about town planning. However, the AI processing is not yet fully configured.';

      if (n8nChatUrl) {
        try {
          const n8nResponse = await fetch(n8nChatUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(n8nApiKey && { 'Authorization': `Bearer ${n8nApiKey}` })
            },
            body: JSON.stringify({
              sessionId: currentSessionId,
              question: message,
              context,
              sources: usedSources
            })
          });

          if (n8nResponse.ok) {
            const n8nData = await n8nResponse.json();
            aiResponse = n8nData.response || aiResponse;
            usedSources = n8nData.sources || usedSources;
          }
        } catch (error) {
          console.error('n8n request failed:', error);
        }
      }

      // Store AI response
      const { error: aiMessageError } = await supabase
        .from('hh_chat_messages')
        .insert({
          session_id: currentSessionId,
          role: 'assistant',
          content: aiResponse,
          metadata: { sources: usedSources }
        });

      if (aiMessageError) {
        console.error('AI message storage error:', aiMessageError);
      }

      // Update session timestamp
      await supabase
        .from('hh_chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentSessionId);

      const response: ChatResponse = {
        sessionId: currentSessionId,
        response: aiResponse,
        sources: usedSources,
        metadata: { context_used: context.length > 0 }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (req.method === 'GET') {
      // Get user's chat sessions
      const { data: sessions, error } = await supabase
        .rpc('get_user_chat_sessions_with_count', { user_uuid: user.id });

      if (error) {
        console.error('Get sessions error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch sessions' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(sessions), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);