const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function readPortFromEnvFile() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return undefined;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^PORT\s*=\s*(.+)$/);
      if (!match) continue;
      const raw = match[1].trim().replace(/^['\"]|['\"]$/g, '');
      const parsed = Number(raw);
      if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
        return parsed;
      }
    }
  } catch {
    // Ignore env parsing issues and use fallback.
  }
  return undefined;
}

function resolvePort() {
  const fromArg = Number(process.argv[2]);
  if (Number.isInteger(fromArg) && fromArg > 0 && fromArg < 65536) {
    return fromArg;
  }

  const fromEnv = Number(process.env.PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0 && fromEnv < 65536) {
    return fromEnv;
  }

  const fromFile = readPortFromEnvFile();
  if (fromFile) return fromFile;

  return 3001;
}

function getListeningPidsWindows(port) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (!/LISTENING/i.test(line)) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;

      const localAddress = parts[1];
      const pid = Number(parts[4]);
      if (!Number.isInteger(pid) || pid <= 0) continue;
      if (!localAddress.endsWith(`:${port}`)) continue;

      pids.add(pid);
    }

    return [...pids];
  } catch {
    return [];
  }
}

function getListeningPidsPosix(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

function main() {
  const port = resolvePort();
  const pids = process.platform === 'win32'
    ? getListeningPidsWindows(port)
    : getListeningPidsPosix(port);

  if (pids.length === 0) {
    console.log(`[free-port] Port ${port} is already free.`);
    return;
  }

  const targetPids = pids.filter((pid) => pid !== process.pid);
  if (targetPids.length === 0) {
    console.log(`[free-port] No external process to stop on port ${port}.`);
    return;
  }

  console.log(`[free-port] Stopping process(es) on port ${port}: ${targetPids.join(', ')}`);
  for (const pid of targetPids) {
    const ok = killPid(pid);
    if (ok) {
      console.log(`[free-port] Stopped PID ${pid}`);
    } else {
      console.warn(`[free-port] Could not stop PID ${pid}`);
    }
  }
}

main();
