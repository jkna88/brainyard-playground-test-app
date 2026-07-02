import { NextResponse } from 'next/server';
import { resolveSessionUserId } from '@/lib/by';
import { getMemoryStatus } from '@/lib/memory';

// GET /api/sessions/<id>/memory — session-scoped + user-level memory status,
// read directly from the user's memory SQLite DB (read-only).
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Path/SQL-injection guard: session ids are opaque slugs. The id flows into a
  // filesystem path AND an interpolated SQL literal, so reject anything but the
  // slug alphabet before use.
  if (!/^[\w.-]+$/.test(id) || id.includes('..')) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const userId = await resolveSessionUserId(id);
  if (!userId) {
    return NextResponse.json({ error: 'Could not resolve the session user-id' }, { status: 404 });
  }

  try {
    const status = await getMemoryStatus(userId, id);
    return NextResponse.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
