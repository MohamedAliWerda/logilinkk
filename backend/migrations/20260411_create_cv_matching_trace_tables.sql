-- Migration: Normalize matching analysis traceability for metier and competence rows

CREATE TABLE IF NOT EXISTS cv_matching_metier_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES cv_matching_analysis(id) ON DELETE CASCADE,
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL REFERENCES "user"(auth_id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL,
  metier_name TEXT NOT NULL,
  domaine_name TEXT,
  n_competences INTEGER NOT NULL DEFAULT 0,
  matched_competences INTEGER NOT NULL DEFAULT 0,
  coverage_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  top_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, metier_name)
);

CREATE INDEX IF NOT EXISTS idx_cv_matching_metier_scores_analysis_id
  ON cv_matching_metier_scores(analysis_id);
CREATE INDEX IF NOT EXISTS idx_cv_matching_metier_scores_auth_id
  ON cv_matching_metier_scores(auth_id);
CREATE INDEX IF NOT EXISTS idx_cv_matching_metier_scores_rank
  ON cv_matching_metier_scores(rank_position);

ALTER TABLE cv_matching_metier_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own matching metier scores" ON cv_matching_metier_scores;
CREATE POLICY "Users manage own matching metier scores" ON cv_matching_metier_scores
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE TABLE IF NOT EXISTS cv_matching_competence_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES cv_matching_analysis(id) ON DELETE CASCADE,
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL REFERENCES "user"(auth_id) ON DELETE CASCADE,
  metier_name TEXT NOT NULL,
  domaine_name TEXT,
  metier_rank INTEGER,
  is_top_metier BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('match', 'gap')),
  source_bucket TEXT NOT NULL DEFAULT 'analysis',
  competence_name TEXT NOT NULL,
  competence_type TEXT,
  keywords TEXT,
  best_cv_skill TEXT,
  best_cv_level TEXT,
  similarity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cv_matching_competence_results_analysis_id
  ON cv_matching_competence_results(analysis_id);
CREATE INDEX IF NOT EXISTS idx_cv_matching_competence_results_auth_id
  ON cv_matching_competence_results(auth_id);
CREATE INDEX IF NOT EXISTS idx_cv_matching_competence_results_status
  ON cv_matching_competence_results(status);
CREATE INDEX IF NOT EXISTS idx_cv_matching_competence_results_metier
  ON cv_matching_competence_results(metier_name);

ALTER TABLE cv_matching_competence_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own matching competence results" ON cv_matching_competence_results;
CREATE POLICY "Users manage own matching competence results" ON cv_matching_competence_results
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());
