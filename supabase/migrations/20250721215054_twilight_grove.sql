/*
  # Create triggers for automatic timestamp updates

  1. Triggers
    - Add triggers for all tables with updated_at columns
    - Automatically update timestamps on row modifications
    - Ensure data consistency and audit trails

  2. Tables with Triggers
    - user_profiles
    - hh_chat_sessions  
    - hh_uploads
    - hh_templates
*/

-- Add triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hh_uploads_updated_at ON public.hh_uploads;
CREATE TRIGGER update_hh_uploads_updated_at
BEFORE UPDATE ON public.hh_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hh_chat_sessions_updated_at ON public.hh_chat_sessions;
CREATE TRIGGER update_hh_chat_sessions_updated_at
BEFORE UPDATE ON public.hh_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hh_templates_updated_at ON public.hh_templates;
CREATE TRIGGER update_hh_templates_updated_at
BEFORE UPDATE ON public.hh_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();