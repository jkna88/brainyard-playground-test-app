// Client for a session's per-session ask.sock (AF_UNIX, newline-delimited EDN).
// See brainyard docs/design/ask-attach-channel.md and session-channel-extensions.md.
//
// Mode A (request/response): connect, write one EDN frame, read one EDN frame,
// close. Used here for :ask, :status and :cancel. Streaming (:subscribe) is a
// separate concern (held-open connection) handled elsewhere.

import net from 'net';
import { parseEdn, escapeEdnString } from './edn';

/** Send one EDN request frame and resolve the single EDN reply frame. */
function rpc(socketPath: string, request: string, timeoutMs: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ path: socketPath });
    sock.setEncoding('utf8');
    let buf = '';
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      fn();
    };
    const fail = (err: Error) => finish(() => reject(err));
    const ok = (val: Record<string, unknown>) => finish(() => resolve(val));

    const timer = setTimeout(() => fail(new Error('ask.sock request timed out')), timeoutMs);

    sock.on('connect', () => sock.write(request + '\n'));
    sock.on('data', (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl === -1) return; // wait for the full line
      try {
        const parsed = parseEdn(buf.slice(0, nl));
        if (parsed && typeof parsed === 'object') ok(parsed as Record<string, unknown>);
        else fail(new Error('ask.sock returned a non-map reply'));
      } catch (e) {
        fail(e instanceof Error ? e : new Error('ask.sock parse error'));
      }
    });
    sock.on('error', (e: Error) => fail(e));
    sock.on('close', () => fail(new Error('ask.sock closed before replying')));
  });
}

export interface AskReply {
  status: string; // 'ok' | 'error'
  answer?: string;
  error?: string;
  provider?: string;
  model?: string;
  usage?: unknown;
}

export interface StatusReply {
  status: string;
  state?: string; // 'idle' | 'running'
  ['pending-turns']?: number;
  provider?: string;
  model?: string;
  agent?: string;
  error?: string;
}

/** Inject a question into the live session's turn queue and await its answer. */
export async function askOverSocket(
  socketPath: string,
  question: string,
  timeoutMs = 120000,
): Promise<AskReply> {
  const req = `{:op :ask :question "${escapeEdnString(question)}" :timeout-ms ${Math.round(timeoutMs)}}`;
  // Give the socket read a margin beyond the server-side turn cap.
  const reply = await rpc(socketPath, req, timeoutMs + 5000);
  return reply as unknown as AskReply;
}

/** Non-blocking snapshot of the live session (idle/running, provider/model, …). */
export async function statusOverSocket(socketPath: string, timeoutMs = 5000): Promise<StatusReply> {
  const reply = await rpc(socketPath, '{:op :status}', timeoutMs);
  return reply as unknown as StatusReply;
}

/** Cancel the session's running turn (wired to the same path as Ctrl-C). */
export async function cancelOverSocket(socketPath: string, timeoutMs = 5000): Promise<{ cancelled?: boolean }> {
  const reply = await rpc(socketPath, '{:op :cancel}', timeoutMs);
  return reply as { cancelled?: boolean };
}
