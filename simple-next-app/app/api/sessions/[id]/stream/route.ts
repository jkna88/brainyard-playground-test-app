import { resolveAskSocketPath } from '@/lib/by';
import { subscribeOverSocket, type Subscription } from '@/lib/ask-socket';
import { stripAnsi } from '@/lib/ansi';

// GET /api/sessions/<id>/stream — Server-Sent Events bridge over the session's
// ask.sock {:op :subscribe [:display]}. Each :display frame's rendered text
// (ANSI-stripped) is forwarded as an SSE `data:` line so the browser can show
// the agent working live while a turn runs.
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
        ['display'],
        (frame) => {
          const payload = frame.payload as { text?: unknown } | undefined;
          const text = stripAnsi(String(payload?.text ?? ''));
          if (text) send({ type: 'display', text });
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
