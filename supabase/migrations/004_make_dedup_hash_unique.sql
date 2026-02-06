-- Add UNIQUE constraint on dedup_hash for proper upsert conflict resolution.
-- The old non-unique index idx_jobs_dedup is now redundant but kept for
-- backward compatibility (DROP it manually if desired).
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_listings_dedup_hash
  ON public.job_listings(dedup_hash);
