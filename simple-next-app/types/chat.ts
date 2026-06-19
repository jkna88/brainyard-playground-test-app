export interface Session {
  id: string;
  title: string;
  createdAt: number;
  lastActivity: number;
  /** Session has a live owner process (PID-checked) — required for `by ask --attach`. */
  live?: boolean;
  /** Capability set advertised by the session's ask.sock (e.g. ['ask','status']). */
  ops?: string[];
}

/**
 * Raw row shape from `by sessions list --json` (Brainyard CLI). Keys mirror the
 * `enriched-summaries` descriptor documented in session-channel-extensions.md §2.1.
 */
export interface BySessionRow {
  'session-id': string;
  label?: string;
  'first-user-input'?: string;
  'last-answer'?: string;
  'started-at'?: number;
  'last-attached-at'?: number;
  /** Live ⇔ ask-socket exists and owner PID is alive (§2.1). */
  'live?'?: boolean;
  'owner-pid'?: number;
  'ask-socket-path'?: string;
  ops?: string[];
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
}

export interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  loading: boolean;
  error: string | null;
}

export type ChatAction =
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SET_SESSION_ERROR'; error: string | null }
  | { type: 'CREATE_SESSION'; title: string }
  | { type: 'DELETE_SESSION'; id: string }
  | { type: 'SWITCH_SESSION'; id: string }
  | { type: 'SEND_MESSAGE'; content: string }
  | { type: 'RECEIVE_REPLY'; sessionId: string; content: string }
  | { type: 'RECEIVE_ERROR'; sessionId: string; error: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null };
