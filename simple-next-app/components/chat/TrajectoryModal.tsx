'use client';

import { useEffect, useState } from 'react';
import { TrajectoryTurn } from '@/types/chat';

interface TrajectoryModalProps {
  turn: TrajectoryTurn | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-medium">{label}</span>
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 break-words">{value}</span>
    </div>
  );
}

function fmtDuration(ms?: number): string {
  if (typeof ms !== 'number') return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function fmtCost(cost?: number): string {
  if (typeof cost !== 'number') return '—';
  return `$${cost.toFixed(4)}`;
}

function fmtNum(n?: number): string {
  return typeof n === 'number' ? n.toLocaleString() : '—';
}

export default function TrajectoryModal({ turn, loading, error, onClose }: TrajectoryModalProps) {
  const [showRaw, setShowRaw] = useState(false);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usage = turn?.usage ?? {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Turn trajectory"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-700/60 shadow-2xl shadow-zinc-900/20 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Turn trajectory{typeof turn?.turn === 'number' ? ` · #${turn.turn}` : ''}
            </h3>
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
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce mr-3" style={{ animationDelay: '300ms' }} />
              Loading trajectory…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : !turn ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No trajectory data found for this turn.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Status pill */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    turn.success
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${turn.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {turn.success ? 'Success' : 'Failed'}
                </span>
                {turn['terminated-by'] && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-300">
                    {turn['terminated-by']}
                  </span>
                )}
              </div>

              {/* Core stats */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Stat label="Model" value={<span className="font-mono">{turn.model ?? '—'}</span>} />
                <Stat label="Cost" value={fmtCost(turn.cost)} />
                <Stat label="Duration" value={fmtDuration(turn['duration-ms'])} />
                <Stat label="Iterations" value={fmtNum(turn['total-iterations'])} />
                <Stat
                  label="Timestamp"
                  value={typeof turn.ts === 'number' ? new Date(turn.ts).toLocaleString() : '—'}
                />
                <Stat label="Agent" value={<span className="font-mono text-xs">{turn.agent ?? '—'}</span>} />
              </div>

              {/* Token usage */}
              <div>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-medium">
                  Token usage
                </span>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {[
                    { k: 'Input', v: usage.in },
                    { k: 'Output', v: usage.out },
                    { k: 'Cache R', v: usage['cache-read'] },
                    { k: 'Cache W', v: usage['cache-write'] },
                  ].map(({ k, v }) => (
                    <div
                      key={k}
                      className="rounded-lg bg-zinc-100/70 dark:bg-zinc-800/60 px-2 py-1.5 text-center"
                    >
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{k}</div>
                      <div className="text-sm font-mono font-medium text-zinc-800 dark:text-zinc-100">{fmtNum(v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question */}
              {turn.question && (
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-medium">
                    Question
                  </span>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-words line-clamp-4">
                    {turn.question}
                  </p>
                </div>
              )}

              {/* Raw EDN/JSON toggle */}
              <div className="pt-1">
                <button
                  onClick={() => setShowRaw((v) => !v)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showRaw ? 'Hide raw data' : 'Show raw data'}
                </button>
                {showRaw && (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-900/90 dark:bg-black/60 p-3 text-[11px] leading-relaxed text-zinc-100 font-mono">
                    {JSON.stringify(turn, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
