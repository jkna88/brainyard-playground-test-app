'use client';

import { Message } from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  onRetry?: () => void;
}

function UserAvatar() {
  return (
    <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
      U
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-700 dark:bg-zinc-600 flex items-center justify-center text-white text-xs shadow-sm">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    </div>
  );
}

export default function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error' || message.content.startsWith('⚠️');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const time = new Date(message.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const date = new Date(message.timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className={`flex gap-3 mb-5 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {isUser ? <UserAvatar /> : <AssistantAvatar />}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : isError
              ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-bl-md'
              : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 rounded-bl-md'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom link rendering with target=_blank
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      {children}
                    </a>
                  ),
                  // Override code to handle inline vs block
                  code({ className, children, ...props }) {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                          {children}
                        </code>
                      );
                    }
                    // Block code rendered by pre
                    return <code className="text-sm" {...props}>{children}</code>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className={`text-[11px] ${isUser ? 'text-blue-400 dark:text-blue-300' : 'text-zinc-400 dark:text-zinc-500'}`}>
            {time}
          </span>
          <span className="text-[11px] text-zinc-300 dark:text-zinc-600">·</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{date}</span>
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title="Copy message"
          >
            {copyState === 'copied' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
          {/* Retry button for errors */}
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
              title="Retry sending this message"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
