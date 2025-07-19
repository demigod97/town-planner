-- Create storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hh_pdf_library', 'hh_pdf_library', false);

-- Create hh_uploads table
CREATE TABLE public.hh_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hh_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own uploads" 
ON public.hh_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own uploads" 
ON public.hh_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads" 
ON public.hh_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create storage policies
CREATE POLICY "Users can view their own files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add trigger for updated_at
CREATE TRIGGER update_hh_uploads_updated_at
BEFORE UPDATE ON public.hh_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();