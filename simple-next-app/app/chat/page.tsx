'use client';

import { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { chatReducer, getInitialState } from '@/lib/chat-store';
import { Session } from '@/types/chat';
import SessionSelector from '@/components/chat/SessionSelector';
import ChatContainer from '@/components/chat/ChatContainer';
import ChatInput from '@/components/chat/ChatInput';

function collectFailedMessages(messages: Record<string, import('@/types/chat').Message[]>, sessionId: string | null): string[] {
  if (!sessionId) return [];
  const msgs = messages[sessionId] || [];
  const failures: string[] = [];
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role === 'error') {
      for (let j = i - 1; j >= 0; j--) {
        if (msgs[j].role === 'user') {
          failures.push(msgs[j].content);
          break;
        }
      }
    }
  }
  return failures;
}

export default function ChatPage() {
  const [state, dispatch] = useReducer(chatReducer, undefined, getInitialState);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const [attach, setAttach] = useState(false);
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
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (data.sessions && data.sessions.length > 0) {
          const mapped: Session[] = data.sessions.map((s: any) => ({
            id: s['session-id'],
            title: s.label || s['first-user-input']?.slice(0, 50) || s['session-id'],
            createdAt: s['started-at'] || Date.now(),
            lastActivity: s['last-attached-at'] || Date.now(),
          }));
          dispatch({ type: 'SET_SESSIONS', sessions: mapped });
        } else {
          dispatch({ type: 'SET_SESSIONS', sessions: [] });
        }
      } catch (err: any) {
        const msg = err.message || 'Failed to load sessions';
        setSessionError(msg);
        showToast(msg, 'error');
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
  }, [showToast]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!state.activeSessionId) return;
      const sessionId = state.activeSessionId;

      dispatch({ type: 'SEND_MESSAGE', content });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 130000);

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, attach, sessionId }),
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
      } catch (error: any) {
        if (error.name === 'AbortError') {
          dispatch({
            type: 'RECEIVE_ERROR',
            sessionId,
            error: 'Request timed out. The AI took too long to respond.',
          });
          showToast('Request timed out', 'error');
        } else {
          dispatch({
            type: 'RECEIVE_ERROR',
            sessionId,
            error: error.message || 'Network error',
          });
          showToast(error.message || 'Network error', 'error');
        }
      }
    },
    [state.activeSessionId, showToast, attach]
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
      const data = await res.json();
      if (data.sessions) {
        const mapped: Session[] = data.sessions.map((s: any) => ({
          id: s['session-id'],
          title: s.label || s['first-user-input']?.slice(0, 50) || s['session-id'],
          createdAt: s['started-at'] || Date.now(),
          lastActivity: s['last-attached-at'] || Date.now(),
        }));
        dispatch({ type: 'SET_SESSIONS', sessions: mapped });
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
        <ChatContainer
          messages={currentMessages}
          loading={state.loading}
          activeSessionId={state.activeSessionId}
          onRetry={handleRetry}
        />
        <ChatInput
          onSend={handleSend}
          disabled={!state.activeSessionId || state.loading}
          attach={attach}
          onAttachChange={setAttach}
        />
      </div>
    </div>
  );
}
