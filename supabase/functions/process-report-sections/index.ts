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

    const { report_generation_id, queries } = await req.json()

    if (!report_generation_id || !queries) {
      throw new Error('Missing required parameters: report_generation_id, queries')
    }

    // Get all sections for this report
    const { data: sections, error: sectionsError } = await supabase
      .from('report_sections')
      .select('*')
      .eq('report_generation_id', report_generation_id)
      .eq('status', 'pending')
      .order('section_order')

    if (sectionsError) {
      throw new Error(`Failed to get sections: ${sectionsError.message}`)
    }

    const totalSections = sections.length
    let completedSections = 0

    // Process each section
    for (const section of sections) {
      try {
        // Update section status to processing
        await supabase
          .from('report_sections')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', section.id)

        // Get relevant context using vector search
        const searchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/batch-vector-search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queries: [section.query_used],
            notebook_id: null, // Get from report generation if needed
            top_k: 5
          })
        })

        const searchData = await searchResponse.json()
        const relevantChunks = searchData.results[0]?.results || []

        // Build context from relevant chunks
        const context = relevantChunks
          .map((chunk: any) => chunk.content)
          .join('\n\n')

        // Generate content using Ollama
        const ollamaResponse = await fetch(`${Deno.env.get('OLLAMA_BASE_URL')}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3.1:8b',
            prompt: `Based on the following context from planning documents, write a comprehensive section for "${section.section_name}"${section.subsection_name ? ` - "${section.subsection_name}"` : ''}:

Context:
${context}

Query: ${section.query_used}

Please provide a detailed, professional response that directly addresses the query using the provided context. If the context doesn't contain relevant information, please state that clearly.`,
            stream: false
          })
        })

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama API error: ${ollamaResponse.status}`)
        }

        const ollamaData = await ollamaResponse.json()
        const generatedContent = ollamaData.response

        // Update section with generated content
        await supabase
          .from('report_sections')
          .update({
            status: 'completed',
            generated_content: generatedContent,
            chunks_retrieved: relevantChunks.map((chunk: any) => chunk.id),
            word_count: generatedContent.split(/\s+/).length,
            completed_at: new Date().toISOString()
          })
          .eq('id', section.id)

        completedSections++

        // Update overall progress
        const progress = Math.round((completedSections / totalSections) * 100)
        await supabase
          .from('report_generations')
          .update({ progress })
          .eq('id', report_generation_id)

      } catch (sectionError) {
        console.error(`Error processing section ${section.id}:`, sectionError)
        
        // Mark section as failed
        await supabase
          .from('report_sections')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString()
          })
          .eq('id', section.id)
      }
    }

    // Check if all sections are completed
    const { data: finalSections } = await supabase
      .from('report_sections')
      .select('status')
      .eq('report_generation_id', report_generation_id)

    const allCompleted = finalSections?.every(s => s.status === 'completed' || s.status === 'failed')

    if (allCompleted) {
      // Generate final report by combining all sections
      const { data: completedSections } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_generation_id', report_generation_id)
        .eq('status', 'completed')
        .order('section_order')

      const fullReport = completedSections
        ?.map(section => {
          let content = `# ${section.section_name}\n\n`
          if (section.subsection_name) {
            content += `## ${section.subsection_name}\n\n`
          }
          content += section.generated_content + '\n\n'
          return content
        })
        .join('')

      // Update report generation with final content
      await supabase
        .from('report_generations')
        .update({
          status: 'completed',
          progress: 100,
          generated_content: fullReport,
          completed_at: new Date().toISOString()
        })
        .eq('id', report_generation_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        completed_sections: completedSections,
        total_sections: totalSections,
        message: 'Report sections processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing report sections:', error)
    
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