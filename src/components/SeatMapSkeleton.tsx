export default function SeatMapSkeleton() {
  const rows = Array.from({ length: 5 });
  return (
    <div className="ticket w-full max-w-md animate-pulse rounded-2xl shadow-sm">
      <span className="ticket-notch ticket-notch-left" aria-hidden />
      <span className="ticket-notch ticket-notch-right" aria-hidden />
      <div className="mx-auto mt-5 h-3 w-40 rounded bg-[var(--surface-border)]" />
      <div className="ticket-perforation mt-5 flex flex-col gap-2 px-4 pb-5 pt-5 sm:gap-3 sm:px-6">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center justify-center gap-2">
            <span className="w-4" />
            <div className="flex gap-1.5 sm:gap-2">
              <div className="h-11 w-11 rounded-md bg-[var(--surface-border)]" />
              <div className="h-11 w-11 rounded-md bg-[var(--surface-border)]" />
            </div>
            <div className="w-5 sm:w-8" />
            <div className="flex gap-1.5 sm:gap-2">
              <div className="h-11 w-11 rounded-md bg-[var(--surface-border)]" />
              <div className="h-11 w-11 rounded-md bg-[var(--surface-border)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
