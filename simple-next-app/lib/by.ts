// Shared helpers for shelling out to the Brainyard `by` CLI.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { BySessionRow } from '@/types/chat';

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
