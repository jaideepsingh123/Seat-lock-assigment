"use client";

import { useEffect, useState } from "react";

type Props = {
  expiresAt: string;
  onExpire: () => void;
};

const URGENT_THRESHOLD_MS = 30_000;
const LOCK_DURATION_MS = 2 * 60 * 1000;
const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CountdownTimer({ expiresAt, onExpire }: Props) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, target - Date.now());
      setMsLeft(remaining);
      if (remaining === 0) onExpire();
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const totalSeconds = Math.ceil(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = msLeft <= URGENT_THRESHOLD_MS;
  const progress = Math.max(0, Math.min(1, msLeft / LOCK_DURATION_MS));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className={`relative flex h-24 w-24 items-center justify-center ${urgent ? "animate-urgent-pulse" : ""}`}>
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          fill="none"
          strokeWidth="5"
          className={urgent ? "stroke-rose-100 dark:stroke-rose-950" : "stroke-amber-100 dark:stroke-amber-950"}
        />
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset] duration-300 ease-linear ${
            urgent ? "stroke-rose-500" : "stroke-amber-500"
          }`}
        />
      </svg>
      <span
        className={`font-display absolute font-bold tabular-nums ${
          urgent ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
