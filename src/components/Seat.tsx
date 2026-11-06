"use client";

import { useEffect, useRef, useState } from "react";
import { SeatDto } from "@/lib/types";

type Props = {
  seat: SeatDto;
  selected: boolean;
  disabled: boolean;
  onToggle: (seatId: number) => void;
};

function seatColors(seat: SeatDto, selected: boolean) {
  if (seat.status === "BOOKED") {
    return "bg-neutral-800 border-neutral-900 text-neutral-300 dark:bg-neutral-200 dark:border-neutral-300 dark:text-neutral-700";
  }
  if (seat.status === "LOCKED" && !seat.lockedByMe) {
    return "bg-rose-100 border-rose-300 text-rose-600 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-400";
  }
  if (seat.lockedByMe) {
    return "bg-amber-500 border-amber-600 text-white shadow-md shadow-amber-500/40";
  }
  if (selected) {
    return "bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-400/60 dark:bg-amber-950 dark:border-amber-500 dark:text-amber-300";
  }
  return "bg-[var(--surface)] border-[var(--surface-border)] text-[var(--foreground)]/70 hover:border-amber-400/60";
}

export default function Seat({ seat, selected, disabled, onToggle }: Props) {
  const isClickable = seat.status === "AVAILABLE" && !disabled;
  const isDimmed = disabled && seat.status === "AVAILABLE";
  const prevStatus = useRef(seat.status);
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => {
    if (prevStatus.current !== "BOOKED" && seat.status === "BOOKED") {
      setJustClaimed(true);
      const timer = setTimeout(() => setJustClaimed(false), 300);
      prevStatus.current = seat.status;
      return () => clearTimeout(timer);
    }
    prevStatus.current = seat.status;
  }, [seat.status]);

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => onToggle(seat.id)}
      title={`Seat ${seat.seatNumber} — ${seat.status}`}
      aria-pressed={selected}
      data-testid={`seat-${seat.seatNumber}`}
      data-status={seat.status}
      className={`group relative flex h-12 w-12 flex-col items-center transition-transform duration-150 ${
        isClickable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-not-allowed"
      } ${isDimmed ? "opacity-40" : ""} ${justClaimed ? "animate-seat-claim" : ""}`}
    >
      {/* seat backrest */}
      <span
        className={`h-3 w-9 rounded-t-md border border-b-0 ${seatColors(seat, selected)}`}
        aria-hidden
      />
      {/* seat cushion */}
      <span
        className={`flex h-8 w-11 items-center justify-center rounded-md border text-[11px] font-bold transition-colors duration-150 ${seatColors(
          seat,
          selected,
        )}`}
      >
        {seat.status === "BOOKED" ? (
          <CheckIcon />
        ) : seat.status === "LOCKED" && !seat.lockedByMe ? (
          <LockIcon />
        ) : (
          seat.seatNumber
        )}
      </span>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
      <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm2 6H8V6a2 2 0 1 1 4 0v2Z" />
    </svg>
  );
}
