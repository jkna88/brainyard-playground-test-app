'use client';

import { Session } from '@/types/chat';

interface SessionSelectorProps {
  sessions: Session[];
  activeId: string | null;
  onChange: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export default function SessionSelector({
  sessions,
  activeId,
  onChange,
  onCreate,
  onDelete,
  loading,
  error,
  className,
}: SessionSelectorProps) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 border-b border-zinc-200/70 dark:border-zinc-700/50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md ${className || ''}`}>
      <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center ring-1 ring-blue-500/20 dark:ring-blue-400/20 shadow-sm">
        <svg className="w-[18px] h-[18px] text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="flex items-center gap-2.5 px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-lg">
            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Loading sessions…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 rounded-lg border border-red-200/50 dark:border-red-800/30">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{error}</span>
          </div>
        ) : (
          <select
            className={`w-full bg-white/50 dark:bg-zinc-800/40 backdrop-blur-sm border border-zinc-300/60 dark:border-zinc-600/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/40 appearance-none cursor-pointer transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-500 ${
              sessions.length === 0 ? 'text-zinc-400' : ''
            }`}
            value={activeId ?? ''}
            onChange={(e) => onChange(e.target.value)}
          >
            {sessions.length === 0 && (
              <option value="" disabled>
                No sessions — create one
              </option>
            )}
            {sessions.map((s) => {
              const label = s.title.length > 48 ? s.title.slice(0, 48) + '…' : s.title;
              // ● marks a session with a live owner (attachable) — see by sessions list --live.
              return (
                <option key={s.id} value={s.id}>
                  {s.live ? `● ${label}` : `○ ${label}`}
                </option>
              );
            })}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onCreate}
          disabled={loading}
          className="shrink-0 px-3.5 py-2 text-sm bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white rounded-lg transition-all duration-200 disabled:cursor-not-allowed font-medium shadow-sm shadow-blue-600/15 hover:shadow-md hover:shadow-blue-600/25 active:scale-95"
          title="New session"
        >
          + New
        </button>
        {activeId && sessions.length > 1 && (
          <button
            onClick={() => onDelete(activeId)}
            className="shrink-0 p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            title="Delete this session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
