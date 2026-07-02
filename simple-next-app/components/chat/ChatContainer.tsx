'use client';

import { useEffect, useRef } from 'react';
import { Message, ActivityItem } from '@/types/chat';
import MessageBubble from './MessageBubble';

interface ChatContainerProps {
  messages: Message[];
  loading: boolean;
  activity?: ActivityItem[];
  activeSessionId: string | null;
  onRetry?: (messageContent: string) => void;
  onRemember?: (messageContent: string) => void;
  onTrajectory?: (message: Message) => void;
  onMemory?: (message: Message) => void;
}

export default function ChatContainer({ messages, loading, activity, activeSessionId, onRetry, onRemember, onTrajectory, onMemory }: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages.length, loading, activity]);

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-transparent via-zinc-50/50 to-blue-50/30 dark:via-zinc-900/30 dark:to-blue-950/20">
        <div className="text-center max-w-sm p-8 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-zinc-700/30 shadow-lg shadow-zinc-900/5">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-400/10 dark:to-indigo-400/10 flex items-center justify-center ring-1 ring-blue-500/20 dark:ring-blue-400/20">
            <svg className="w-10 h-10 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold bg-gradient-to-r from-zinc-800 to-zinc-600 dark:from-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent mb-1">
            Welcome to Chat
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Select a session from the dropdown or create a new one to start a conversation with the Brainyard AI assistant.
          </p>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-transparent via-zinc-50/50 to-blue-50/30 dark:via-zinc-900/30 dark:to-blue-950/20">
        <div className="text-center max-w-sm p-8 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-zinc-700/30 shadow-lg shadow-zinc-900/5">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-zinc-400/10 to-zinc-500/10 dark:from-zinc-500/10 dark:to-zinc-600/10 flex items-center justify-center ring-1 ring-zinc-400/20 dark:ring-zinc-500/20">
            <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20h9M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854L16.376 3.622z" />
            </svg>
          </div>
          <h3 className="text-md font-medium bg-gradient-to-r from-zinc-600 to-zinc-500 dark:from-zinc-300 dark:to-zinc-400 bg-clip-text text-transparent mb-1">
            No messages yet
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Type a message below to start the conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-1 scroll-smooth bg-gradient-to-b from-transparent via-zinc-50/30 to-blue-50/20 dark:via-zinc-900/20 dark:to-blue-950/10">
      {messages.length === 1 && messages[0].role === 'user' && !loading && (
        <div className="text-center mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="inline-block bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 dark:border-blue-800/50 rounded-xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Waiting for assistant response...
              </p>
            </div>
          </div>
        </div>
      )}
      {messages.map((msg, idx) => {
        // Retry is only surfaced on error bubbles (see MessageBubble). Resend the
        // user message that triggered the error, not the error text itself.
        let found: string | undefined;
        if (msg.role === 'error') {
          for (let j = idx - 1; j >= 0; j--) {
            if (messages[j].role === 'user') {
              found = messages[j].content;
              break;
            }
          }
        }
        const retryContent = found; // const so TS narrows it inside the closure below
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            onRetry={retryContent ? () => onRetry?.(retryContent) : undefined}
            onRemember={msg.role === 'assistant' && onRemember ? () => onRemember(msg.content) : undefined}
            onTrajectory={msg.role === 'assistant' && onTrajectory ? () => onTrajectory(msg) : undefined}
            onMemory={msg.role === 'assistant' && onMemory ? () => onMemory(msg) : undefined}
          />
        );
      })}
      {loading && (
        <div className="flex gap-3 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center text-white shadow-md shadow-zinc-500/20 ring-2 ring-white/40 dark:ring-zinc-800/60">
            <svg className="w-[18px] h-[18px] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          {activity && activity.length > 0 ? (
            <div className="bg-white/80 dark:bg-zinc-800/70 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-700/50 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm max-w-[85%] w-full">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-medium">working</span>
              </div>
              <div className="space-y-1.5">
                {activity.map((a, i) => {
                  const isLatest = i === activity.length - 1;
                  const dim = isLatest ? '' : 'opacity-50';
                  if (a.type === 'reasoning') {
                    return (
                      <div key={i} className={`flex gap-2 text-[12px] leading-snug ${dim}`}>
                        <span className="shrink-0">💭</span>
                        <span className="text-zinc-600 dark:text-zinc-300 italic line-clamp-2">{a.text}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`flex items-center gap-2 text-[12px] ${dim}`}>
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium text-[11px]">
                        <span>🔧</span>{a.tool}
                      </span>
                      {a.detail && (
                        <code className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{a.detail}</code>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-zinc-800/70 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-700/50 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm max-w-[78%]">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
