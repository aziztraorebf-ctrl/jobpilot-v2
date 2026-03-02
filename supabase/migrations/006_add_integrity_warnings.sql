-- ============================================
-- Add integrity_warnings column to cover_letters
-- Stores AI-detected hallucination/integrity warnings
-- ============================================

ALTER TABLE public.cover_letters
    ADD COLUMN integrity_warnings TEXT[] DEFAULT '{}';
