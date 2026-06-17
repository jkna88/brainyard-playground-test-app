import { NextRequest, NextResponse } from 'next/server';
import { execFile, ExecFileException } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

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

    const { stdout, stderr } = await execFileAsync(
      '/usr/local/bin/by',
      ['ask', '-p', 'free-llm', '-m', 'auto', '--', message.trim()],
      { timeout: 130000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const elapsed = Date.now() - startTime;
    console.log(`Chat API: by ask completed in ${elapsed}ms`);

    if (!stdout?.trim()) {
      return NextResponse.json(
        { error: 'AI returned an empty response' },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer: stdout.trim() });
  } catch (err: unknown) {
    const error = err as ExecFileException & { stderr?: string; killed?: boolean; signal?: string };
    
    // Timeout detection
    if (error.killed || error.signal === 'SIGTERM') {
      console.error('Chat API: by ask timed out');
      return NextResponse.json(
        { error: 'The AI took too long to respond. Please try a simpler question.' },
        { status: 504 }
      );
    }

    const errorMessage = error.stderr || error.message || 'Unknown error occurred';
    console.error('Chat API error:', errorMessage);

    // Return structured error
    return NextResponse.json(
      { error: errorMessage },
      { status: error.code === 'ENOENT' ? 503 : 500 }
    );
  }
}
