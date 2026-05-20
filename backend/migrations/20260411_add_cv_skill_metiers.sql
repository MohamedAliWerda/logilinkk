-- Migration: Persist selected metier and hard-skill to metier mapping

ALTER TABLE cv_submissions
  ADD COLUMN IF NOT EXISTS metier_id TEXT;

CREATE TABLE IF NOT EXISTS cv_skill_metiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_skill_id UUID NOT NULL REFERENCES cv_skills(id) ON DELETE CASCADE,
  metier_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cv_skill_id, metier_id)
);

CREATE INDEX IF NOT EXISTS idx_cv_skill_metiers_skill_id ON cv_skill_metiers(cv_skill_id);
CREATE INDEX IF NOT EXISTS idx_cv_skill_metiers_metier_id ON cv_skill_metiers(metier_id);

ALTER TABLE cv_skill_metiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own skill metiers" ON cv_skill_metiers;
CREATE POLICY "Users manage own skill metiers" ON cv_skill_metiers
  USING (
    cv_skill_id IN (
      SELECT s.id
      FROM cv_skills s
      JOIN cv_submissions c ON c.id = s.cv_submission_id
      WHERE c.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    cv_skill_id IN (
      SELECT s.id
      FROM cv_skills s
      JOIN cv_submissions c ON c.id = s.cv_submission_id
      WHERE c.auth_id = auth.uid()
    )
  );
