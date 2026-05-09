-- Fix the etudiant_post table constraint to allow multiple posts per company per student
-- The current constraint only allows one post per (societe, etudiant)
-- We need to allow multiple posts, so the unique constraint should be on (id_societe, id_etudiant, id_post)

-- First, drop the incorrect constraint if it exists
ALTER TABLE "etudiant_post" DROP CONSTRAINT IF EXISTS "etudiant_post_id_societe_key" CASCADE;

-- Create a proper unique constraint on the triple combination
-- This ensures each student can only apply once to each post per company
CREATE UNIQUE INDEX IF NOT EXISTS ux_etudiant_post_triple 
ON "etudiant_post"(id_societe, id_etudiant, id_post);
