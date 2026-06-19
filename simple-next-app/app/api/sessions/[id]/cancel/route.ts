import { NextResponse } from 'next/server';
import { resolveAskSocketPath } from '@/lib/by';
import { cancelOverSocket } from '@/lib/ask-socket';

// POST /api/sessions/<id>/cancel — cancel the session's running turn
// ({:op :cancel}, the same path as Ctrl-C in the TUI).
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const socketPath = await resolveAskSocketPath(id);
  if (!socketPath) {
    return NextResponse.json({ error: 'Session is not attachable' }, { status: 409 });
  }
  try {
    const result = await cancelOverSocket(socketPath);
    return NextResponse.json({ cancelled: !!result.cancelled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ask.sock error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
