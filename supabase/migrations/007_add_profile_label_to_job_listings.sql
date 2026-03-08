ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS profile_label text;

COMMENT ON COLUMN job_listings.profile_label IS
  'Label du profil de rotation qui a fetché ce job (ex: "Sécurité", "Coordination"). NULL pour les jobs fetchés avant cette migration.';
