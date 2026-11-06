"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SeatMap from "@/components/SeatMap";
import SeatMapSkeleton from "@/components/SeatMapSkeleton";
import CountdownTimer from "@/components/CountdownTimer";
import Toast from "@/components/Toast";
import { SeatDto } from "@/lib/types";

type Phase = "browsing" | "locked" | "booked";

const POLL_INTERVAL_MS = 3000;

export default function Home() {
  const router = useRouter();
  const [seats, setSeats] = useState<SeatDto[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>("browsing");
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [bookedSeatNumbers, setBookedSeatNumbers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const fetchSeats = useCallback(async () => {
    const res = await fetch("/api/seats");
    const data = await res.json();
    setSeats(data.seats as SeatDto[]);
    setEmail(data.email as string | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount + poll
    fetchSeats();
    const interval = setInterval(() => {
      // Don't let polling yank seats out from under an active checkout UI.
      if (phaseRef.current === "browsing") fetchSeats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  const stats = useMemo(() => {
    const available = seats.filter((s) => s.status === "AVAILABLE").length;
    const locked = seats.filter((s) => s.status === "LOCKED").length;
    const booked = seats.filter((s) => s.status === "BOOKED").length;
    return { available, locked, booked, total: seats.length || 20 };
  }, [seats]);

  const selectedSeatNumbers = useMemo(
    () =>
      seats
        .filter((s) => selectedIds.has(s.id))
        .map((s) => s.seatNumber)
        .sort((a, b) => a - b),
    [seats, selectedIds],
  );

  function toggleSeat(seatId: number) {
    setError(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) next.delete(seatId);
      else next.add(seatId);
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmail(null);
    router.push("/login");
  }

  async function startCheckout() {
    if (selectedIds.size === 0) return;
    if (!email) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/seats/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error ?? "Could not lock the selected seats.");
        await fetchSeats();
        return;
      }
      setLockExpiresAt(data.lockExpiresAt);
      setPhase("locked");
      await fetchSeats();
    } finally {
      setBusy(false);
    }
  }

  async function confirmBooking() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error ?? "Could not confirm the booking.");
        setPhase("browsing");
        setSelectedIds(new Set());
        await fetchSeats();
        return;
      }
      setBookedSeatNumbers(selectedSeatNumbers);
      setPhase("booked");
      await fetchSeats();
    } finally {
      setBusy(false);
    }
  }

  async function cancelReservation() {
    setBusy(true);
    try {
      await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: Array.from(selectedIds) }),
      });
    } finally {
      resetToBrowsing();
      setBusy(false);
    }
  }

  function resetToBrowsing() {
    setPhase("browsing");
    setSelectedIds(new Set());
    setLockExpiresAt(null);
    fetchSeats();
  }

  function handleExpire() {
    setError("Your seat lock expired. The seats have been released.");
    resetToBrowsing();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-6 px-4 pb-28 pt-8 sm:gap-8 sm:px-8 sm:pb-8">
      {error && <Toast message={error} onDismiss={() => setError(null)} />}

      <div className="flex w-full items-center justify-end gap-3 text-sm">
        {email ? (
          <>
            <span className="text-[var(--foreground)]/55">{email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-[var(--surface-border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]/70 transition-colors hover:bg-[var(--surface)]"
            >
              Log out
            </button>
          </>
        ) : (
          <a
            href="/login"
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-amber-500/30 transition-colors hover:bg-amber-600"
          >
            Log in to book
          </a>
        )}
      </div>

      <header className="flex w-full flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <TicketLogo />
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">SeatLock</h1>
          </div>
          <p className="text-sm text-[var(--foreground)]/55">
            Coach 1 · select seats, lock for 2 minutes, confirm to book
          </p>
        </div>

        <div className="grid w-full max-w-sm grid-cols-3 gap-2 text-center sm:gap-3">
          <StatCard label="Available" value={stats.available} tone="neutral" />
          <StatCard label="Locked" value={stats.locked} tone="rose" />
          <StatCard label="Booked" value={stats.booked} tone="ink" />
        </div>
      </header>

      {loading ? (
        <SeatMapSkeleton />
      ) : (
        <SeatMap
          seats={seats}
          selectedIds={selectedIds}
          disabled={phase !== "browsing" || busy}
          onToggle={toggleSeat}
        />
      )}

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-[var(--foreground)]/55">
        <Legend color="bg-[var(--surface)] border-[var(--surface-border)]" label="Available" />
        <Legend color="bg-amber-50 border-amber-500 dark:bg-amber-950" label="Selected" />
        <Legend color="bg-amber-500 border-amber-600" label="Your lock" />
        <Legend color="bg-rose-100 border-rose-300 dark:bg-rose-950" label="Locked by other" />
        <Legend color="bg-neutral-800 border-neutral-900 dark:bg-neutral-200" label="Booked" />
      </div>

      {phase === "browsing" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 p-4 backdrop-blur sm:static sm:w-full sm:max-w-sm sm:rounded-xl sm:border sm:p-0 sm:backdrop-blur-none">
          <button
            type="button"
            disabled={selectedIds.size === 0 || busy}
            onClick={startCheckout}
            className="w-full rounded-lg bg-amber-500 px-6 py-3 font-semibold text-white shadow-sm shadow-amber-500/30 transition-opacity hover:bg-amber-600 disabled:opacity-40 disabled:shadow-none"
          >
            {selectedIds.size === 0
              ? "Select a seat to begin"
              : email
                ? `Checkout (${selectedIds.size} seat${selectedIds.size > 1 ? "s" : ""})`
                : `Log in to checkout (${selectedIds.size} seat${selectedIds.size > 1 ? "s" : ""})`}
          </button>
        </div>
      )}

      {phase === "locked" && lockExpiresAt && (
        <div className="ticket flex w-full max-w-sm flex-col items-center gap-4 rounded-xl p-5">
          <p className="font-display text-sm font-medium text-[var(--foreground)]/80">
            Seat{selectedSeatNumbers.length > 1 ? "s" : ""} {selectedSeatNumbers.join(", ")} on hold
          </p>
          <CountdownTimer expiresAt={lockExpiresAt} onExpire={handleExpire} />
          <p className="-mt-1 text-xs text-[var(--foreground)]/50">Confirm before the timer runs out</p>
          <div className="flex w-full gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={confirmBooking}
              className="flex-1 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-white shadow-sm shadow-amber-500/30 transition-colors hover:bg-amber-600 disabled:opacity-40"
            >
              Confirm booking
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelReservation}
              className="flex-1 rounded-lg border border-[var(--surface-border)] px-5 py-2.5 font-medium text-[var(--foreground)]/70 transition-colors hover:bg-[var(--background)] disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "booked" && (
        <div className="ticket w-full max-w-sm overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center gap-2 px-6 pb-5 pt-6 text-center">
            <span className="animate-pop-in flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <p className="font-display text-base font-bold">Booking confirmed</p>
          </div>

          <div className="ticket-perforation flex items-center justify-center gap-10 px-6 py-5">
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground)]/40">
                Seat{bookedSeatNumbers.length > 1 ? "s" : ""}
              </div>
              <div className="font-display text-3xl font-bold text-amber-600 dark:text-amber-400">
                {bookedSeatNumbers.join(", ")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground)]/40">
                Coach
              </div>
              <div className="font-display text-3xl font-bold">1</div>
            </div>
          </div>

          <div className="ticket-perforation flex items-center justify-between px-6 py-4">
            <span className="rail-track h-[2px] w-full max-w-[60%]" aria-hidden />
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-amber-500" fill="currentColor">
              <path d="M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 1.2 3.26L4 19.5V21h16v-1.5l-4.2-5.24A5 5 0 0 0 17 11V7a5 5 0 0 0-5-5Zm-2.5 15h5l1.6 2H7.9l1.6-2Z" />
            </svg>
          </div>

          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={resetToBrowsing}
              className="w-full rounded-lg bg-[var(--foreground)] px-5 py-2.5 font-medium text-[var(--background)]"
            >
              Book more seats
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function TicketLogo() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-white">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 1.2 3.26L4 19.5V21h16v-1.5l-4.2-5.24A5 5 0 0 0 17 11V7a5 5 0 0 0-5-5Z" />
      </svg>
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${color}`} />
      {label}
    </span>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "rose" | "ink" }) {
  const toneClasses = {
    neutral: "border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground)]/80",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
    ink: "border-neutral-700 bg-neutral-800 text-neutral-100 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-800",
  }[tone];

  return (
    <div className={`rounded-lg border px-2 py-2 sm:px-3 ${toneClasses}`}>
      <div className="font-display text-lg font-bold leading-none sm:text-xl">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide sm:text-xs">{label}</div>
    </div>
  );
}
