# SeatLock — Concurrent Train Seat Booking System

A single train coach with 20 seats. Up to 100 users can try to book at the
same time; the system guarantees **no more than 20 confirmed seats and no
seat ever assigned to two people**, with a 2-minute temporary lock during
checkout.

> **Stack note:** the original assignment brief specified React.js +
> Java 17/Spring Boot + JPA/Hibernate. This implementation instead uses
> **Next.js (App Router, TypeScript) + Tailwind CSS** for the frontend, with
> Next.js **Route Handlers** acting as the REST API/"backend", **Prisma**
> for the ORM/migrations, and **PostgreSQL running in Docker**. The
> concurrency/consistency guarantees, locking model, and all functional
> requirements are implemented to the same standard regardless of stack.

## Tech stack

| Layer        | Technology                                   |
| ------------ | --------------------------------------------- |
| Frontend     | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| API/"backend"| Next.js Route Handlers (REST-style JSON API)  |
| Database     | PostgreSQL 16 (Docker)                        |
| ORM/Migrations | Prisma 6                                    |

## Project structure

```
prisma/
  schema.prisma          # User + Seat + Booking models
  migrations/             # SQL migration history
  seed.ts                 # seeds 20 AVAILABLE seats
  reset.ts                # clears bookings, resets all seats to AVAILABLE
src/
  app/
    page.tsx               # seat map UI, checkout flow, countdown
    login/page.tsx          # login / signup form
    api/
      auth/signup/route.ts   # POST /api/auth/signup
      auth/login/route.ts    # POST /api/auth/login
      auth/logout/route.ts   # POST /api/auth/logout
      auth/me/route.ts       # GET  /api/auth/me
      seats/route.ts        # GET  /api/seats
      seats/lock/route.ts   # POST /api/seats/lock       (auth required)
      bookings/confirm/route.ts  # POST /api/bookings/confirm (auth required)
      bookings/cancel/route.ts   # POST /api/bookings/cancel  (auth required)
      bookings/route.ts     # GET  /api/bookings (history, auth required)
  components/              # Seat, SeatMap, CountdownTimer
  lib/
    seatQueries.ts          # the atomic, race-safe seat state transitions
    auth.ts                  # password hashing, JWT session cookies
    prisma.ts, constants.ts, validation.ts, types.ts
scripts/
  concurrency-test.ts      # signs up + fires 100 real authenticated users at 20 seats
  verify-expiry.ts         # proves expired locks are rejected and reclaimed
docker-compose.yml          # PostgreSQL service
```

## Local setup

Prerequisites: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# (defaults work out of the box; edit if port 5433 is taken)

# 3. Start PostgreSQL in Docker
docker compose up -d

# 4. Apply migrations (creates the schema)
npx prisma migrate deploy

# 5. Seed 20 seats
npm run seed

# 6. Run the app
npm run dev
```

Open http://localhost:3000.

> The Postgres container publishes on host port **5433** (not 5432), to
> avoid colliding with any other local Postgres instance. Adjust
> `docker-compose.yml` and `.env` together if you change it.

To wipe all bookings and reset every seat to `AVAILABLE` between demo runs:

```bash
npm run db:reset
```

## Authentication

Booking a seat requires a real account — email + password, hashed with
bcrypt and stored in Postgres, with a signed, httpOnly JWT session cookie
(`seatlock_session`, via [`jose`](https://github.com/panva/jose)). This
closes the obvious abuse path an anonymous-cookie scheme has: without login,
clearing cookies or opening an incognito window gets you a brand new
anonymous identity and lets you lock/book seats indefinitely. With real
accounts, a fresh identity means a fresh email address and password, not a
free action.

- Browsing the seat map (`GET /api/seats`) is public — no login needed to
  look.
- Locking, confirming, and cancelling a seat **require a logged-in
  session** — the API returns `401` otherwise, and the UI redirects to
  `/login`.
- No cap is enforced on how many seats one logged-in account can hold —
  only that you must be authenticated to act at all.
- Passwords need 8+ characters; there's no email verification or password
  reset flow (out of scope for this assignment — flag it as a known gap if
  this were going to production).

## API overview

All endpoints are JSON over HTTP.

| Method | Path                     | Auth | Description                                             |
| ------ | ------------------------ | ---- | --------------------------------------------------------- |
| POST   | `/api/auth/signup`       | —    | `{ email, password }` — create an account, starts a session |
| POST   | `/api/auth/login`        | —    | `{ email, password }` — starts a session                   |
| POST   | `/api/auth/logout`       | —    | Clears the session cookie                                  |
| GET    | `/api/auth/me`           | —    | `{ email: string \| null }` — current session, if any      |
| GET    | `/api/seats`             | —    | Current status of all 20 seats (also reclaims expired locks) |
| POST   | `/api/seats/lock`        | ✅   | `{ seatIds: number[] }` — lock seats for 2 minutes         |
| POST   | `/api/bookings/confirm`  | ✅   | `{ seatIds: number[] }` — confirm a held lock into a booking |
| POST   | `/api/bookings/cancel`   | ✅   | `{ seatIds: number[] }` — release a held lock early         |
| GET    | `/api/bookings`          | ✅   | Booking history (bonus)                                    |

Error responses use `{ "error": string, "unavailableSeatIds"?: number[] }`
with HTTP 401 for missing/invalid auth, 409 for seat conflicts, and 400 for
malformed input.

A Postman collection is included at [`docs/SeatLock.postman_collection.json`](docs/SeatLock.postman_collection.json).

## How duplicate bookings and race conditions are prevented

The core risk is two requests racing to lock/confirm the *same* seat, or the
system letting more than 20 seats end up `BOOKED`. This is solved **without**
explicit `SELECT ... FOR UPDATE` or optimistic-lock retry loops, by making
every state transition a single, atomic, conditional SQL statement:

```sql
UPDATE "Seat"
SET status = 'LOCKED', "lockedBy" = $userId, "lockExpiresAt" = $expiry
WHERE id = $seatId
  AND (status = 'AVAILABLE' OR (status = 'LOCKED' AND "lockExpiresAt" < now()));
