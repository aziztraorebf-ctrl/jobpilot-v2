-- Add 'firecrawl' to job_listings.source CHECK constraint
ALTER TABLE public.job_listings DROP CONSTRAINT IF EXISTS job_listings_source_check;
ALTER TABLE public.job_listings ADD CONSTRAINT job_listings_source_check
  CHECK (source IN ('jooble', 'adzuna', 'jsearch', 'firecrawl', 'manual'));
