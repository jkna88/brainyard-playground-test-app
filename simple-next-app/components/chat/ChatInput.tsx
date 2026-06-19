'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  placeholder?: string;
  attach?: boolean;
  attachDisabled?: boolean;
  onAttachChange?: (checked: boolean) => void;
}

export default function ChatInput({ onSend, disabled, placeholder, attach, attachDisabled, onAttachChange }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxChars = 4000;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 160) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 160 ? 'auto' : 'hidden';
    }
  }, [value]);

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
    <div className="border-t border-zinc-200/70 dark:border-zinc-700/50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
      <div className="flex items-center gap-2 px-4 py-3 max-w-3xl mx-auto">
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
            className={`w-full resize-none overflow-hidden align-top bg-white/70 dark:bg-zinc-800/50 backdrop-blur-sm border rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder-zinc-400 dark:placeholder-zinc-500 transition-all duration-200 ${
              isOverLimit ? 'border-red-400 dark:border-red-500' : 'border-zinc-300/70 dark:border-zinc-600/70 focus:border-blue-400/50'
            }`}
          />
          {value.length > 0 && (
            <div className="absolute bottom-2.5 right-3 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              <span className={isOverLimit ? 'text-red-500 font-semibold' : ''}>
                {charCount}/{maxChars}
              </span>
            </div>
          )}
        </div>
        {/* Attach toggle */}
        {onAttachChange !== undefined && (
          <label
            className={`shrink-0 flex items-center gap-1.5 select-none py-1 ${attachDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={
              attachDisabled
                ? 'Attach unavailable — this session has no live owner process'
                : attach
                ? 'Attached to session — uses by ask --attach'
                : 'Free prompt — uses by ask -p free-llm'
            }
          >
            <input
              type="checkbox"
              checked={!!attach}
              disabled={attachDisabled}
              onChange={(e) => onAttachChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-zinc-300 dark:bg-zinc-600 rounded-full transition-colors peer-checked:bg-blue-600 peer-checked:dark:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-sm after:transition-all peer-checked:after:translate-x-4" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Attach</span>
          </label>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 p-3 rounded-xl transition-all duration-200 ${
            canSend
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 active:scale-95'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          }`}
          title="Send message (Enter)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m-7-7l7 7" />
          </svg>
        </button>
      </div>
      <div className="pb-1.5 text-center">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
          Press <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono border border-zinc-200 dark:border-zinc-700 shadow-sm">Enter</kbd> to send · <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono border border-zinc-200 dark:border-zinc-700 shadow-sm">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono border border-zinc-200 dark:border-zinc-700 shadow-sm">Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
}
