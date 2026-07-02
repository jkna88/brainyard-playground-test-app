// Read-only status reader for a session's brainyard memory (SQLite).
//
// Memory is partitioned one DB per user-id at <memory-base>/<user-id>.db (see
// memory/core/manager: db-path = <base>/<user-id>.db). Each DB holds an
// `episodes` table (session_id, role, keep/archived/tombstoned flags), a
// `semantic_facts` table, and `memory_metadata` (schema_version, …). Episodes
// are tagged with the `agt-…` session-id, so session-scoped memory is just a
// filter on episodes.session_id.
//
// We shell out to the `sqlite3` CLI (read-only, JSON output) — consistent with
// how this app already reaches `by`/`tmux`, and safe against the agent's
// concurrent WAL writes.

import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import { existsSync } from 'fs';
import type { MemoryStatus, MemoryEpisode, MemoryTurn, MemoryFact, MemoryNode, MemoryEdge } from '@/types/chat';

const execFileAsync = promisify(execFile);

/** Base dir holding per-user memory DBs. Mirrors the memory manager default. */
function memoryBasePath(): string {
  return process.env.BY_MEMORY_BASE_PATH || path.join(os.homedir(), '.brainyard', 'memory');
}

export function memoryDbPath(userId: string): string {
  return path.join(memoryBasePath(), `${userId}.db`);
}

/**
 * Run one read-only query and return parsed rows (sqlite3 -json emits [] as '').
 *
 * Opens via the `immutable=1` URI rather than `-readonly`: the memory DB is in
 * WAL mode and owned by the live agent, and a plain read-only WAL open still
 * needs to map the `-shm` sidecar read-write — which fails (SQLITE_CANTOPEN)
 * when this server can't write under ~/.brainyard. `immutable` reads only the
 * main DB file with no locking/shm, so it never touches the writer's sidecars.
 * Tradeoff: changes still sitting in an un-checkpointed WAL aren't reflected —
 * acceptable for a status snapshot (the memory writer checkpoints routinely).
 */
