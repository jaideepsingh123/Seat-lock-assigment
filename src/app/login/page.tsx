"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500 text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 1.2 3.26L4 19.5V21h16v-1.5l-4.2-5.24A5 5 0 0 0 17 11V7a5 5 0 0 0-5-5Z" />
          </svg>
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">SeatLock</h1>
        <p className="text-sm text-[var(--foreground)]/55">
          {mode === "login" ? "Log in to book your seat" : "Create an account to book a seat"}
        </p>
      </div>

      <div className="ticket flex rounded-lg p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            mode === "login" ? "bg-amber-500 text-white shadow-sm" : "text-[var(--foreground)]/55"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            mode === "signup" ? "bg-amber-500 text-white shadow-sm" : "text-[var(--foreground)]/55"
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="ticket flex flex-col gap-4 rounded-xl p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]/80">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]/80">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {mode === "signup" && (
            <p className="text-xs text-[var(--foreground)]/40">At least 8 characters.</p>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-white shadow-sm shadow-amber-500/30 transition-opacity hover:bg-amber-600 disabled:opacity-40"
        >
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </main>
  );
}
