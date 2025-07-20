-- Create storage bucket for templates if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hh_templates', 'hh_templates', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for templates bucket
CREATE POLICY "Users can view their own template files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own template files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own template files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own template files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update existing hh_pdf_library bucket policies to ensure they exist
CREATE POLICY IF NOT EXISTS "Users can view their own pdf files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can upload their own pdf files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can update their own pdf files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can delete their own pdf files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);