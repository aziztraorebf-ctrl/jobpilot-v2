-- Add 'jsearch' to job_listings.source CHECK constraint
ALTER TABLE public.job_listings DROP CONSTRAINT IF EXISTS job_listings_source_check;
ALTER TABLE public.job_listings ADD CONSTRAINT job_listings_source_check
  CHECK (source IN ('jooble', 'adzuna', 'jsearch', 'manual'));

-- Add 'jsearch' to api_usage.api_name CHECK constraint
ALTER TABLE public.api_usage DROP CONSTRAINT IF EXISTS api_usage_api_name_check;
ALTER TABLE public.api_usage ADD CONSTRAINT api_usage_api_name_check
  CHECK (api_name IN ('openai', 'jooble', 'adzuna', 'jsearch'));
