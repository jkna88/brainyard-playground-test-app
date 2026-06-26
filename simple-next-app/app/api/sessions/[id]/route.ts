import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { listLiveSessions, BY_BIN } from '@/lib/by';

const execFileAsync = promisify(execFile);

// Trim long fields for transport (mirrors the sibling in sessions/route.ts).
function truncateSessions(sessions: Record<string, unknown>[]): Record<string, unknown>[] {
  const MAX_ANSWER_LEN = 300;
  const MAX_LABEL_LEN = 80;
  return sessions.map((s) => {
    const answer = s['last-answer'];
    const firstInput = s['first-user-input'];
    return {
      ...s,
      'last-answer': answer && typeof answer === 'string' && answer.length > MAX_ANSWER_LEN
        ? answer.slice(0, MAX_ANSWER_LEN) + '...'
        : answer,
      'first-user-input': firstInput && typeof firstInput === 'string' && firstInput.length > MAX_LABEL_LEN
        ? firstInput.slice(0, MAX_LABEL_LEN)
        : firstInput,
    };
  });
}

// DELETE /api/sessions/<id> — kill the tmux window and prune the session data.
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;

    // Find the session to get its owner PID
    const sessions = await listLiveSessions();
    const session = sessions.find((s) => s['session-id'] === id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const cwd = process.cwd();
    const ownerPid = session['owner-pid'];

    // Kill the tmux window whose pane PID matches the owner process.
    // The window was created as `new-window -t brainyard -n by-chat-<ts> "by run …"`
    // so #{pane_pid} is the PID of the `by` process itself.
    if (ownerPid) {
      try {
        const { stdout: panes } = await execFileAsync(
          'tmux',
          ['list-panes', '-s', '-t', 'brainyard', '-F', '#{pane_pid} #{window_name}'],
          { timeout: 5000, encoding: 'utf-8' },
        );
        const targetWindow = panes
          .split('\n')
          .map((l: string) => l.trim())
          .find((l: string) => l.startsWith(String(ownerPid) + ' '))
          ?.split(' ')
          .slice(1)
          .join(' ');

        if (targetWindow) {
          await execFileAsync('tmux', ['kill-window', '-t', `brainyard:${targetWindow}`], {
            timeout: 5000,
          }).catch(() => {});
        }
      } catch (tmuxErr) {
        console.warn(
          'tmux cleanup non-fatal:',
          tmuxErr instanceof Error ? tmuxErr.message : String(tmuxErr),
        );
      }
    }

    // Prune the persisted session data
    try {
      await execFileAsync(
        BY_BIN,
        ['sessions', 'prune', '--session-id', id, '-C', cwd],
        { timeout: 10000, encoding: 'utf-8' },
      );
    } catch (pruneErr) {
      console.warn(
        'Session prune non-fatal:',
        pruneErr instanceof Error ? pruneErr.message : String(pruneErr),
      );
    }

    // Return updated sessions list
    const updatedSessions = await listLiveSessions();
    return NextResponse.json({ sessions: truncateSessions(updatedSessions) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to delete session:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
