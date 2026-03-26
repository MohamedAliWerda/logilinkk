-- Migration: CV persistence layer for Angular/Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add this before creating cv_submissions if not already done
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE "user" ADD CONSTRAINT user_auth_id_unique UNIQUE (auth_id);

-- Main CV document, one per user
CREATE TABLE IF NOT EXISTS cv_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL REFERENCES "user"(auth_id) ON DELETE CASCADE,
  professional_title TEXT,
  specialization TEXT,
  objectif TEXT,
  permis TEXT,
  linkedin TEXT,
  date_naissance DATE,
  photo_url TEXT,
  ats_score INT DEFAULT 0,
  consent_given BOOLEAN DEFAULT false,
  consent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (auth_id)
);

-- Child tables
CREATE TABLE IF NOT EXISTS cv_formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  diplome TEXT,
  institution TEXT,
  date_debut DATE,
  date_fin DATE,
  moyenne TEXT,
  modules TEXT,
  pfe_titre TEXT,
  pfe_entreprise TEXT,
  pfe_technologies TEXT
);

CREATE TABLE IF NOT EXISTS cv_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  poste TEXT,
  entreprise TEXT,
  secteur TEXT,
  date_debut DATE,
  date_fin DATE,
  lieu TEXT,
  description TEXT,
  mots_cles TEXT
);

CREATE TABLE IF NOT EXISTS cv_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  category TEXT CHECK (category IN ('hard','soft')),
  skill_type TEXT,
  nom TEXT,
  niveau TEXT,
  contexte TEXT
);

CREATE TABLE IF NOT EXISTS cv_langues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  langue TEXT,
  niveau_cecrl TEXT,
  certification TEXT,
  score TEXT
);

CREATE TABLE IF NOT EXISTS cv_projets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  titre TEXT,
  description TEXT,
  technologies TEXT,
  lien TEXT
);

CREATE TABLE IF NOT EXISTS cv_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  titre TEXT,
  organisme TEXT,
  date_obtenue DATE,
  verification TEXT
);

CREATE TABLE IF NOT EXISTS cv_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_submission_id UUID NOT NULL REFERENCES cv_submissions(id) ON DELETE CASCADE,
  sort_order INT,
  type TEXT,
  role TEXT,
  date_debut DATE,
  date_fin DATE
);

-- RLS policies
ALTER TABLE cv_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own CV submissions" ON cv_submissions
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Child table RLS
ALTER TABLE cv_formations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own formations" ON cv_formations
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));

ALTER TABLE cv_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own experiences" ON cv_experiences
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));

ALTER TABLE cv_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own skills" ON cv_skills
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));

ALTER TABLE cv_langues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own langues" ON cv_langues
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));

ALTER TABLE cv_projets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projets" ON cv_projets
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));

ALTER TABLE cv_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own certifications" ON cv_certifications
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));

ALTER TABLE cv_engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own engagements" ON cv_engagements
  USING (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()))
  WITH CHECK (cv_submission_id IN (SELECT id FROM cv_submissions WHERE auth_id = auth.uid()));
