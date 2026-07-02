'use client';

import { useEffect, useState } from 'react';
import { MemoryStatus, MemoryTurn } from '@/types/chat';

interface MemoryModalProps {
  status: MemoryStatus | null;
  /** The turn whose per-turn episodes are shown in the THIS TURN section. */
  turn: MemoryTurn | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function StatCard({
  label,
  value,
  accent,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const base = `rounded-lg px-3 py-2 text-center transition-colors ${
    active ? 'bg-violet-500/15 ring-1 ring-violet-500/40' : 'bg-zinc-100/70 dark:bg-zinc-800/60'
  }`;
  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1">
        {label}
        {onClick && (
          <svg className={`w-3 h-3 transition-transform ${active ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      <div className={`text-lg font-semibold ${accent ?? 'text-zinc-800 dark:text-zinc-100'}`}>{value}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} w-full cursor-pointer hover:bg-violet-500/10`} aria-expanded={active}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

export default function MemoryModal({ status, turn, loading, error, onClose }: MemoryModalProps) {
  const [expanded, setExpanded] = useState<'facts' | 'nodes' | 'edges' | null>(null);
  const toggle = (key: 'facts' | 'nodes' | 'edges') => setExpanded((cur) => (cur === key ? null : key));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Memory status"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-700/60 shadow-2xl shadow-zinc-900/20 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-500 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3M4 7c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3" />
            </svg>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Memory status</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce mr-3" style={{ animationDelay: '300ms' }} />
              Loading memory…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : !status ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No memory data.</p>
          ) : !status.exists ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">No memory database yet for this user.</p>
              <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500 break-all">{status.dbPath}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Identity */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 dark:text-zinc-500">user</span>
                <span className="font-mono font-medium text-zinc-700 dark:text-zinc-200">{status.userId}</span>
              </div>

              {/* Per-turn episodes */}
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    This turn
                  </h4>
                  {turn && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      #{turn.index} · {turn.episodes.length} {turn.episodes.length === 1 ? 'episode' : 'episodes'}
                    </span>
                  )}
                </div>
                {turn && turn.episodes.length > 0 ? (
                  <ul className="space-y-1.5">
                    {turn.episodes.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px]">
                        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-medium">
                          {e.label || e.kind || 'episode'}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 line-clamp-2">{e.content}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">No episodes captured for this turn yet.</p>
                )}
              </section>

              {/* Session-related memory (statistics only) */}
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    This session
                  </h4>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Total" value={status.session?.total ?? 0} />
                  <StatCard label="Active" value={status.session?.active ?? 0} accent="text-emerald-600 dark:text-emerald-400" />
                  <StatCard label="Kept" value={status.session?.kept ?? 0} accent="text-amber-600 dark:text-amber-400" />
                  <StatCard label="Archived" value={status.session?.archived ?? 0} />
                </div>
              </section>

              {/* User-level memory */}
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    User-level
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Episodes" value={(status.user?.episodesActive ?? 0).toLocaleString()} />
                  <StatCard
                    label="Facts"
                    value={(status.user?.facts ?? 0).toLocaleString()}
                    accent="text-violet-600 dark:text-violet-400"
                    onClick={status.facts && status.facts.length > 0 ? () => toggle('facts') : undefined}
                    active={expanded === 'facts'}
                  />
                  <StatCard label="Sessions" value={(status.user?.sessions ?? 0).toLocaleString()} />
                  <StatCard
                    label="Nodes"
                    value={(status.user?.nodes ?? 0).toLocaleString()}
                    accent="text-fuchsia-600 dark:text-fuchsia-400"
                    onClick={status.nodes && status.nodes.length > 0 ? () => toggle('nodes') : undefined}
                    active={expanded === 'nodes'}
                  />
                  <StatCard
                    label="Edges"
                    value={(status.user?.edges ?? 0).toLocaleString()}
                    accent="text-rose-600 dark:text-rose-400"
                    onClick={status.edges && status.edges.length > 0 ? () => toggle('edges') : undefined}
                    active={expanded === 'edges'}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {status.user?.schemaVersion && <span>schema v{status.user.schemaVersion}</span>}
                  {!!status.user?.episodesArchived && <span>{status.user.episodesArchived.toLocaleString()} archived</span>}
                  {!!status.user?.episodesTombstoned && <span>{status.user.episodesTombstoned.toLocaleString()} tombstoned</span>}
                </div>

                {/* Facts list — revealed by clicking the Facts stat above. */}
                {expanded === 'facts' && status.facts && (
                  <ul className="mt-3 space-y-2">
                    {status.facts.map((f, i) => (
                      <li key={i} className="rounded-lg bg-zinc-100/60 dark:bg-zinc-800/50 px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium">
                            {f.factType || 'fact'}
                          </span>
                          {typeof f.confidence === 'number' && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              {Math.round(f.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-zinc-700 dark:text-zinc-200 leading-snug break-words">{f.content}</p>
                        {f.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {f.tags.slice(0, 6).map((t, j) => (
                              <span key={j} className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">#{t}</span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Graph nodes — revealed by clicking the Nodes stat above. */}
                {expanded === 'nodes' && status.nodes && (
                  <ul className="mt-3 space-y-1.5">
                    {status.nodes.map((n, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px]">
                        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 text-[10px] font-medium">
                          {n.nodeType || 'node'}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100 font-mono">{n.name}</span>
                          {n.summary && <span className="text-zinc-500 dark:text-zinc-400"> — {n.summary}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Graph edges — revealed by clicking the Edges stat above. */}
                {expanded === 'edges' && status.edges && (
                  <ul className="mt-3 space-y-1.5">
                    {status.edges.map((e, i) => (
                      <li key={i} className="text-[12px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-medium text-zinc-800 dark:text-zinc-100">{e.src ?? '?'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-medium">
                            {e.relation}
                          </span>
                          <span className="font-mono font-medium text-zinc-800 dark:text-zinc-100">{e.dst ?? '?'}</span>
                        </div>
                        {e.fact && <p className="text-zinc-500 dark:text-zinc-400 leading-snug break-words">{e.fact}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600 break-all">{status.dbPath}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
