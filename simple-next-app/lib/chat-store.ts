import { ChatState, ChatAction, Session, Message } from '@/types/chat';

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full — degrade gracefully
  }
}

const STORAGE_KEY_SESSIONS = 'brainyard-chat-sessions';
const STORAGE_KEY_MESSAGES_PREFIX = 'brainyard-chat-msg-';

function sessionsKey(): string { return STORAGE_KEY_SESSIONS; }
function messagesKey(sessionId: string): string { return STORAGE_KEY_MESSAGES_PREFIX + sessionId; }

export function getInitialState(): ChatState {
  const sessions: Session[] = loadFromStorage<Session[]>(sessionsKey(), []);
  const activeSessionId = sessions.length > 0 ? sessions[0].id : null;
  const messages: Record<string, Message[]> = {};
  for (const s of sessions) {
    messages[s.id] = loadFromStorage<Message[]>(messagesKey(s.id), []);
  }
  return { sessions, activeSessionId, messages, loading: false, error: null };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_SESSIONS': {
      const newSessions = action.sessions;
      const newMessages: Record<string, Message[]> = { ...state.messages };
      const existingIds = new Set(newSessions.map((s) => s.id));
      // Remove orphaned session messages
      for (const sid of Object.keys(newMessages)) {
        if (!existingIds.has(sid)) {
          delete newMessages[sid];
        }
      }
      // Load localStorage messages for any new-from-API sessions
      for (const s of newSessions) {
        if (!newMessages[s.id]) {
          newMessages[s.id] = loadFromStorage<Message[]>(messagesKey(s.id), []);
        }
      }
      const newActiveId = existingIds.has(state.activeSessionId ?? '')
        ? state.activeSessionId
        : (newSessions.length > 0 ? newSessions[0].id : null);
      saveToStorage(sessionsKey(), newSessions);
      return { ...state, sessions: newSessions, activeSessionId: newActiveId, messages: newMessages, error: null };
    }

    case 'SET_SESSION_ERROR': {
      return { ...state, error: action.error };
    }

    case 'CREATE_SESSION': {
      const newSession: Session = {
        id: generateId(),
        title: action.title,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      const newSessions = [...state.sessions, newSession];
      saveToStorage(sessionsKey(), newSessions);
      return {
        ...state,
        sessions: newSessions,
        activeSessionId: newSession.id,
        messages: { ...state.messages, [newSession.id]: [] },
        error: null,
      };
    }
    case 'DELETE_SESSION': {
      const newSessions = state.sessions.filter((s) => s.id !== action.id);
      saveToStorage(sessionsKey(), newSessions);
      const { [action.id]: _removed, ...restMessages } = state.messages;
      if (typeof window !== 'undefined') {
        try { localStorage.removeItem(messagesKey(action.id)); } catch { /* ignore */ }
      }
      return {
        ...state,
        sessions: newSessions,
        activeSessionId: state.activeSessionId === action.id
          ? (newSessions.length > 0 ? newSessions[0].id : null)
          : state.activeSessionId,
        messages: restMessages,
      };
    }
    case 'SWITCH_SESSION': {
      return { ...state, activeSessionId: action.id };
    }
    case 'SEND_MESSAGE': {
      if (!state.activeSessionId) return state;
      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: action.content,
        timestamp: Date.now(),
      };
      const sessionMessages = state.messages[state.activeSessionId] || [];
      const updatedMessages = {
        ...state.messages,
        [state.activeSessionId]: [...sessionMessages, userMsg],
      };
      saveToStorage(messagesKey(state.activeSessionId), updatedMessages[state.activeSessionId]);
      return { ...state, messages: updatedMessages, loading: true };
    }
    case 'RECEIVE_REPLY': {
      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: action.content,
        timestamp: Date.now(),
      };
      const sessionMessages = state.messages[action.sessionId] || [];
      const updatedMessages = {
        ...state.messages,
        [action.sessionId]: [...sessionMessages, assistantMsg],
      };
      const updatedSessions = state.sessions.map((s) =>
        s.id === action.sessionId ? { ...s, lastActivity: Date.now() } : s
      );
      saveToStorage(messagesKey(action.sessionId), updatedMessages[action.sessionId]);
      saveToStorage(sessionsKey(), updatedSessions);
      return { ...state, messages: updatedMessages, sessions: updatedSessions, loading: false, error: null };
    }
    case 'RECEIVE_ERROR': {
      const errorMsg: Message = {
        id: generateId(),
        role: 'error',
        content: `⚠️ ${action.error}`,
        timestamp: Date.now(),
      };
      const sessionMessages = state.messages[action.sessionId] || [];
      const updatedMessages = {
        ...state.messages,
        [action.sessionId]: [...sessionMessages, errorMsg],
      };
      // Keep error state for UI notification
      const updatedSessions = state.sessions.map((s) =>
        s.id === action.sessionId ? { ...s, lastActivity: Date.now() } : s
      );
      saveToStorage(messagesKey(action.sessionId), updatedMessages[action.sessionId]);
      saveToStorage(sessionsKey(), updatedSessions);
      return { ...state, messages: updatedMessages, sessions: updatedSessions, loading: false, error: action.error };
    }
    case 'SET_LOADING': {
      return { ...state, loading: action.loading };
    }
    case 'SET_ERROR': {
      return { ...state, error: action.error };
    }
    default:
      return state;
  }
}
