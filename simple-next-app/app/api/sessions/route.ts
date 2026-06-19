import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { BySessionRow } from '@/types/chat';

const execFileAsync = promisify(execFile);

// Path to the Brainyard CLI. Override with BY_BIN when `by` isn't at the default
// location (e.g. a per-user install under ~/.local/bin).
const BY_BIN = process.env.BY_BIN || '/usr/local/bin/by';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Single-quote for safe interpolation into the `sh -c` string tmux runs.
const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function parseSessions(stdout: string): BySessionRow[] {
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? (parsed as BySessionRow[]) : [];
}

// `--live` restricts the list to sessions with a live owner process — the only
// ones `by ask --attach` can reach (session-channel-extensions.md §2.1/§2.2).
async function listLiveSessions(): Promise<BySessionRow[]> {
  const { stdout } = await execFileAsync(
    BY_BIN,
    ['sessions', 'list', '--live', '--json'],
    { timeout: 10000, encoding: 'utf-8' }
  );
  return parseSessions(stdout);
}

// Trim long fields for transport; the spread preserves `live?` / `ops` so the
// client can tell which sessions are attachable (see session-channel-extensions.md §2).
function truncateSessions(sessions: BySessionRow[]): BySessionRow[] {
  const MAX_ANSWER_LEN = 300;
  const MAX_LABEL_LEN = 80;
  return sessions.map((s) => {
    const answer = s['last-answer'];
    const firstInput = s['first-user-input'];
    return {
      ...s,
      'last-answer': answer && answer.length > MAX_ANSWER_LEN
        ? answer.slice(0, MAX_ANSWER_LEN) + '...'
        : answer,
      'first-user-input': firstInput && firstInput.length > MAX_LABEL_LEN
        ? firstInput.slice(0, MAX_LABEL_LEN)
        : firstInput,
    };
  });
}

export async function GET() {
  try {
    const sessions = await listLiveSessions();
    return NextResponse.json({ sessions: truncateSessions(sessions) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to list sessions:', message);
    return NextResponse.json(
      { error: 'Failed to list sessions', sessions: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();
    const label = (title || 'New chat session').trim();

    // A session needs a live OWNER process to be attachable. `by run` is that
    // owner — an interactive TUI that blocks for its whole lifetime, so we can't
    // await it. tmux supplies the PTY it needs and daemonizes it: `new-session -d`
    // returns immediately while `by run` keeps running as the session owner.
    const before = new Set((await listLiveSessions()).map((s) => s['session-id']));

    const cwd = process.cwd();
    const tmuxName = `by-chat-${Date.now()}`;
    const ownerCmd = `${shq(BY_BIN)} run --agent coact-agent --working-dir ${shq(cwd)}`;
    await execFileAsync(
      'tmux',
      ['new-session', '-d', '-s', tmuxName, ownerCmd],
      { timeout: 10000, encoding: 'utf-8' }
    );

    // Wait for the owner to boot and register its session as live.
    const deadline = Date.now() + 20000;
    let created: BySessionRow | undefined;
    while (Date.now() < deadline) {
      await delay(400);
      created = (await listLiveSessions()).find((s) => !before.has(s['session-id']));
      if (created) break;
    }
    if (!created) {
      // Owner failed to come online — don't leak the tmux session.
      await execFileAsync('tmux', ['kill-session', '-t', tmuxName], { timeout: 5000 }).catch(() => {});
      throw new Error('Session owner did not come online in time');
    }

    // Cosmetic: label the new session with the requested title.
    await execFileAsync(
      BY_BIN,
      ['sessions', 'label', '-s', created['session-id'], label],
      { timeout: 10000, encoding: 'utf-8' }
    ).catch(() => {});

    const sessions = await listLiveSessions();
    return NextResponse.json({ sessions: truncateSessions(sessions) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to create session:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
