'use client';

import { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { chatReducer, getInitialState } from '@/lib/chat-store';
import { Session, BySessionRow } from '@/types/chat';
import SessionSelector from '@/components/chat/SessionSelector';
import ChatContainer from '@/components/chat/ChatContainer';
import ChatInput from '@/components/chat/ChatInput';

function mapSession(s: BySessionRow): Session {
  return {
    id: s['session-id'],
    title: s.label || s['first-user-input']?.slice(0, 50) || s['session-id'],
    createdAt: s['started-at'] || Date.now(),
    lastActivity: s['last-attached-at'] || Date.now(),
    live: s['live?'] ?? false,
    // Normalize Clojure keyword serialization (strip any leading ':').
    ops: Array.isArray(s.ops) ? s.ops.map((o) => String(o).replace(/^:/, '')) : undefined,
    askSocketPath: s['ask-socket-path'] ?? null,
  };
}

export default function ChatPage() {
  const [state, dispatch] = useReducer(chatReducer, undefined, getInitialState);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const [attach, setAttach] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<{ state?: string; model?: string; pendingTurns?: number } | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [attachSyncedFor, setAttachSyncedFor] = useState<string>('');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMessage(msg);
    setToastType(type);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    async function loadSessions() {
      setLoadingSessions(true);
      setSessionError(null);
      try {
        const res = await fetch('/api/sessions');
        const data: { sessions?: BySessionRow[]; error?: string } = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (data.sessions && data.sessions.length > 0) {
          dispatch({ type: 'SET_SESSIONS', sessions: data.sessions.map(mapSession) });
        } else {
          dispatch({ type: 'SET_SESSIONS', sessions: [] });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load sessions';
        setSessionError(msg);
        showToast(msg, 'error');
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
  }, [showToast]);

  const activeSession = state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
  // `by ask --attach` can only reach a session whose owner actually bound its
  // ask.sock. A valid :ask-socket-path is the authoritative attachable signal —
  // `live?` alone isn't enough (e.g. a bind that failed). Otherwise: free prompt.
  const canAttach = !!activeSession?.askSocketPath;

  // Default the toggle to attachability when the active session (or its
  // attachability) changes — on when attachable, off otherwise. Done during
  // render per React's "adjust state on change" pattern; a manual toggle within
  // a session is preserved because the key only moves when the session does.
  const attachSyncKey = `${state.activeSessionId ?? ''}:${canAttach}`;
  if (attachSyncKey !== attachSyncedFor) {
    setAttachSyncedFor(attachSyncKey);
    setAttach(canAttach);
  }

  // Live session status ({:op :status} over the socket): fetched on session
  // change and polled while a turn is running, so the chip reflects idle/running.
  useEffect(() => {
    const id = state.activeSessionId;
    let alive = true;
    const tick = async () => {
      if (!id || !canAttach) {
        if (alive) setSessionStatus(null);
        return;
      }
      try {
        const res = await fetch(`/api/sessions/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive) {
          setSessionStatus({ state: data.state, model: data.model, pendingTurns: data['pending-turns'] });
        }
      } catch {
        // status is best-effort; ignore transient failures
      }
    };
    tick();
    if (!id || !canAttach || !state.loading) return () => { alive = false; };
    const interval = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(interval); };
  }, [state.activeSessionId, canAttach, state.loading]);

  const handleStop = useCallback(async () => {
    if (!state.activeSessionId) return;
    try {
      const res = await fetch(`/api/sessions/${state.activeSessionId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Stopping the current turn…', 'success');
    } catch {
      showToast('Failed to stop the turn', 'error');
    }
  }, [state.activeSessionId, showToast]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!state.activeSessionId) return;
      const sessionId = state.activeSessionId;

      dispatch({ type: 'SEND_MESSAGE', content });

      // For attach turns, stream the session's live rendered output over SSE so
      // the user watches the agent work while the answer is produced.
      const streaming = attach && canAttach;
      let es: EventSource | null = null;
      if (streaming) {
        setStreamingText('');
        es = new EventSource(`/api/sessions/${sessionId}/stream`);
        es.onmessage = (e) => {
          try {
            const frame = JSON.parse(e.data);
            if (frame.type === 'display') {
              setStreamingText((prev) => (prev + frame.text).slice(-4000));
            }
          } catch {
            // ignore malformed frame
          }
        };
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 130000);

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, attach: attach && canAttach, sessionId }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let errorMsg = `Server error (${res.status})`;
          try {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
          } catch {
            // ignore parse error
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.answer) {
          dispatch({ type: 'RECEIVE_REPLY', sessionId, content: data.answer });
        } else {
          throw new Error('Empty response from server');
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          dispatch({
            type: 'RECEIVE_ERROR',
            sessionId,
            error: 'Request timed out. The AI took too long to respond.',
          });
          showToast('Request timed out', 'error');
        } else {
          const msg = error instanceof Error ? error.message : 'Network error';
          dispatch({ type: 'RECEIVE_ERROR', sessionId, error: msg });
          showToast(msg, 'error');
        }
      } finally {
        es?.close();
        setStreamingText('');
      }
    },
    [state.activeSessionId, showToast, attach, canAttach]
  );

  const handleRetry = useCallback(
    (failedContent: string) => {
      if (failedContent && state.activeSessionId) {
        handleSend(failedContent);
      }
    },
    [state.activeSessionId, handleSend]
  );

  const handleCreateSession = useCallback(async () => {
    const title = `Chat ${state.sessions.length + 1}`;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        throw new Error('Failed to create session via API');
      }
      const data: { sessions?: BySessionRow[] } = await res.json();
      if (data.sessions) {
        dispatch({ type: 'SET_SESSIONS', sessions: data.sessions.map(mapSession) });
        showToast('New session created', 'success');
      }
    } catch {
      dispatch({ type: 'CREATE_SESSION', title });
      showToast('Local session created (offline mode)', 'success');
    }
  }, [state.sessions.length, showToast]);

  const handleDeleteSession = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SESSION', id });
  }, []);

  const currentMessages = state.activeSessionId
    ? state.messages[state.activeSessionId] || []
    : [];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-zinc-50 via-white to-blue-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950/30">
      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-in slide-in-from-top-2 ${
            toastType === 'error'
              ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/60 dark:to-red-900/40 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200 shadow-red-500/10'
              : 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/60 dark:to-emerald-900/40 border-green-200 dark:border-green-800/60 text-green-800 dark:text-green-200 shadow-green-500/10'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {toastType === 'error' ? (
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="text-sm font-medium">{toastMessage}</p>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-auto shrink-0 p-0.5 hover:opacity-70 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content area with glassmorphism effect */}
      <div className="relative flex flex-col h-full max-w-4xl mx-auto w-full bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm shadow-xl shadow-zinc-900/5 border-x border-zinc-200/50 dark:border-zinc-800/50">
        <SessionSelector
          sessions={state.sessions}
          activeId={state.activeSessionId}
          onChange={(id) => dispatch({ type: 'SWITCH_SESSION', id })}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
          loading={loadingSessions}
          error={sessionError}
        />
        {canAttach && sessionStatus && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/50 dark:border-zinc-800/40 bg-white/40 dark:bg-zinc-900/40">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sessionStatus.state === 'running'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-medium">{sessionStatus.state === 'running' ? 'Running' : 'Idle'}</span>
            {sessionStatus.model && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="font-mono">{sessionStatus.model}</span>
              </>
            )}
            {!!sessionStatus.pendingTurns && sessionStatus.pendingTurns > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>{sessionStatus.pendingTurns} queued</span>
              </>
            )}
          </div>
        )}
        <ChatContainer
          messages={currentMessages}
          loading={state.loading}
          streamingText={streamingText}
          activeSessionId={state.activeSessionId}
          onRetry={handleRetry}
        />
        <ChatInput
          onSend={handleSend}
          disabled={!state.activeSessionId || state.loading}
          attach={attach && canAttach}
          attachDisabled={!canAttach}
          onAttachChange={setAttach}
          loading={state.loading}
          onStop={canAttach ? handleStop : undefined}
        />
      </div>
    </div>
  );
}
