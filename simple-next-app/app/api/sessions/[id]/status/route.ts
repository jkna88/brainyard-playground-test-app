import { NextResponse } from 'next/server';
import { resolveAskSocketPath } from '@/lib/by';
import { statusOverSocket } from '@/lib/ask-socket';

// GET /api/sessions/<id>/status — non-blocking {:op :status} snapshot of the
// live session (idle/running, provider, model, pending turns).
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const socketPath = await resolveAskSocketPath(id);
  if (!socketPath) {
    return NextResponse.json({ error: 'Session is not attachable' }, { status: 409 });
  }
  try {
    const status = await statusOverSocket(socketPath);
    return NextResponse.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ask.sock error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
