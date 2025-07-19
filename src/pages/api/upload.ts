import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get the file from the request body
    const arrayBuffer = await req.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Generate a unique filename
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}.pdf`;
    const filePath = `pdfs/${fileName}`;

    // Upload to Supabase storage bucket
    const { data, error } = await supabase.storage
      .from('hh_pdf_library')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      return new Response('Upload failed', { status: 500 });
    }

    // Store metadata in hh_uploads table
    const { data: uploadData, error: dbError } = await supabase
      .from('hh_uploads')
      .insert({
        id: fileId,
        filename: fileName,
        file_size: buffer.length,
        file_path: filePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return new Response('Database error', { status: 500 });
    }

    // Trigger n8n ingestion workflow
    const n8nUrl = process.env.N8N_INGEST_URL;
    if (n8nUrl) {
      try {
        await fetch(n8nUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId }),
        });
      } catch (error) {
        console.error('N8N ingestion trigger failed:', error);
        // Don't fail the upload if n8n trigger fails
      }
    }

    return new Response(JSON.stringify({
      id: fileId,
      fileName: fileName
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}