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

    const { notebook_id, template_id, topic, address, additional_context } = await req.json()

    if (!notebook_id || !template_id || !topic) {
      throw new Error('Missing required parameters: notebook_id, template_id, topic')
    }

    // 1. Create report generation record
    const { data: reportGeneration, error: reportError } = await supabase
      .from('report_generations')
      .insert({
        notebook_id,
        template_id,
        topic,
        address,
        additional_context,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (reportError) {
      throw new Error(`Failed to create report generation: ${reportError.message}`)
    }

    // 2. Get report template structure
    const { data: template, error: templateError } = await supabase
      .from('report_templates')
      .select('structure')
      .eq('id', template_id)
      .single()

    if (templateError) {
      throw new Error(`Failed to get template: ${templateError.message}`)
    }

    const templateStructure = template.structure.sections

    // 3. Generate queries for each section/subsection
    const queries = []
    for (const section of templateStructure) {
      // Main section query
      queries.push({
        section_name: section.name,
        subsection_name: null,
        query: `Tell me about "${section.title}" for ${topic}${address ? ` at ${address}` : ''}`,
        section_order: section.order * 10
      })

      // Subsection queries
      if (section.subsections) {
        section.subsections.forEach((subsection: any, index: number) => {
          queries.push({
            section_name: section.name,
            subsection_name: subsection.name,
            query: `Provide information about "${subsection.title}" under "${section.title}" for ${topic}${address ? ` at ${address}` : ''}`,
            section_order: section.order * 10 + index + 1
          })
        })
      }
    }

    // 4. Store report sections
    const sectionPromises = queries.map(q => 
      supabase.from('report_sections').insert({
        report_generation_id: reportGeneration.id,
        section_name: q.section_name,
        subsection_name: q.subsection_name,
        query_used: q.query,
        section_order: q.section_order,
        status: 'pending'
      })
    )

    await Promise.all(sectionPromises)

    // 5. Trigger background processing
    const processingUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-report-sections`
    
    fetch(processingUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        report_generation_id: reportGeneration.id,
        queries
      })
    }).catch(error => {
      console.error('Background processing error:', error)
    })

    return new Response(
      JSON.stringify({
        success: true,
        report_generation_id: reportGeneration.id,
        message: 'Report generation started',
        sections_count: queries.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error generating report:', error)
    
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