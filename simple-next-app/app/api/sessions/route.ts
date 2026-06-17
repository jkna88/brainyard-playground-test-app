import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function truncateSessions(sessions: any[]): any[] {
  const MAX_ANSWER_LEN = 300;
  const MAX_LABEL_LEN = 80;
  return (Array.isArray(sessions) ? sessions : []).map((s: any) => ({
    ...s,
    'last-answer': s['last-answer']?.length > MAX_ANSWER_LEN
      ? s['last-answer'].slice(0, MAX_ANSWER_LEN) + '...'
      : s['last-answer'],
    'first-user-input': s['first-user-input']?.length > MAX_LABEL_LEN
      ? s['first-user-input'].slice(0, MAX_LABEL_LEN)
      : s['first-user-input'],
  }));
}

export async function GET() {
  try {
    const { stdout } = await execFileAsync(
      '/usr/local/bin/by',
      ['sessions', 'list', '--json'],
      { timeout: 10000, encoding: 'utf-8' }
    );
    const sessions = JSON.parse(stdout);
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
    const prompt = (title || 'New chat session').trim();

    // Create a new by session by asking a one-shot question
    await execFileAsync(
      '/usr/local/bin/by',
      ['ask', '--agent', 'coact-agent', '--', prompt],
      { timeout: 30000, encoding: 'utf-8' }
    );

    // Re-fetch the sessions list
    const { stdout } = await execFileAsync(
      '/usr/local/bin/by',
      ['sessions', 'list', '--json'],
      { timeout: 10000, encoding: 'utf-8' }
    );
    const sessions = JSON.parse(stdout);
    return NextResponse.json({ sessions: truncateSessions(sessions) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to create session:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