async function query(dbPath: string, sql: string): Promise<Record<string, unknown>[]> {
  const uri = `file:${encodeURI(dbPath)}?immutable=1`;
  const { stdout } = await execFileAsync('sqlite3', ['-json', uri, sql], {
    timeout: 10000,
    encoding: 'utf-8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as Record<string, unknown>[];
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

/** Parse the `tags` JSON column into a string[]; tolerate null/garbage. */
function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Derive a normalized kind + short display label from an episode's tags. */
function classify(tags: string[]): { kind: string | null; label: string | null } {
  const find = (p: string) => tags.find((t) => t.startsWith(p))?.slice(p.length) || null;
  const rawKind = find('kind:'); // user-message | assistant-answer | tool-result | …
  const role = find('role:');
  const tool = find('tool:');
  const kind = rawKind
    ? rawKind.replace(/-message$/, '').replace(/-answer$/, '').replace(/-result$/, '')
    : role;
  const label = tool || role || kind;
  return { kind, label };
}

/**
 * Partition a session's episodes (ordered oldest→newest) into per-turn groups.
 * Each `event:ask-pre` episode (the user's message) opens a new turn; everything
 * up to the next ask-pre belongs to it. Episodes before the first ask-pre (rare)
 * seed an initial question-less turn.
 */
function partitionTurns(rows: Record<string, unknown>[]): MemoryTurn[] {
  const turns: MemoryTurn[] = [];
  let cur: MemoryTurn | null = null;
  for (const r of rows) {
    const tags = parseTags(r.tags);
    const { kind, label } = classify(tags);
    const content = typeof r.content === 'string' ? r.content : '';
    const timestamp = typeof r.timestamp === 'string' ? r.timestamp : null;
    const isAskPre = tags.includes('event:ask-pre');
    if (isAskPre || !cur) {
      cur = { index: turns.length + 1, question: isAskPre ? content : null, episodes: [] };
      turns.push(cur);
    }
    const episode: MemoryEpisode = { kind, label, content, timestamp };
    cur.episodes.push(episode);
  }
  return turns;
}

/**
 * Read session-scoped and user-level memory status for `userId`'s DB. `sessionId`
 * must already be validated (opaque slug) — it is interpolated into SQL, so the
 * caller guarantees it contains no quotes/separators.
 */
export async function getMemoryStatus(userId: string, sessionId: string): Promise<MemoryStatus> {
  const dbPath = memoryDbPath(userId);
  if (!existsSync(dbPath)) {
    return { userId, dbPath, exists: false };
  }

  const [userRows, sessionRows, episodeRows, factRows, nodeRows, edgeRows] = await Promise.all([
    query(
      dbPath,
      `select
         (select count(*) from episodes where tombstoned_flag=0) as episodes_active,
         (select count(*) from episodes where archived_flag=1) as episodes_archived,
         (select count(*) from episodes where tombstoned_flag=1) as episodes_tombstoned,
         (select count(*) from semantic_facts where tombstoned_flag=0) as facts,
         (select count(distinct session_id) from episodes) as sessions,
         (select count(*) from graph_nodes) as nodes,
         (select count(*) from graph_edges where t_invalid is null) as edges,
         (select value from memory_metadata where key='schema_version') as schema_version`,
    ),
    query(
      dbPath,
      `select
         count(*) as total,
         sum(case when tombstoned_flag=0 then 1 else 0 end) as active,
         sum(case when keep_flag=1 then 1 else 0 end) as kept,
         sum(case when archived_flag=1 then 1 else 0 end) as archived
       from episodes where session_id='${sessionId}'`,
    ),
    query(
      dbPath,
      `select substr(content,1,200) as content, tags, timestamp
       from episodes
       where session_id='${sessionId}' and tombstoned_flag=0
       order by id asc`,
    ),
    query(
      dbPath,
      `select fact_type, substr(content,1,280) as content, confidence, tags
       from semantic_facts
       where tombstoned_flag=0
       order by keep_flag desc, updated_at desc
       limit 200`,
    ),
    query(
      dbPath,
      `select node_type, name, substr(summary,1,200) as summary
       from graph_nodes
       order by updated_at desc
       limit 200`,
    ),
    query(
      dbPath,
      `select e.relation, sn.name as src, dn.name as dst, substr(e.fact,1,200) as fact, e.confidence
       from graph_edges e
       join graph_nodes sn on sn.id = e.src_id
       join graph_nodes dn on dn.id = e.dst_id
       where e.t_invalid is null
       order by e.ingested_at desc
       limit 200`,
    ),
  ]);

  const u = userRows[0] ?? {};
  const s = sessionRows[0] ?? {};

  return {
    userId,
    dbPath,
    exists: true,
    user: {
      episodesActive: num(u.episodes_active),
      episodesArchived: num(u.episodes_archived),
      episodesTombstoned: num(u.episodes_tombstoned),
      facts: num(u.facts),
      sessions: num(u.sessions),
      nodes: num(u.nodes),
      edges: num(u.edges),
      schemaVersion: typeof u.schema_version === 'string' ? u.schema_version : null,
    },
    session: {
      total: num(s.total),
      active: num(s.active),
      kept: num(s.kept),
      archived: num(s.archived),
    },
    turns: partitionTurns(episodeRows),
    facts: factRows.map((r): MemoryFact => ({
      factType: typeof r.fact_type === 'string' ? r.fact_type : null,
      content: typeof r.content === 'string' ? r.content : '',
      confidence: r.confidence == null ? null : num(r.confidence),
      tags: parseTags(r.tags),
    })),
    nodes: nodeRows.map((r): MemoryNode => ({
      nodeType: typeof r.node_type === 'string' ? r.node_type : null,
      name: typeof r.name === 'string' ? r.name : '',
      summary: typeof r.summary === 'string' ? r.summary : null,
    })),
    edges: edgeRows.map((r): MemoryEdge => ({
      relation: typeof r.relation === 'string' ? r.relation : '',
      src: typeof r.src === 'string' ? r.src : null,
      dst: typeof r.dst === 'string' ? r.dst : null,
      fact: typeof r.fact === 'string' ? r.fact : null,
      confidence: r.confidence == null ? null : num(r.confidence),
    })),
  };
}
