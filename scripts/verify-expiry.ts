import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";
const EMAIL = `verify-expiry-${Date.now()}@test.seatlock`;

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/seatlock_session=[^;]+/);
  if (!match) throw new Error(`No session cookie in response (status ${res.status})`);
  return match[0];
}

async function call(path: string, cookie: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function cleanup() {
  await prisma.booking.deleteMany();
  await prisma.seat.updateMany({ data: { status: "AVAILABLE", lockedBy: null, lockExpiresAt: null } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}

async function main() {
  await cleanup();

  console.log("0. Signing up a test account...");
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "verify-expiry-password" }),
  });
  if (!signupRes.ok) throw new Error(`Signup failed: ${signupRes.status} ${await signupRes.text()}`);
  const cookie = extractSessionCookie(signupRes);

  console.log("1. Lock seat 5:", await call("/api/seats/lock", cookie, { seatIds: [5] }));

  // Simulate the 2-minute window already having passed.
  await prisma.seat.update({
    where: { id: 5 },
    data: { lockExpiresAt: new Date(Date.now() - 1000) },
  });
  console.log("2. Backdated lockExpiresAt to the past (simulating expiry).");

  const confirmResult = await call("/api/bookings/confirm", cookie, { seatIds: [5] });
  console.log("3. Attempt confirm on expired lock:", confirmResult);
  if (confirmResult.status !== 409) throw new Error("Expected 409 for expired lock confirmation");

  const seatsRes = await fetch(`${BASE_URL}/api/seats`, { headers: { Cookie: cookie } });
  const seatsData = await seatsRes.json();
  const seat5 = seatsData.seats.find((s: { id: number }) => s.id === 5);
  console.log("4. Seat 5 status after GET /api/seats (should be AVAILABLE):", seat5.status);
  if (seat5.status !== "AVAILABLE") throw new Error("Expected seat to be released after expiry");

  console.log("\nPASS: expired locks are rejected on confirm and reclaimed as AVAILABLE.");

  await cleanup();
}

main()
  .catch((err) => {
    console.error("FAIL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
