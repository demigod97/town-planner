// =====================================================
// Edge Function 1: process-pdf-with-metadata
// File: supabase/functions/process-pdf-with-metadata/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PDFMetadata {
  prepared_for?: string;
  prepared_by?: string;
  address?: string;
  report_issued_date?: string;
  document_title?: string;
  document_type?: string;
  page_count?: number;
  sections?: any[];
  authors?: string[];
  keywords?: string[];
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

    const { source_id, file_path, notebook_id } = await req.json()

    if (!source_id || !file_path) {
      throw new Error('Missing required parameters: source_id, file_path')
    }

    // 1. Get signed URL for the file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('sources')
      .createSignedUrl(file_path, 60 * 60) // 1 hour expiry

    if (signedUrlError) {
      throw new Error(`Failed to get signed URL: ${signedUrlError.message}`)
    }

    // 2. Send to LlamaCloud API for parsing
    const llamaCloudResponse = await fetch('https://api.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LLAMACLOUD_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_url: signedUrlData.signedUrl,
        parsing_instruction: `
          Extract the following metadata from this document:
          - Prepared for (client/organization name)
          - Prepared by (author/company name)  
          - Address (subject property address)
          - Report issued date
          - Document title
          - Document type (e.g., Heritage Report, Development Assessment, etc.)
          - Section titles and page ranges
          - Authors/contributors
          - Keywords
          
          Also provide the full structured content in markdown format with clear section headings.
        `,
        result_type: 'markdown',
        invalidate_cache: false,
        webhook_url: null
      })
    })

    if (!llamaCloudResponse.ok) {
      throw new Error(`LlamaCloud API error: ${llamaCloudResponse.status}`)
    }

    const llamaData = await llamaCloudResponse.json()
    const jobId = llamaData.id

    // 3. Poll for completion (implement proper polling with timeout)
    let attempts = 0
    const maxAttempts = 30 // 5 minutes with 10-second intervals
    let jobResult = null

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://api.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LLAMACLOUD_API_KEY')}`,
        }
      })

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        
        if (statusData.status === 'SUCCESS') {
          jobResult = statusData
          break
        } else if (statusData.status === 'ERROR') {
          throw new Error(`LlamaCloud processing failed: ${statusData.error}`)
        }
      }

      attempts++
      await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
    }

    if (!jobResult) {
      throw new Error('LlamaCloud processing timeout')
    }

    // 4. Extract metadata from the parsed content
    const parsedContent = jobResult.result.markdown
    const metadata = extractMetadataFromContent(parsedContent)

    // 5. Store metadata in database
    const { data: metadataRecord, error: metadataError } = await supabase
      .from('pdf_metadata')
      .insert({
        source_id,
        notebook_id,
        ...metadata,
        raw_metadata: jobResult.result,
        extraction_method: 'llamacloud',
        confidence_score: 0.85, // You can implement actual confidence scoring
      })
      .select()
      .single()

    if (metadataError) {
      throw new Error(`Failed to store metadata: ${metadataError.message}`)
    }

    // 6. Perform semantic chunking
    const chunks = performSemanticChunking(parsedContent, metadata)

    // 7. Store chunk metadata
    const chunkMetadataPromises = chunks.map((chunk, index) => 
      supabase.from('chunks_metadata').insert({
        chunk_id: index + 1, // This will need to be updated with actual vector store IDs
        source_id,
        pdf_metadata_id: metadataRecord.id,
        section_title: chunk.section_title,
        subsection_title: chunk.subsection_title,
        page_numbers: chunk.page_numbers,
        paragraph_index: chunk.paragraph_index,
        content_type: chunk.content_type,
        hierarchy_level: chunk.hierarchy_level,
        metadata: chunk.additional_metadata
      })
    )

    await Promise.all(chunkMetadataPromises)

    // 8. Update source status
    await supabase
      .from('sources')
      .update({
        processing_status: 'completed',
        metadata_extracted: true,
        processed_at: new Date().toISOString(),
        extracted_metadata: metadata
      })
      .eq('id', source_id)

    // 9. Trigger n8n workflow for vector embedding
    const n8nWebhookUrl = `${Deno.env.get('N8N_WEBHOOK_BASE_URL')}/webhook/upsert-to-vector-store`
    
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('N8N_API_KEY')}`,
      },
      body: JSON.stringify({
        source_id,
        notebook_id,
        extracted_text: parsedContent,
        chunks: chunks
      })
    })

    return new Response(
      JSON.stringify({
        success: true,
        metadata: metadataRecord,
        chunks_count: chunks.length,
        message: 'PDF processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing PDF:', error)
    
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

// Helper function to extract metadata from parsed content
function extractMetadataFromContent(content: string): PDFMetadata {
  const metadata: PDFMetadata = {}
  
  // Use regex patterns to extract metadata
  const patterns = {
    prepared_for: /(?:prepared for|client):?\s*([^\n]+)/i,
    prepared_by: /(?:prepared by|author|consultant):?\s*([^\n]+)/i,
    address: /(?:address|property|site):?\s*([^\n]+)/i,
    report_issued_date: /(?:date|issued):?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    document_title: /^#\s*(.+)$/m,
    document_type: /(?:report type|type):?\s*([^\n]+)/i,
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern)
    if (match) {
      metadata[key as keyof PDFMetadata] = match[1]?.trim()
    }
  }

  // Extract sections
  const sectionMatches = content.match(/^#{1,3}\s*(.+)$/gm)
  if (sectionMatches) {
    metadata.sections = sectionMatches.map(match => ({
      title: match.replace(/^#+\s*/, ''),
      level: (match.match(/^#+/) || [''])[0].length
    }))
  }

  return metadata
}

// Helper function for semantic chunking
function performSemanticChunking(content: string, metadata: PDFMetadata) {
  const chunks = []
  const sections = content.split(/^#{1,3}\s/m)
  
  sections.forEach((section, index) => {
    if (!section.trim()) return
    
    const lines = section.split('\n')
    const sectionTitle = lines[0]?.trim()
    const sectionContent = lines.slice(1).join('\n').trim()
    
    // Split long sections into smaller chunks
    const paragraphs = sectionContent.split(/\n\s*\n/)
    
    paragraphs.forEach((paragraph, pIndex) => {
      if (paragraph.trim().length < 50) return // Skip very short paragraphs
      
      chunks.push({
        content: paragraph.trim(),
        section_title: sectionTitle,
        subsection_title: null,
        page_numbers: [], // This would need to be extracted from LlamaCloud metadata
        paragraph_index: pIndex,
        content_type: 'text',
        hierarchy_level: (sectionTitle?.match(/^#+/) || [''])[0].length || 0,
        additional_metadata: {
          word_count: paragraph.split(/\s+/).length,
          char_count: paragraph.length
        }
      })
    })
  })
  
  return chunks
}

// =====================================================
// Edge Function 2: generate-report
// File: supabase/functions/generate-report/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// =====================================================
// Edge Function 3: batch-vector-search
// File: supabase/functions/batch-vector-search/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

      return { query, results: data || [], error: null }
    })

    const searchResults = await Promise.all(searchPromises)

    return new Response(
      JSON.stringify({
        success: true,
        results: searchResults,
        total_queries: queries.length
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

// =====================================================
// Edge Function 4: process-report-sections
// File: supabase/functions/process-report-sections/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      throw new Error('Missing required parameters')
    }

    // 1. Get report generation details
    const { data: reportGen, error: reportError } = await supabase
      .from('report_generations')
      .select('notebook_id, topic, address')
      .eq('id', report_generation_id)
      .single()

    if (reportError) {
      throw new Error(`Failed to get report generation: ${reportError.message}`)
    }

    // 2. Perform batch vector search
    const searchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/batch-vector-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: queries.map((q: any) => q.query),
        notebook_id: reportGen.notebook_id,
        top_k: 5
      })
    })

    if (!searchResponse.ok) {
      throw new Error('Batch vector search failed')
    }

    const searchData = await searchResponse.json()

    // 3. Generate content for each section using Ollama
    const ollamaUrl = `${Deno.env.get('OLLAMA_BASE_URL')}/api/generate`
    
    let completedSections = 0
    const totalSections = queries.length

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      const searchResult = searchData.results[i]

      try {
        // Update section status to processing
        await supabase
          .from('report_sections')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString(),
            chunks_retrieved: searchResult.results?.map((r: any) => r.id) || []
          })
          .eq('report_generation_id', report_generation_id)
          .eq('section_name', query.section_name)
          .eq('subsection_name', query.subsection_name)

        // Prepare context from search results
        const context = searchResult.results?.map((r: any) => r.content).join('\n\n') || ''
        
        // Generate content using Ollama
        const prompt = `
