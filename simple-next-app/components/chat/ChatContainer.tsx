'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import MessageBubble from './MessageBubble';

interface ChatContainerProps {
  messages: Message[];
  loading: boolean;
  activeSessionId: string | null;
  onRetry?: (messageContent: string) => void;
}

export default function ChatContainer({ messages, loading, activeSessionId, onRetry }: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages.length, loading]);

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Welcome to Chat
          </h3>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 leading-relaxed">
            Select a session from the dropdown or create a new one to start a conversation with the Brainyard AI assistant.
          </p>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20h9M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854L16.376 3.622z" />
            </svg>
          </div>
          <h3 className="text-md font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            No messages yet
          </h3>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Type a message below to start the conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-1 scroll-smooth">
      {/* Welcome banner for first message */}
      {messages.length === 1 && messages[0].role === 'user' && !loading && (
        <div className="text-center mb-6">
          <div className="inline-block bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl px-4 py-2">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Waiting for assistant response...
            </p>
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onRetry={msg.role === 'user' || msg.content.startsWith('⚠️') ? () => onRetry?.(msg.content.replace(/^⚠️ Error: /, '').replace(/^⚠️ Network error: /, '')) : undefined}
        />
      ))}
      {/* Improved loading indicator */}
      {loading && (
        <div className="flex gap-3 mb-5">
          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-700 dark:bg-zinc-600 flex items-center justify-center text-white text-xs shadow-sm">
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm max-w-[75%]">
            <div className="flex gap-1.5">
              <span className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
