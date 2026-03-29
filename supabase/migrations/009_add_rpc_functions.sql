-- RPC: Expire processed jobs (seen/dismissed) older than N days
-- Protects jobs with active applications
CREATE OR REPLACE FUNCTION expire_processed_jobs(p_days integer)
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH to_expire AS (
    SELECT sj.job_listing_id
    FROM seen_jobs sj
    JOIN job_listings jl ON jl.id = sj.job_listing_id
    WHERE jl.is_active = true
      AND sj.seen_at < now() - (p_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM applications a
        WHERE a.job_listing_id = jl.id
          AND a.status IN ('saved', 'applying', 'applied', 'interview', 'offer')
      )
  )
  UPDATE job_listings
  SET is_active = false
  WHERE id IN (SELECT job_listing_id FROM to_expire);

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- RPC: Expire unseen jobs older than N days
-- Unseen = no entry in seen_jobs table
-- Protects jobs with active applications
CREATE OR REPLACE FUNCTION expire_unseen_jobs(p_days integer)
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE job_listings
  SET is_active = false
  WHERE is_active = true
    AND fetched_at < now() - (p_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM seen_jobs WHERE job_listing_id = job_listings.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM applications
      WHERE job_listing_id = job_listings.id
        AND status IN ('saved', 'applying', 'applied', 'interview', 'offer')
    );

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- RPC: Expire all jobs older than N days (absolute)
-- Protects jobs with active applications
CREATE OR REPLACE FUNCTION expire_absolute_jobs(p_days integer)
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE job_listings
  SET is_active = false
  WHERE is_active = true
    AND fetched_at < now() - (p_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM applications
      WHERE job_listing_id = job_listings.id
        AND status IN ('saved', 'applying', 'applied', 'interview', 'offer')
    );

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- RPC: Count unseen active jobs for a user
CREATE OR REPLACE FUNCTION count_unseen_jobs(p_user_id uuid)
RETURNS integer AS $$
  SELECT count(*)::integer
  FROM job_listings jl
  WHERE jl.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM seen_jobs sj
      WHERE sj.job_listing_id = jl.id
        AND sj.user_id = p_user_id
    );
$$ LANGUAGE sql STABLE;

-- RPC: Cleanup unscored jobs (deactivate active jobs with no match_score)
CREATE OR REPLACE FUNCTION cleanup_unscored_jobs()
RETURNS integer AS $$
DECLARE
  deactivated_count integer;
BEGIN
  UPDATE job_listings
  SET is_active = false
  WHERE is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM match_scores WHERE job_listing_id = job_listings.id
    );

  GET DIAGNOSTICS deactivated_count = ROW_COUNT;
  RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql;
