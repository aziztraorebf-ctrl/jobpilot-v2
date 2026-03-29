-- Compound index for the most common query pattern: active jobs sorted by recency
CREATE INDEX IF NOT EXISTS idx_job_listings_active_fetched
  ON job_listings(is_active, fetched_at DESC);

-- Index for seen_jobs filtering by dismissed status
CREATE INDEX IF NOT EXISTS idx_seen_jobs_user_dismissed
  ON seen_jobs(user_id, dismissed);

-- Index for application joins on job_listing_id (FK without index)
CREATE INDEX IF NOT EXISTS idx_applications_job_listing
  ON applications(job_listing_id);

-- Compound index for score lookups by user + job
CREATE INDEX IF NOT EXISTS idx_match_scores_user_job
  ON match_scores(user_id, job_listing_id);
