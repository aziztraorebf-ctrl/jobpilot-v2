-- supabase/migrations/008_add_agent_columns.sql

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS agent_status TEXT
    CHECK (agent_status IN ('pending', 'ready', 'submitted', 'failed', 'needs_review'))
    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ats_type TEXT
    CHECK (ats_type IN ('linkedin', 'indeed', 'workday', 'greenhouse', 'lever', 'other'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_notes TEXT DEFAULT NULL;

-- Index pour que l'endpoint /ready soit rapide
CREATE INDEX IF NOT EXISTS idx_applications_agent_status
  ON applications (agent_status)
  WHERE agent_status = 'ready';

COMMENT ON COLUMN applications.agent_status IS 'Statut pour la boucle agent : pending | ready | submitted | failed | needs_review';
COMMENT ON COLUMN applications.ats_type IS 'Type de plateforme ATS détecté ou choisi manuellement';
COMMENT ON COLUMN applications.agent_notes IS 'Notes de l''agent après tentative de soumission';
