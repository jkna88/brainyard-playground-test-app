// Shared helpers for shelling out to the Brainyard `by` CLI.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { BySessionRow } from '@/types/chat';
import { parseEdn } from '@/lib/edn';

const execFileAsync = promisify(execFile);

// Path to the Brainyard CLI. Override with BY_BIN when `by` isn't at the default
// location (e.g. a per-user install under ~/.local/bin).
export const BY_BIN = process.env.BY_BIN || '/usr/local/bin/by';

/**
 * Sessions with a live owner process (`by sessions list --live --json`) — the
 * only ones reachable over an ask.sock (session-channel-extensions.md §2).
 */
export async function listLiveSessions(): Promise<BySessionRow[]> {
  const { stdout } = await execFileAsync(
    BY_BIN,
    ['sessions', 'list', '--live', '--json'],
    { timeout: 10000, encoding: 'utf-8' },
  );
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? (parsed as BySessionRow[]) : [];
}

/**
 * Resolve a session's bound ask.sock path authoritatively from the live list.
 * Returns null when the session isn't live or never bound a socket. Clients must
 * use this recorded path, never reconstruct it (the path may live in $TMPDIR).
 */
export async function resolveAskSocketPath(sessionId: string): Promise<string | null> {
  const session = (await listLiveSessions()).find((s) => s['session-id'] === sessionId);
  const path = session?.['ask-socket-path'];
  return typeof path === 'string' && path.length > 0 ? path : null;
}

/** Walk up from `start` looking for a `.git` marker; return that dir, else null. */
function findGitRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/**
 * Resolve a session's PROJECT directory — where its `.brainyard/sessions/<id>/`
 * (including trajectory.edn) lives. Mirrors brainyard's `resolve-project-dir`
 * (agent/core/config.clj): BY_PROJECT_DIR env → git root above the session's
 * working-dir → the working-dir itself. This is distinct from working-dir: a
 * session run from a subdirectory still stores its data at the repo root.
 * Returns null when the session isn't live / has no working-dir.
 */
export async function resolveSessionProjectDir(sessionId: string): Promise<string | null> {
  const session = (await listLiveSessions()).find((s) => s['session-id'] === sessionId);
  const workingDir = session?.['working-dir'];
  if (typeof workingDir !== 'string' || workingDir.length === 0) return null;
  return process.env.BY_PROJECT_DIR || findGitRoot(workingDir) || workingDir;
}

/**
 * Resolve the session's memory `user-id` — the partition key for its memory DB
 * (`<memory-base>/<user-id>.db`). It's persisted in the session's meta.edn
 * (written by the persist bridge; see resolve-user-id). Returns null when the
 * session dir or the key can't be read.
 */
export async function resolveSessionUserId(sessionId: string): Promise<string | null> {
  const projectDir = (await resolveSessionProjectDir(sessionId)) ?? process.cwd();
  const metaFile = path.join(projectDir, '.brainyard', 'sessions', sessionId, 'meta.edn');
  try {
    const parsed = parseEdn(await readFile(metaFile, 'utf-8'));
    const userId = (parsed as Record<string, unknown>)?.['user-id'];
    return typeof userId === 'string' && userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
}
