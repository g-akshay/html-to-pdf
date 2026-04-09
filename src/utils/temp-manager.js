import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const activeTempDirs = new Set();

export function createTempDir(prefix = 'html-convert') {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  activeTempDirs.add(dir);
  return dir;
}

export function cleanupTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
    activeTempDirs.delete(dir);
  } catch {}
}

function cleanupAll() {
  for (const dir of activeTempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  activeTempDirs.clear();
}

process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(0); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(0); });
