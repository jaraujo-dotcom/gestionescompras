
ALTER TABLE public.requests
  ADD COLUMN fields_snapshot_json jsonb,
  ADD COLUMN sections_snapshot_json jsonb;
