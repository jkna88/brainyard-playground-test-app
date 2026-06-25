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
  timeoutMs = 300000,
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

export type InjectInput =
  | { as: 'memory'; slug: string; content: string }
  | { as: 'artifact'; name: string; content: string; pin?: boolean }
  | { as: 'turn'; text: string; await?: boolean };

export interface InjectReply {
  status: string;
  injected?: string;
  slug?: string;
  path?: string;
  id?: string;
  name?: string;
  queued?: boolean;
  error?: string;
}

/**
 * Push data into the session via {:op :inject}. Sinks (session-channel-extensions.md §4):
 *  - memory:   write a project memory slug (seen by recall).
 *  - artifact: keep a named live artifact fresh (the data connector; seen next turn).
 *  - turn:     enqueue a turn; await:false is a fire-and-forget event trigger.
 */
export async function injectOverSocket(
  socketPath: string,
  input: InjectInput,
  timeoutMs = 15000,
): Promise<InjectReply> {
  let request: string;
  if (input.as === 'memory') {
    request = `{:op :inject :as :memory :slug "${escapeEdnString(input.slug)}" :content "${escapeEdnString(input.content)}"}`;
  } else if (input.as === 'artifact') {
    request = `{:op :inject :as :artifact :name "${escapeEdnString(input.name)}" :content "${escapeEdnString(input.content)}" :pin? ${input.pin ? 'true' : 'false'}}`;
  } else {
    request = `{:op :inject :as :turn :text "${escapeEdnString(input.text)}" :await? ${input.await ? 'true' : 'false'}}`;
  }
  const reply = await rpc(socketPath, request, timeoutMs);
  return reply as unknown as InjectReply;
}

export interface Subscription {
  close(): void;
}

/**
 * Mode B: open a held-open subscription for the given events and invoke `onFrame`
 * for every event frame (the initial `{:status :ok :subscribed …}` ack is
 * skipped). The connection stays open until `close()` or the server EOFs.
 */
export function subscribeOverSocket(
  socketPath: string,
  events: string[],
  onFrame: (frame: Record<string, unknown>) => void,
  onClose?: (err?: Error) => void,
): Subscription {
  const sock = net.createConnection({ path: socketPath });
  sock.setEncoding('utf8');
  let buf = '';
  let closed = false;
  const finish = (err?: Error) => {
    if (closed) return;
    closed = true;
    onClose?.(err);
  };

  sock.on('connect', () => {
    const eventList = events.map((e) => `:${e}`).join(' ');
    sock.write(`{:op :subscribe :events [${eventList}]}\n`);
  });
  sock.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      try {
        const frame = parseEdn(line);
        if (frame && typeof frame === 'object' && 'event' in (frame as object)) {
          onFrame(frame as Record<string, unknown>);
        }
      } catch {
        // skip an unparseable frame rather than tearing down the stream
      }
    }
  });
  sock.on('error', (e: Error) => finish(e));
  sock.on('close', () => finish());

  return { close: () => sock.destroy() };
}
