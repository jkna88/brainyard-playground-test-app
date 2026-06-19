import { NextResponse } from 'next/server';
import { resolveAskSocketPath } from '@/lib/by';
import { injectOverSocket, type InjectInput } from '@/lib/ask-socket';

// POST /api/sessions/<id>/inject — push data into the session ({:op :inject}).
// Body: { as: 'memory'|'artifact'|'turn', ... } (see InjectInput).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = validateInject(body);
  if (!input) {
    return NextResponse.json({ error: 'Invalid inject payload' }, { status: 400 });
  }

  const socketPath = await resolveAskSocketPath(id);
  if (!socketPath) {
    return NextResponse.json({ error: 'Session is not attachable' }, { status: 409 });
  }

  try {
    const reply = await injectOverSocket(socketPath, input);
    if (reply.status !== 'ok') {
      return NextResponse.json({ error: reply.error || 'Inject failed' }, { status: 502 });
    }
    return NextResponse.json(reply);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ask.sock error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function validateInject(body: Record<string, unknown>): InjectInput | null {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  switch (body.as) {
    case 'memory': {
      const slug = str(body.slug);
      const content = str(body.content);
      return slug && content ? { as: 'memory', slug, content } : null;
    }
    case 'artifact': {
      const name = str(body.name);
      const content = str(body.content);
      return name && content ? { as: 'artifact', name, content, pin: !!body.pin } : null;
    }
    case 'turn': {
      const text = str(body.text);
      return text ? { as: 'turn', text, await: !!body.await } : null;
    }
    default:
      return null;
  }
}
