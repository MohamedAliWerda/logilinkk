-- Migration: Persist AI recommendations for admin review workflow

CREATE TABLE IF NOT EXISTS cv_ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_key TEXT NOT NULL UNIQUE,
  rank_position INTEGER NOT NULL DEFAULT 0,
  competence_name TEXT NOT NULL,
  metier_name TEXT NOT NULL,
  domaine_name TEXT,
  competence_type TEXT,
  keywords TEXT,
  pct_gap DOUBLE PRECISION NOT NULL DEFAULT 0,
  n_gap INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'faible',
  recommended_certification TEXT,
  recommendation_text TEXT NOT NULL,
  rag_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_collection TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'deleted')),
  admin_note TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_cv_ai_recommendations_status
  ON cv_ai_recommendations(status);

CREATE INDEX IF NOT EXISTS idx_cv_ai_recommendations_rank
  ON cv_ai_recommendations(rank_position);

CREATE INDEX IF NOT EXISTS idx_cv_ai_recommendations_updated
  ON cv_ai_recommendations(updated_at DESC);
