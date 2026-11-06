/**
 * Simulates 100 concurrent, REAL authenticated users racing for 20 seats to
 * prove the booking system never confirms more than 20 seats and never
 * assigns one seat to two users. Each simulated user signs up for a real
 * account (so this exercises the exact same auth-gated code path a real
 * person would hit), then fires lock+confirm requests concurrently.
 *
 * Run against a running server with a freshly seeded DB:
 *
 *   npm run seed
 *   npm run dev          (or: npm run build && npm run start)
 *   npm run concurrency-test
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.SEATLOCK_BASE_URL ?? "http://localhost:3000";
const USERS = 100;
const SEATS = 20;
const TEST_EMAIL_PREFIX = "loadtest-";
const RUN_ID = Date.now();

const prisma = new PrismaClient();

type JsonResponse = Record<string, unknown>;

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/seatlock_session=[^;]+/);
  if (!match) throw new Error(`No session cookie in signup response (status ${res.status})`);
  return match[0];
}

async function signUpTestUser(index: number): Promise<string> {
  const email = `${TEST_EMAIL_PREFIX}${RUN_ID}-${index}@test.seatlock`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "load-test-password" }),
  });
  if (!res.ok) throw new Error(`Signup failed for ${email}: ${res.status} ${await res.text()}`);
  return extractSessionCookie(res);
}

async function callAsUser(path: string, cookie: string, body: unknown): Promise<JsonResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return (await res.json()) as JsonResponse;
}

async function simulateUser(cookie: string, seatId: number) {
  const lockRes = await callAsUser("/api/seats/lock", cookie, { seatIds: [seatId] });
  if (!("lockedSeatIds" in lockRes)) {
    return { seatId, outcome: "lock-failed" as const };
  }

  const confirmRes = await callAsUser("/api/bookings/confirm", cookie, { seatIds: [seatId] });
  if ("bookedSeatIds" in confirmRes) {
    return { seatId, outcome: "booked" as const };
  }
  return { seatId, outcome: "confirm-failed" as const };
}

async function pauseForInspection() {
  // Skip the pause entirely when not running interactively (CI, piped output, etc.)
  // or when explicitly disabled, so automated runs still clean up on their own.
  if (!process.stdin.isTTY || process.env.SEATLOCK_SKIP_PAUSE === "1") return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(
    "\nDatabase now holds the 20 live bookings above — switch to psql and inspect it.\n" +
      "Press Enter here when you're ready to reset the database back to a clean state...",
  );
  rl.close();
}

async function cleanup() {
  await prisma.booking.deleteMany();
  await prisma.seat.updateMany({
    data: { status: "AVAILABLE", lockedBy: null, lockExpiresAt: null },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
}

async function main() {
  console.log(`Resetting database: ${SEATS} seats, 0 bookings...`);
  await cleanup();

  console.log(`Signing up ${USERS} real test accounts...`);
  const cookies = await Promise.all(Array.from({ length: USERS }, (_, i) => signUpTestUser(i)));

  console.log(`Firing ${USERS} concurrent authenticated users at ${SEATS} seats (many users share a seat on purpose)...`);
  const results = await Promise.all(
    cookies.map((cookie, i) => simulateUser(cookie, (i % SEATS) + 1)),
  );

  const booked = results.filter((r) => r.outcome === "booked");
  const lockFailed = results.filter((r) => r.outcome === "lock-failed").length;
  const confirmFailed = results.filter((r) => r.outcome === "confirm-failed").length;

  const dbBookings = await prisma.booking.findMany();
  const uniqueSeatIds = new Set(dbBookings.map((b) => b.seatId));

  console.log("\n--- Results ---");
  console.log(`Successful bookings (API):      ${booked.length}`);
  console.log(`Rejected at lock step:          ${lockFailed}`);
  console.log(`Rejected at confirm step:       ${confirmFailed}`);
  console.log(`Booking rows in DB:              ${dbBookings.length}`);
  console.log(`Unique seats among bookings:     ${uniqueSeatIds.size}`);

  const ok =
    dbBookings.length <= SEATS &&
    uniqueSeatIds.size === dbBookings.length &&
    booked.length === dbBookings.length;

  if (!ok) {
    console.error("\nFAIL: race condition detected (duplicate seat or over-booking).");
    process.exit(1);
  }

  console.log(
    `\nPASS: ${dbBookings.length} seats booked, all unique, cap of ${SEATS} respected under ${USERS} concurrent authenticated users.`,
  );

  await pauseForInspection();

  console.log("\nResetting database back to a clean state for manual demo use...");
  await cleanup();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
