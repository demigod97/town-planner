import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { queries, notebook_id, top_k = 5 } = await req.json()

    if (!queries || !Array.isArray(queries)) {
      throw new Error('Queries array is required')
    }

    // 1. Generate embeddings for all queries using Ollama
    const ollamaUrl = `${Deno.env.get('OLLAMA_BASE_URL')}/api/embeddings`
    
    const embeddingPromises = queries.map(async (query: string) => {
      const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'nomic-embed-text:latest',
          prompt: query
        })
      })
      
      if (!response.ok) {
        throw new Error(`Ollama embedding failed for query: ${query}`)
      }
      
      const data = await response.json()
      return {
        query,
        embedding: data.embedding
      }
    })

    const queryEmbeddings = await Promise.all(embeddingPromises)

    // 2. Perform vector searches in parallel
    const searchPromises = queryEmbeddings.map(async ({ query, embedding }) => {
      // Convert embedding to PostgreSQL vector format
      const embeddingStr = `[${embedding.join(',')}]`
      
      // Perform similarity search
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: embeddingStr,
        match_threshold: 0.5,
        match_count: top_k,
        filter_notebook_id: notebook_id
      })

      if (error) {
        console.error(`Vector search error for query "${query}":`, error)
        return { query, results: [], error: error.message }
      }

      return {
        query,
        results: data || [],
        error: null
      }
    })

    const searchResults = await Promise.all(searchPromises)

    return new Response(
      JSON.stringify({
        success: true,
        results: searchResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in batch vector search:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})