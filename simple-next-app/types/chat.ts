export interface Session {
  id: string;
  title: string;
  createdAt: number;
  lastActivity: number;
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
