"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  onDismiss: () => void;
};

export default function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="animate-toast-in fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-3 pr-2 text-sm text-rose-700 shadow-lg dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
          <path
            fillRule="evenodd"
            d="M8.26 3.1c.75-1.33 2.73-1.33 3.48 0l6.5 11.56c.73 1.3-.2 2.9-1.74 2.9H3.5c-1.53 0-2.47-1.6-1.74-2.9L8.26 3.1ZM10 6a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Zm0 8.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
            clipRule="evenodd"
          />
        </svg>
        <p className="flex-1">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
