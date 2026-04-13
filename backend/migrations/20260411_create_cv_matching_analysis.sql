-- Migration: Persist matching analysis results by CV submission

CREATE TABLE IF NOT EXISTS cv_matching_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL REFERENCES "user"(auth_id) ON DELETE CASCADE,
  metier_id TEXT,
  analysis_fingerprint TEXT NOT NULL,
  model_name TEXT,
  match_threshold DOUBLE PRECISION,
  analysis_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cv_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_cv_matching_analysis_auth_id ON cv_matching_analysis(auth_id);
CREATE INDEX IF NOT EXISTS idx_cv_matching_analysis_fingerprint ON cv_matching_analysis(analysis_fingerprint);

ALTER TABLE cv_matching_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own matching analysis" ON cv_matching_analysis;
CREATE POLICY "Users manage own matching analysis" ON cv_matching_analysis
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());
