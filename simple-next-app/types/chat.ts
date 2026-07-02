export interface Session {
  id: string;
  title: string;
  createdAt: number;
  lastActivity: number;
  /** Session has a live owner process (PID-checked) — required for `by ask --attach`. */
  live?: boolean;
  /** Capability set advertised by the session's ask.sock (e.g. ['ask','status']). */
  ops?: string[];
  /**
   * Path to the bound ask.sock. Present only when the owner successfully bound
   * the listener — this is the authoritative "attachable" signal for
   * `by ask --attach`. Null/absent means attach will fail.
   */
  askSocketPath?: string | null;
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

/**
 * One turn's entry from a session's trajectory.edn (parsed via lib/edn). Keys
 * mirror the EDN map the `by` owner writes per turn; ':'-keywords become bare
 * string keys, so `:usage`→`usage`, `:terminated-by`→`terminated-by`, etc.
 */
export interface TrajectoryTurn {
  turn?: number;
  question?: string;
  answer?: string;
  model?: string;
  agent?: string;
  'duration-ms'?: number;
  ts?: number;
  cost?: number;
  success?: boolean;
  'terminated-by'?: string;
  'total-iterations'?: number;
  iterations?: unknown[];
  usage?: {
    in?: number;
    out?: number;
    'cache-read'?: number;
    'cache-write'?: number;
  };
  [key: string]: unknown;
}

/** One captured memory episode (a row of the `episodes` table). */
export interface MemoryEpisode {
  /** Normalized kind from tags: user | assistant | tool | reasoning | … */
  kind: string | null;
  /** Short display label (tool name / role / kind). */
  label: string | null;
  content: string;
  timestamp: string | null;
}

/** One semantic fact (a row of the `semantic_facts` table). */
export interface MemoryFact {
  factType: string | null;
  content: string;
  confidence: number | null;
  tags: string[];
}

/** One knowledge-graph node (a row of the `graph_nodes` table). */
export interface MemoryNode {
  nodeType: string | null;
  name: string;
  summary: string | null;
}

/** One knowledge-graph edge (a row of the `graph_edges` table), with node names. */
export interface MemoryEdge {
  relation: string;
  src: string | null;
  dst: string | null;
  fact: string | null;
  confidence: number | null;
}

/** Episodes captured during a single turn, delimited by the `ask-pre` event. */
export interface MemoryTurn {
  /** 1-based turn ordinal within the session (order episodes were captured). */
  index: number;
  /** The user's question for this turn (content of the ask-pre episode). */
  question: string | null;
  episodes: MemoryEpisode[];
}

/** Read-only snapshot of a session's brainyard memory (see lib/memory). */
export interface MemoryStatus {
  /** Memory partition key (the session's user-id); DB is <base>/<userId>.db. */
  userId: string;
  dbPath: string;
  /** False when no memory DB exists yet for this user. */
  exists: boolean;
  user?: {
    episodesActive: number;
    episodesArchived: number;
    episodesTombstoned: number;
    facts: number;
    sessions: number;
    nodes: number;
    edges: number;
    schemaVersion: string | null;
  };
  session?: {
    total: number;
    active: number;
    kept: number;
    archived: number;
  };
  /** Per-turn episode groups for this session, oldest turn first. */
  turns?: MemoryTurn[];
  /** Active user-level semantic facts (kept ones first). Capped for transport. */
  facts?: MemoryFact[];
  /** User-level knowledge-graph nodes. Capped for transport. */
  nodes?: MemoryNode[];
  /** Active user-level knowledge-graph edges. Capped for transport. */
  edges?: MemoryEdge[];
}

/** A live activity item streamed from the session's lifecycle hooks during a turn. */
export type ActivityItem =
  | { type: 'reasoning'; text: string; iteration?: number }
  | { type: 'tool'; tool: string; detail?: string };

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
