const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found in backend folder');
    process.exit(1);
  }
  const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1]] = m[2];
    return acc;
  }, {});

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const row = {
    NOM: 'Test User',
    EMAIL: 'test.user+cp@example.com',
    PROMOTION: new Date().toISOString(),
    'STATUT INVITATION': 'Invité',
    'RÉPONSE': 'Répondu',
    ACTIONS: 'Voir',
  };

  const { data, error } = await supabase.from('ancien_etudiant').insert([row]);
  if (error) {
    console.error('Insert error:', error.message || error);
    process.exit(1);
  }
  console.log('Inserted row:', data);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
