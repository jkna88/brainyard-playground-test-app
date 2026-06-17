'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxChars = 4000;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [value]);

  // Focus textarea when disabled becomes false
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const charCount = value.length;
  const isOverLimit = charCount > maxChars;
  const canSend = !disabled && value.trim().length > 0 && !isOverLimit;

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="flex items-end gap-2 px-4 py-3 max-w-3xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              if (e.target.value.length <= maxChars) {
                setValue(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Select a session first...' : (placeholder || 'Type your message…')}
            rows={1}
            disabled={disabled}
            className={`w-full resize-none bg-zinc-50 dark:bg-zinc-800/50 border rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed placeholder-zinc-400 dark:placeholder-zinc-500 transition-colors ${
              isOverLimit ? 'border-red-400 dark:border-red-500' : 'border-zinc-300 dark:border-zinc-600'
            }`}
          />
          {/* Character count */}
          {value.length > 0 && (
            <div className="absolute bottom-2 right-3 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              <span className={isOverLimit ? 'text-red-500 font-semibold' : ''}>
                {charCount}/{maxChars}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 p-3 rounded-xl transition-all ${
            canSend
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          }`}
          title="Send message (Enter)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19V5m0 0l-7 7m7-7l7 7"
            />
          </svg>
        </button>
      </div>
      {/* Keyboard hint */}
      <div className="pb-1.5 text-center">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
          Press <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono border border-zinc-200 dark:border-zinc-700">Enter</kbd> to send · <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono border border-zinc-200 dark:border-zinc-700">Shift</kbd> + <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono border border-zinc-200 dark:border-zinc-700">Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
}
