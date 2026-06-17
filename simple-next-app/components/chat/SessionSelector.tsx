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
  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className={`flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 ${className || ''}`}>
      <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading sessions…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{error}</span>
          </div>
        ) : (
          <select
            className={`w-full bg-transparent border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 appearance-none cursor-pointer transition-colors ${
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
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title.length > 48 ? s.title.slice(0, 48) + '…' : s.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onCreate}
          disabled={loading}
          className="shrink-0 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
          title="New session"
        >
          + New
        </button>
        {activeId && sessions.length > 1 && (
          <button
            onClick={() => onDelete(activeId)}
            className="shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
