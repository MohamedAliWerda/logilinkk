-- Migration: Persist confirmed AI recommendations and target impacted students

CREATE TABLE IF NOT EXISTS ai_confirmed_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  gap_label TEXT NOT NULL,
  gap_title TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('CRITIQUE', 'HAUTE', 'MOYENNE')),
  metier TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  concern_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  students_impacted INTEGER NOT NULL DEFAULT 0,
  total_students INTEGER NOT NULL DEFAULT 0,
  llm_recommendation TEXT NOT NULL DEFAULT '',
  cert_title TEXT NOT NULL,
  cert_description TEXT,
  cert_provider TEXT NOT NULL,
  cert_duration TEXT NOT NULL,
  cert_pricing TEXT NOT NULL,
  cert_url TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_confirmed_recommendation_targets (
  recommendation_id TEXT NOT NULL REFERENCES ai_confirmed_recommendations(recommendation_id) ON DELETE CASCADE,
  auth_id UUID NOT NULL REFERENCES "user"(auth_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recommendation_id, auth_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_confirmed_recommendations_level
  ON ai_confirmed_recommendations(level);

CREATE INDEX IF NOT EXISTS idx_ai_confirmed_targets_auth_id
  ON ai_confirmed_recommendation_targets(auth_id);

ALTER TABLE ai_confirmed_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_confirmed_recommendation_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view targeted confirmed recommendations" ON ai_confirmed_recommendations;
CREATE POLICY "Users can view targeted confirmed recommendations" ON ai_confirmed_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM ai_confirmed_recommendation_targets t
      WHERE t.recommendation_id = ai_confirmed_recommendations.recommendation_id
        AND t.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own recommendation targets" ON ai_confirmed_recommendation_targets;
CREATE POLICY "Users can view own recommendation targets" ON ai_confirmed_recommendation_targets
  FOR SELECT USING (auth_id = auth.uid());
