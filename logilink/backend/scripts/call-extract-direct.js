const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

(async () => {
  const env = { ...parseEnvFile(path.join(process.cwd(), 'backend', '.env')), ...process.env };
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET missing');
  const token = jwt.sign(
    { sub: '00000000-0000-0000-0000-000000000001', cin_passport: '', role: 'etudiant' },
    env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  const res = await fetch('http://127.0.0.1:3000/cv-submissions/extract-skills', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  console.log('HTTP status:', res.status);
  console.log('Body:', text);
})();
