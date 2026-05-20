// One-off script: import posts from CSV into Supabase
// Run from project root: node import-posts.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kayhpmwnerluxfuaalmg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtheWhwbXduZXJsdXhmdWFhbG1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzczNTkxMiwiZXhwIjoyMDg5MzExOTEyfQ.A5kQ2sDy5r-EMUSUllPr7OrcyTuz7Z3LXcRNs14I0qo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Simple CSV parser that handles quoted fields with commas
function parseCSV(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

async function main() {
  const csvPath = path.join(__dirname, 'post_avec_descriptions (1).csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  const header = rows[0]; // id_line, denomination_sociale, post, description
  const data = rows.slice(1);

  console.log(`Parsed ${data.length} rows from CSV`);

  // Fetch all Societes once
  const { data: societes, error: societeError } = await supabase
    .from('Societe')
    .select('id, denomination_sociale');

  if (societeError) {
    console.error('Failed to fetch Societes:', societeError.message);
    process.exit(1);
  }

  console.log(`Fetched ${societes.length} companies from Supabase`);

  // Build lookup map (case-insensitive)
  const societeMap = new Map();
  for (const s of societes) {
    societeMap.set(s.denomination_sociale.toLowerCase().trim(), s);
  }

  // List CSV company names that have no match
  const csvCompanies = [...new Set(data.map(r => r[1].trim()))];
  const notFound = csvCompanies.filter(name => !societeMap.has(name.toLowerCase()));
  if (notFound.length > 0) {
    console.warn('\nWARNING: These companies from the CSV have no match in Supabase:');
    notFound.forEach(n => console.warn(' -', n));
    console.warn('Posts for these companies will be skipped.\n');
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of data) {
    const [, denomination_sociale, titre_poste, description] = row;
    const name = denomination_sociale.trim();
    const societe = societeMap.get(name.toLowerCase());

    if (!societe) {
      skipped++;
      continue;
    }

    const payload = {
      id: societe.id,
      'Titre du poste': titre_poste.trim(),
      Exigences: description.trim(),
      'Sociéte': name,
      date_creation: new Date().toISOString(),
    };

    const { error } = await supabase.from('post').insert([payload]);

    if (error) {
      // Try alternate column names if schema differs
      const alt = {
        id: societe.id,
        titre_poste: titre_poste.trim(),
        exigences: description.trim(),
        societe: name,
        date_creation: new Date().toISOString(),
      };
      const { error: error2 } = await supabase.from('post').insert([alt]);
      if (error2) {
        console.error(`Failed to insert "${titre_poste}" for ${name}:`, error2.message);
        skipped++;
        continue;
      }
    }

    inserted++;
    console.log(`  ✓ [${societe.id}] ${name} — ${titre_poste}`);
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
