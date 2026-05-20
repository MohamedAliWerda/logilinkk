-- Add unique indexes to prevent duplicate Societe by key identity fields
-- Note: run this migration after reviewing existing duplicates.

BEGIN;

-- Unique case-insensitive email
CREATE UNIQUE INDEX IF NOT EXISTS ux_societe_email_lower ON "Societe" (LOWER(email));

-- Unique telephone digits only (use expression index to normalize digits)
CREATE UNIQUE INDEX IF NOT EXISTS ux_societe_telephone_digits ON "Societe" ((regexp_replace(telephone, '\\D', '', 'g')));

-- Unique company name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS ux_societe_denomination_lower ON "Societe" (LOWER(denomination_sociale));

COMMIT;