You are a professional town planning consultant writing a section of a planning report.

Context from knowledge base:
${context}

Section: ${query.section_name}${query.subsection_name ? ` - ${query.subsection_name}` : ''}
Topic: ${reportGen.topic}
${reportGen.address ? `Address: ${reportGen.address}` : ''}

Write a professional, detailed section for this planning report. The content should be:
- Technically accurate and well-structured
- Based on the provided context where relevant
- Professional in tone and language
- Comprehensive and detailed
- Include specific references to planning controls, regulations, or requirements where applicable

Please write the section content now:
`

        const ollamaResponse = await fetch(ollamaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'qwen3:8b-q4_K_M',
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.3,
              max_tokens: 2000
            }
          })
        })

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama generation failed for section ${query.section_name}`)
        }

        const ollamaData = await ollamaResponse.json()
        const generatedContent = ollamaData.response

        // Update section with generated content
        await supabase
          .from('report_sections')
          .update({
            status: 'completed',
            generated_content: generatedContent,
            word_count: generatedContent.split(/\s+/).length,
            completed_at: new Date().toISOString()
          })
          .eq('report_generation_id', report_generation_id)
          .eq('section_name', query.section_name)
          .eq('subsection_name', query.subsection_name)

        completedSections++

        // Update overall progress
        const progress = Math.round((completedSections / totalSections) * 100)
        await supabase
          .from('report_generations')
          .update({ progress })
          .eq('id', report_generation_id)

      } catch (sectionError) {
        console.error(`Error processing section ${query.section_name}:`, sectionError)
        
        // Mark section as failed
        await supabase
          .from('report_sections')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString()
          })
          .eq('report_generation_id', report_generation_id)
          .eq('section_name', query.section_name)
          .eq('subsection_name', query.subsection_name)
      }
    }

    // 4. Assemble final report
    const { data: sections, error: sectionsError } = await supabase
      .from('report_sections')
      .select('*')
      .eq('report_generation_id', report_generation_id)
      .order('section_order')

    if (sectionsError) {
      throw new Error(`Failed to get sections: ${sectionsError.message}`)
    }

    // Assemble the final report content
    let finalReport = `# ${reportGen.topic}\n\n`
    if (reportGen.address) {
      finalReport += `**Address:** ${reportGen.address}\n\n`
    }
    finalReport += `**Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`

    sections?.forEach(section => {
      if (section.generated_content) {
        finalReport += `## ${section.section_name}\n\n`
        if (section.subsection_name) {
          finalReport += `### ${section.subsection_name}\n\n`
        }
        finalReport += `${section.generated_content}\n\n`
      }
    })

    // 5. Save final report and mark as completed
    const reportFileName = `report_${report_generation_id}_${Date.now()}.md`
    
    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(reportFileName, finalReport, {
        contentType: 'text/markdown'
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
    }

    // Update report generation status
    await supabase
      .from('report_generations')
      .update({
        status: 'completed',
        progress: 100,
        generated_content: finalReport,
        file_path: reportFileName,
        file_format: 'markdown',
        file_size: new Blob([finalReport]).size,
        completed_at: new Date().toISOString()
      })
      .eq('id', report_generation_id)

    return new Response(
      JSON.stringify({
        success: true,
        report_generation_id,
        file_path: reportFileName,
        sections_completed: completedSections,
        total_sections: totalSections
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing report sections:', error)
    
    // Mark report as failed
    if (req.body && JSON.parse(await req.text()).report_generation_id) {
      const { report_generation_id } = JSON.parse(await req.text())
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase
        .from('report_generations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', report_generation_id)
    }
    
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

// =====================================================
// Additional SQL Functions for Supabase
// Add these to your migration script
// =====================================================

/*
-- Function for vector similarity search with notebook filtering
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_notebook_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 
    1 - (documents.embedding <=> query_embedding) > match_threshold
    AND (filter_notebook_id IS NULL OR documents.metadata->>'notebook_id' = filter_notebook_id::text)
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get report generation status
CREATE OR REPLACE FUNCTION get_report_status(report_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  progress integer,
  total_sections bigint,
  completed_sections bigint,
  failed_sections bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rg.id,
    rg.status,
    rg.progress,
    COUNT(rs.id) as total_sections,
    COUNT(rs.id) FILTER (WHERE rs.status = 'completed') as completed_sections,
    COUNT(rs.id) FILTER (WHERE rs.status = 'failed') as failed_sections
  FROM report_generations rg
  LEFT JOIN report_sections rs ON rg.id = rs.report_generation_id
  WHERE rg.id = report_id
  GROUP BY rg.id, rg.status, rg.progress;
END;
$$;
*/