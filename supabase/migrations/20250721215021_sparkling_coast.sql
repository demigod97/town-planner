/*
  # Create update_updated_at_column function

  1. Functions
    - `update_updated_at_column()` - Trigger function to automatically update updated_at timestamps
  
  2. Purpose
    - Provides automatic timestamp updates for tables with updated_at columns
    - Used by triggers on various tables to maintain data consistency
*/

-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;