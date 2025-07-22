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
      .from('hh_pdf_library')
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
        confidence_score: 0.85,
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
        chunk_id: index + 1,
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
        page_numbers: [],
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