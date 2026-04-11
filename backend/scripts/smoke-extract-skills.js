const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

(async () => {
  try {
    const root = process.cwd();
    const backendDir = path.join(root, 'backend');
    const env = {
      ...parseEnvFile(path.join(backendDir, '.env')),
      ...process.env,
    };

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
    const jwtSecret = env.JWT_SECRET;

    if (!supabaseUrl || !supabaseKey || !jwtSecret) {
      throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) / JWT_SECRET');
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: users, error: usersErr } = await sb
      .from('user')
      .select('id,auth_id,cin_passport')
      .not('auth_id', 'is', null)
      .limit(100);

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) throw new Error('No users with auth_id found');

    let candidate = null;
    for (const u of users) {
      const { count, error: cntErr } = await sb
        .from('note')
        .select('student_id', { count: 'exact', head: true })
        .eq('student_id', u.id);
      if (cntErr) throw cntErr;
      if ((count || 0) > 0) {
        candidate = u;
        break;
      }
    }

    if (!candidate) {
      throw new Error('No user with auth_id and notes found');
    }

    const token = jwt.sign(
      {
        sub: String(candidate.auth_id),
        cin_passport: String(candidate.cin_passport ?? ''),
        role: 'etudiant',
      },
      jwtSecret,
      { expiresIn: '10m' },
    );

    const res = await fetch('http://127.0.0.1:3000/cv-submissions/extract-skills', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    const data = json?.data ?? json;

    const hardCount = Array.isArray(data?.hardSkills) ? data.hardSkills.length : 0;
    const softCount = Array.isArray(data?.softSkills) ? data.softSkills.length : 0;

    console.log('HTTP status:', res.status);
    console.log('found:', !!data?.found, '| hardSkills:', hardCount, '| softSkills:', softCount);

    if (hardCount > 0) {
      console.log('hard sample:', data.hardSkills.slice(0, 3));
    }
    if (softCount > 0) {
      console.log('soft sample:', data.softSkills.slice(0, 3));
    }
  } catch (err) {
    console.error('Smoke test failed:', err?.message || err);
    process.exitCode = 1;
  }
})();
