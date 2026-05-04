/**
 * Usage:
 *   ATS_TOKEN="<jwt>" node scripts/test-ats-score-source.js [payload.json] [baseUrl]
 *
 * Defaults:
 *   payload path: ./scripts/ats-payload.sample.json
 *   baseUrl: http://localhost:3000
 */

const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const payloadArg = process.argv[2] || './scripts/ats-payload.sample.json';
  const baseUrl = (process.argv[3] || process.env.ATS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const token = process.env.ATS_TOKEN || '';

  if (!token) {
    console.error('Missing ATS_TOKEN environment variable.');
    process.exit(1);
  }

  const payloadPath = path.resolve(process.cwd(), payloadArg);
  if (!fs.existsSync(payloadPath)) {
    console.error(`Payload file not found: ${payloadPath}`);
    process.exit(1);
  }

  const payloadRaw = fs.readFileSync(payloadPath, 'utf8');
  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (err) {
    console.error(`Invalid JSON in payload file: ${payloadPath}`);
    process.exit(1);
  }

  const url = `${baseUrl}/cv-submissions/ats-score`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log('HTTP:', res.status);

  if (!res.ok) {
    console.log('Response:', data);
    process.exit(1);
  }

  const source = data?.scoringSource || 'unknown';
  const model = data?.scoringModel || 'n/a';
  const atsScore = data?.atsScore;
  const matchScore = data?.matchScore;
  const successScore = data?.successScore;

  console.log('ATS source:', source);
  console.log('ATS model:', model);
  console.log('ATS score:', atsScore);
  console.log('Match score:', matchScore);
  console.log('Success score:', successScore);

  if (source === 'fallback') {
    console.log('Fallback reason marker:', String(data?.rawResponse || '').slice(0, 200));
  }
}

main().catch((err) => {
  console.error('Test failed:', err?.message || err);
  process.exit(1);
});
