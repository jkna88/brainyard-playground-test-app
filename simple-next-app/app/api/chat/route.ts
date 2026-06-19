import { NextRequest, NextResponse } from 'next/server';
import { execFile, ExecFileException } from 'child_process';
import { promisify } from 'util';
import { BY_BIN, resolveAskSocketPath } from '@/lib/by';
import { askOverSocket } from '@/lib/ask-socket';

const execFileAsync = promisify(execFile);

const TURN_TIMEOUT_MS = 120000;

export async function POST(request: NextRequest) {
  const { message, attach, sessionId } = await request.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (message.trim().length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 characters)' }, { status: 400 });
  }
  const question = message.trim();

  // Attach path: inject the question into the live session directly over its
  // ask.sock (no `by` subprocess). The socket path is resolved authoritatively
  // from the live session list — we never trust a client-supplied path.
  if (attach && sessionId) {
    const socketPath = await resolveAskSocketPath(sessionId);
    if (!socketPath) {
      return NextResponse.json(
        { error: 'Session is not attachable — no live ask socket. Send without Attach, or recreate the session.' },
        { status: 409 },
      );
    }

    const startTime = Date.now();
    let reply;
    try {
      reply = await askOverSocket(socketPath, question, TURN_TIMEOUT_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ask.sock error';
      console.error('Chat API: ask.sock error:', msg);
      const timedOut = /timed out/i.test(msg);
      return NextResponse.json(
        { error: timedOut ? 'The AI took too long to respond. Please try a simpler question.' : msg },
        { status: timedOut ? 504 : 502 },
      );
    }
    console.log(`Chat API: ask.sock completed in ${Date.now() - startTime}ms`);

    const answer = reply.answer?.trim();
    if (reply.status !== 'ok' || (answer && answer.startsWith('Agent stopped:'))) {
      return NextResponse.json(
        { error: reply.error || answer || 'The AI agent failed to produce a response' },
        { status: 502 },
      );
    }
    if (!answer) {
      return NextResponse.json({ error: 'AI returned an empty response' }, { status: 502 });
    }
    return NextResponse.json({ answer, provider: reply.provider, model: reply.model });
  }

  // Free-prompt path: one-shot throwaway agent via the CLI. `--json` keeps stdout
  // a clean object ({success, answer, error}); the banner goes to stderr.
  try {
    const startTime = Date.now();
    const { stdout } = await execFileAsync(
      BY_BIN,
      ['ask', '-p', 'free-llm', '-m', 'auto', '--json', '--', question],
      { timeout: 130000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    );
    console.log(`Chat API: by ask completed in ${Date.now() - startTime}ms (free prompt)`);

    if (!stdout?.trim()) {
      return NextResponse.json({ error: 'AI returned an empty response' }, { status: 502 });
    }

    let result: { success?: boolean; answer?: string; error?: string };
    try {
      result = JSON.parse(stdout);
    } catch {
      console.error('Chat API: failed to parse by ask JSON:', stdout.slice(0, 500));
      return NextResponse.json({ error: 'AI returned a malformed response' }, { status: 502 });
    }

    const answer = result.answer?.trim();
    if (result.success === false || (answer && answer.startsWith('Agent stopped:'))) {
      return NextResponse.json(
        { error: result.error || answer || 'The AI agent failed to produce a response' },
        { status: 502 },
      );
    }
    if (!answer) {
      return NextResponse.json({ error: 'AI returned an empty response' }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const error = err as ExecFileException & { stderr?: string; killed?: boolean; signal?: string };

    if (error.killed || error.signal === 'SIGTERM') {
      console.error('Chat API: by ask timed out');
      return NextResponse.json(
        { error: 'The AI took too long to respond. Please try a simpler question.' },
        { status: 504 },
      );
    }

    const errorMessage = error.stderr || error.message || 'Unknown error occurred';
    console.error('Chat API error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: error.code === 'ENOENT' ? 503 : 500 },
    );
  }
}