```

Postgres takes the row lock for this seat as part of executing the `UPDATE`
itself. If two requests race for the same seat:

1. Whichever transaction's `UPDATE` reaches Postgres first acquires the row
   lock and (assuming the seat is `AVAILABLE`) applies the change.
2. The second transaction's `UPDATE` blocks on the same row until the first
   commits.
3. Once unblocked, Postgres re-evaluates the second transaction's `WHERE`
   clause against the **now-current** row — which is `LOCKED` by someone
   else and not expired — so it matches **zero rows**.
4. The app checks the affected-row count: `1` → "you got it", `0` → "seat
   unavailable", and reports that to the caller.

The same pattern is used for `LOCKED → BOOKED` (confirm) and `LOCKED →
AVAILABLE` (cancel/expiry), each additionally scoped by `"lockedBy" =
$userId` so only the lock's owner can confirm or cancel it, and (for
confirm) `"lockExpiresAt" > now()` so an expired lock can never be confirmed.

**Multi-seat checkout** (locking several seats at once) wraps each seat's
atomic `UPDATE` inside one Prisma interactive transaction. If any requested
seat fails its condition, the whole transaction throws and rolls back — the
caller gets a clean "these seats are unavailable" response instead of
holding a partial selection.

**Defense in depth:** `Booking.seatId` is also a `UNIQUE` database
constraint, so even a bug in the application logic could not produce two
`Booking` rows for the same seat — the database itself would reject it.

**Lock expiry** is handled lazily rather than with a background
scheduler: every `GET /api/seats` call (and every lock attempt) first runs a
cleanup `UPDATE` that flips any `LOCKED` seat whose `lockExpiresAt` has
passed back to `AVAILABLE`. This keeps the implementation simple while still
being correct under concurrency, since the cleanup query is itself one
atomic conditional `UPDATE`.

**Verification:**
- [`scripts/concurrency-test.ts`](scripts/concurrency-test.ts) signs up 100
  **real accounts** (so it exercises the same auth-gated path a real person
  hits) and fires lock+confirm requests concurrently at the 20 seats
  (intentionally oversubscribed so many users collide on the same seat),
  then asserts against the database that exactly ≤20 `Booking` rows exist
  and every `seatId` is unique. It cleans up its own test accounts and
  resets the database afterward.
- [`scripts/verify-expiry.ts`](scripts/verify-expiry.ts) locks a seat,
  backdates its `lockExpiresAt` to simulate the 2-minute window passing,
  then asserts that confirming it is rejected with `409` and that the next
  `GET /api/seats` reclaims it back to `AVAILABLE`.

## Manual demo checklist (maps to the assignment's §4)

With the dev server running and a clean DB (`npm run db:reset`):

0. **Sign up / log in** — go to `/login`, create an account (email + 8+
   char password). You're redirected back to the seat map, now showing your
   email and a "Log out" button top-right.
1. **Lock a seat** — click an available seat, click "Checkout". It turns
   blue and a 2:00 countdown appears.
2. **Confirm a booking** — click "Confirm booking"; the seat turns grey
   (`BOOKED`) and stays that way after a refresh.
3. **Cancel / let a lock expire** — lock a different seat and click
   "Cancel" (seat returns to available immediately), or lock a seat and
   wait 2 minutes without confirming (the countdown hits 0, the UI releases
   it, and the seat becomes available again within the next poll).
4. **Conflict error** — open a second browser (or incognito window), sign
   up a *different* account, and try to select a seat the first account has
   locked; the click is disabled. Hitting the lock API directly for that
   seat (see Postman collection) returns `409` with `unavailableSeatIds`.
   Trying to lock/book **without logging in at all** returns `401`.
5. **Concurrent load test** — with the dev server running:
   ```bash
   npm run concurrency-test
   ```
   Confirms ≤20 bookings, all unique seats, under 100 simulated concurrent
   users, then resets the database back to a clean state.

## Testing

```bash
npm run concurrency-test   # 100-user race-condition / cap test (see above)
npm run verify-expiry       # lock-expiry rejection / reclaim test (see above)
npx tsc --noEmit            # type-check
npm run build                # production build
```

## Submission notes

- Database schema/migrations: see `prisma/schema.prisma` and
  `prisma/migrations/` (`20261105162047_init` for seats/bookings,
  `20261106110135_add_user_auth` for accounts).
- API documentation: see **API overview** above and the Postman collection
  in `docs/`.
- No secrets are committed; `.env` is gitignored and `.env.example` holds
  only local-dev defaults (`seatlock` / `seatlock`, and a placeholder
  `AUTH_SECRET` with instructions to generate your own).
