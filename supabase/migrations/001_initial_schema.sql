-- ============================================
-- JobPilot - Initial Database Schema
-- Run in Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- Profiles (single user, no Supabase Auth)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    preferred_language TEXT DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en')),
    search_preferences JSONB DEFAULT '{}'::jsonb,
    openai_tokens_used INTEGER DEFAULT 0,
    openai_tokens_limit INTEGER DEFAULT 500000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default single user (run once after migration)
INSERT INTO public.profiles (full_name, email) VALUES ('Aziz', '');

-- ============================================
-- Resumes
-- ============================================
CREATE TABLE public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
    raw_text TEXT,
    parsed_data JSONB,
    is_primary BOOLEAN DEFAULT false,
    ai_tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_one_primary_cv ON public.resumes(user_id) WHERE is_primary = true;

-- ============================================
-- Job Listings
-- ============================================
CREATE TABLE public.job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('jooble', 'adzuna', 'manual')),
    source_id TEXT,
    source_url TEXT NOT NULL,
    dedup_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    company_name TEXT,
    location TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    description TEXT,
    salary_min NUMERIC,
    salary_max NUMERIC,
    salary_currency TEXT DEFAULT 'CAD',
    salary_is_predicted BOOLEAN DEFAULT false,
    job_type TEXT,
    category TEXT,
    contract_type TEXT,
    remote_type TEXT DEFAULT 'unknown' CHECK (remote_type IN ('onsite', 'hybrid', 'remote', 'unknown')),
    posted_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,
    company_career_url TEXT,
    company_description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_dedup ON public.job_listings(dedup_hash);
CREATE INDEX idx_jobs_source ON public.job_listings(source, source_id);
CREATE INDEX idx_jobs_fetched ON public.job_listings(fetched_at DESC);

-- ============================================
-- Seen Jobs
-- ============================================
CREATE TABLE public.seen_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ DEFAULT NOW(),
    dismissed BOOLEAN DEFAULT false,
    UNIQUE(user_id, job_listing_id)
);

-- ============================================
-- Match Scores
-- ============================================
CREATE TABLE public.match_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    skill_match_score INTEGER CHECK (skill_match_score BETWEEN 0 AND 100),
    experience_match_score INTEGER CHECK (experience_match_score BETWEEN 0 AND 100),
    education_match_score INTEGER CHECK (education_match_score BETWEEN 0 AND 100),
    explanation TEXT NOT NULL,
    matching_skills TEXT[],
    missing_skills TEXT[],
    strengths TEXT[],
    concerns TEXT[],
    model_used TEXT DEFAULT 'gpt-4o-mini',
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_listing_id, resume_id)
);

-- ============================================
-- Applications
-- ============================================
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN (
        'saved', 'applying', 'applied', 'interview',
        'offer', 'accepted', 'rejected', 'withdrawn'
    )),
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    interview_at TIMESTAMPTZ,
    offer_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    resume_id UUID REFERENCES public.resumes(id),
    cover_letter_id UUID,
    application_method TEXT,
    application_url TEXT,
    recruiter_name TEXT,
    recruiter_email TEXT,
    recruiter_phone TEXT,
    recruiter_linkedin TEXT,
    notes TEXT,
    salary_offered NUMERIC,
    priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_user_status ON public.applications(user_id, status);

-- ============================================
-- Cover Letters
-- ============================================
CREATE TABLE public.cover_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
    tone TEXT DEFAULT 'professional' CHECK (tone IN (
        'professional', 'enthusiastic', 'creative', 'formal'
    )),
    version INTEGER DEFAULT 1,
    is_edited BOOLEAN DEFAULT false,
    model_used TEXT DEFAULT 'gpt-4o-mini',
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.applications
    ADD CONSTRAINT fk_cover_letter
    FOREIGN KEY (cover_letter_id) REFERENCES public.cover_letters(id);

-- ============================================
-- Activity Log
-- ============================================
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'status_change', 'note_added', 'cover_letter_generated',
        'cv_optimized', 'interview_scheduled', 'follow_up_sent',
        'recruiter_contact_added', 'custom'
    )),
    event_data JSONB DEFAULT '{}'::jsonb,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_app ON public.activity_log(application_id, created_at DESC);

-- ============================================
-- API Usage Tracking
-- ============================================
CREATE TABLE public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    api_name TEXT NOT NULL CHECK (api_name IN ('openai', 'jooble', 'adzuna')),
    operation TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS: Disabled (single user app, auth via middleware)
-- ============================================
-- No RLS needed - the app is protected by a password middleware at the Next.js level.
-- All DB access goes through the service_role key server-side.

-- ============================================
-- Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER resumes_updated BEFORE UPDATE ON public.resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cover_letters_updated BEFORE UPDATE ON public.cover_letters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-log application status changes
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.activity_log (user_id, application_id, event_type, description, event_data)
        VALUES (
            NEW.user_id, NEW.id, 'status_change',
            format('Status: %s -> %s', OLD.status, NEW.status),
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER application_status_changed
    AFTER UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION log_application_status_change();
