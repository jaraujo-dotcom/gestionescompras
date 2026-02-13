-- Add validation_json column to form_fields for storing validation rules per field type
ALTER TABLE public.form_fields 
ADD COLUMN validation_json jsonb DEFAULT NULL;

COMMENT ON COLUMN public.form_fields.validation_json IS 'Stores type-specific validation config: {minLength, maxLength, pattern} for text, {min, max} for number, {minDate, maxDate} for date';