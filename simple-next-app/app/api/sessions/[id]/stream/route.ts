import { resolveAskSocketPath } from '@/lib/by';
import { subscribeOverSocket, type Subscription } from '@/lib/ask-socket';

// GET /api/sessions/<id>/stream — Server-Sent Events bridge over the session's
// ask.sock. Subscribes to lifecycle hooks and forwards a structured activity
// feed (the agent's reasoning + tool calls) so the browser shows what the agent
// is actually doing while a turn runs — far more useful than raw :display.

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    for (const val of Object.values(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) return val;
    }
  }
  return null;
}

function toActivity(frame: Record<string, unknown>): Record<string, unknown> | null {
  const payload = (frame.payload ?? {}) as Record<string, unknown>;
  switch (frame.event) {
    case 'agent.tool-use/pre': {
      const tool = String(payload['tool-name'] ?? 'tool');
      const args = payload.args as Record<string, unknown> | undefined;
      const detail = firstString(args?.command) ?? firstString(args) ?? '';
      return { type: 'tool', tool, detail: detail.slice(0, 240) };
    }
    case 'agent.iteration/post': {
      const reasoning = payload['last-reasoning'];
      if (typeof reasoning === 'string' && reasoning.trim()) {
        return { type: 'reasoning', text: reasoning.slice(0, 500), iteration: payload.iteration };
      }
      return null;
    }
    case 'agent.code-eval/pre':
      return { type: 'tool', tool: 'code', detail: '' };
    default:
      return null;
  }
}
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const socketPath = await resolveAskSocketPath(id);
  if (!socketPath) {
    return new Response('Session is not attachable', { status: 409 });
  }

  const encoder = new TextEncoder();
  let sub: Subscription | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const shutdown = () => {
        if (!open) return;
        open = false;
        sub?.close();
        try { controller.close(); } catch { /* already closed */ }
      };

      sub = subscribeOverSocket(
        socketPath!,
        ['agent.tool-use/pre', 'agent.iteration/post', 'agent.code-eval/pre'],
        (frame) => {
          const activity = toActivity(frame);
          if (activity) send(activity);
        },
        () => shutdown(),
      );

      // Tear down when the browser disconnects (EventSource closed / tab gone).
      request.signal.addEventListener('abort', shutdown);
    },
    cancel() {
      sub?.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
