import { NextRequest, NextResponse } from 'next/server';
import { execFile, ExecFileException } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Path to the Brainyard CLI. Override with BY_BIN when `by` isn't at the default
// location (e.g. a per-user install under ~/.local/bin).
const BY_BIN = process.env.BY_BIN || '/usr/local/bin/by';

export async function POST(request: NextRequest) {
  try {
    const { message, attach, sessionId } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.trim().length > 4000) {
      return NextResponse.json(
        { error: 'Message too long (max 4000 characters)' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Build exec args based on attach flag. `--json` makes `by ask` emit a single
    // machine-readable object on stdout ({success, answer, error, …}); the human
    // "LM configured" banner goes to stderr, so stdout stays clean to parse.
    let args: string[];
    if (attach && sessionId) {
      // Attach to session context
      args = ['ask', '--attach', sessionId, '--json', '--', message.trim()];
    } else {
      // Free prompt with model
      args = ['ask', '-p', 'free-llm', '-m', 'auto', '--json', '--', message.trim()];
    }

    const { stdout } = await execFileAsync(
      BY_BIN,
      args,
      { timeout: 130000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const elapsed = Date.now() - startTime;
    console.log(`Chat API: by ask completed in ${elapsed}ms (attach=${!!attach})`);

    if (!stdout?.trim()) {
      return NextResponse.json(
        { error: 'AI returned an empty response' },
        { status: 502 }
      );
    }

    let result: { success?: boolean; answer?: string; error?: string };
    try {
      result = JSON.parse(stdout);
    } catch {
      console.error('Chat API: failed to parse by ask JSON:', stdout.slice(0, 500));
      return NextResponse.json(
        { error: 'AI returned a malformed response' },
        { status: 502 }
      );
    }

    // `by` reports hard failures as success:false; an agent that stops mid-run
    // reports success:true with the stop notice as its answer. Treat both as errors.
    const answer = result.answer?.trim();
    if (result.success === false || (answer && answer.startsWith('Agent stopped:'))) {
      return NextResponse.json(
        { error: result.error || answer || 'The AI agent failed to produce a response' },
        { status: 502 }
      );
    }

    if (!answer) {
      return NextResponse.json(
        { error: 'AI returned an empty response' },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const error = err as ExecFileException & { stderr?: string; killed?: boolean; signal?: string };
    
    if (error.killed || error.signal === 'SIGTERM') {
      console.error('Chat API: by ask timed out');
      return NextResponse.json(
        { error: 'The AI took too long to respond. Please try a simpler question.' },
        { status: 504 }
      );
    }

    const errorMessage = error.stderr || error.message || 'Unknown error occurred';
    console.error('Chat API error:', errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: error.code === 'ENOENT' ? 503 : 500 }
    );
  }
}
