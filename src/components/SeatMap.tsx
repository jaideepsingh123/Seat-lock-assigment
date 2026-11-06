"use client";

import { SeatDto } from "@/lib/types";
import Seat from "@/components/Seat";

type Props = {
  seats: SeatDto[];
  selectedIds: Set<number>;
  disabled: boolean;
  onToggle: (seatId: number) => void;
};

export default function SeatMap({ seats, selectedIds, disabled, onToggle }: Props) {
  const rows: SeatDto[][] = [];
  for (let i = 0; i < seats.length; i += 4) {
    rows.push(seats.slice(i, i + 4));
  }

  return (
    <div className="ticket w-full max-w-md rounded-2xl shadow-sm">
      <span className="ticket-notch ticket-notch-left" aria-hidden />
      <span className="ticket-notch ticket-notch-right" aria-hidden />

      <div className="flex items-center justify-center gap-2 px-4 pt-5 pb-3 sm:px-6">
        <span className="rail-track h-[2px] w-8" aria-hidden />
        <span className="font-display text-xs font-semibold tracking-[0.2em] text-[var(--foreground)]/50">
          FRONT OF COACH
        </span>
        <span className="rail-track h-[2px] w-8" aria-hidden />
      </div>

      <div className="ticket-perforation px-4 pt-5 pb-5 sm:px-6">
        <div className="flex flex-col gap-2 sm:gap-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center justify-center gap-2">
              <span className="w-4 shrink-0 text-right font-mono text-[10px] font-medium text-[var(--foreground)]/40">
                {i + 1}
              </span>
              <div className="flex gap-1.5 sm:gap-2">
                {row.slice(0, 2).map((seat) => (
                  <Seat
                    key={seat.id}
                    seat={seat}
                    selected={selectedIds.has(seat.id)}
                    disabled={disabled}
                    onToggle={onToggle}
                  />
                ))}
              </div>
              <div className="w-5 shrink-0 sm:w-8" aria-hidden />
              <div className="flex gap-1.5 sm:gap-2">
                {row.slice(2, 4).map((seat) => (
                  <Seat
                    key={seat.id}
                    seat={seat}
                    selected={selectedIds.has(seat.id)}
                    disabled={disabled}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
