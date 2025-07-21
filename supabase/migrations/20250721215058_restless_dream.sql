/*
  # Create storage buckets and policies

  1. Storage Buckets
    - hh_pdf_library - PDF document storage
    - hh_templates - Generated template file storage

  2. Storage Policies
    - User-specific access to their own files
    - Private buckets with signed URLs
    - Proper CRUD permissions for file operations
*/

-- Create storage bucket for PDF library
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hh_pdf_library', 'hh_pdf_library', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for templates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hh_templates', 'hh_templates', false)
ON CONFLICT (id) DO NOTHING;

-- PDF Library Storage Policies
DROP POLICY IF EXISTS "Users can view their own pdf files" ON storage.objects;
CREATE POLICY "Users can view their own pdf files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own pdf files" ON storage.objects;
CREATE POLICY "Users can upload their own pdf files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own pdf files" ON storage.objects;
CREATE POLICY "Users can update their own pdf files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own pdf files" ON storage.objects;
CREATE POLICY "Users can delete their own pdf files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Templates Storage Policies
DROP POLICY IF EXISTS "Users can view their own template files" ON storage.objects;
CREATE POLICY "Users can view their own template files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own template files" ON storage.objects;
CREATE POLICY "Users can upload their own template files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own template files" ON storage.objects;
CREATE POLICY "Users can update their own template files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own template files" ON storage.objects;
CREATE POLICY "Users can delete their own template files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);