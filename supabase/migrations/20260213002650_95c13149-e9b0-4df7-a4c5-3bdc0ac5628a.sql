-- Add CHECK constraint to ensure data_json is always a valid JSON object
ALTER TABLE public.requests ADD CONSTRAINT check_data_json_structure 
CHECK (jsonb_typeof(data_json) = 'object');