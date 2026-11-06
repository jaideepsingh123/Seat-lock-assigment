import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

/**
 * Reclaims any seat whose 2-minute lock has expired, flipping it back to
 * AVAILABLE. Safe to call concurrently/repeatedly: each row transition is a
 * single conditional UPDATE, so callers racing this never double-release or
 * stomp a lock that was legitimately renewed/confirmed in the meantime.
 */
export async function releaseExpiredLocks(tx: TxClient): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Seat"
    SET status = ${"AVAILABLE"}::"SeatStatus", "lockedBy" = NULL, "lockExpiresAt" = NULL
    WHERE status = ${"LOCKED"}::"SeatStatus" AND "lockExpiresAt" < now()
  `;
}

/**
 * Atomically claims one seat for `userId` if and only if it is currently
 * AVAILABLE or held by an expired lock. Returns true iff this call won the
 * seat. Postgres evaluates the WHERE clause against the row it locks for the
 * UPDATE, so two concurrent callers racing for the same seat can never both
 * succeed: one wins the row lock, commits/releases, and the other's WHERE
 * clause then sees the already-LOCKED-by-someone-else row and matches zero
 * rows.
 */
export async function tryLockSeat(
  tx: TxClient,
  seatId: number,
  userId: string,
  lockExpiresAt: Date,
): Promise<boolean> {
  const affected = await tx.$executeRaw`
    UPDATE "Seat"
    SET status = ${"LOCKED"}::"SeatStatus", "lockedBy" = ${userId}, "lockExpiresAt" = ${lockExpiresAt}
    WHERE id = ${seatId}
      AND (
        status = ${"AVAILABLE"}::"SeatStatus"
        OR (status = ${"LOCKED"}::"SeatStatus" AND "lockExpiresAt" < now())
      )
  `;
  return affected === 1;
}

/**
 * Atomically converts a seat this user currently holds a non-expired lock on
 * into BOOKED. Returns true iff this call confirmed the seat (lock expired,
 * already booked, or held by someone else all return false).
 */
export async function tryConfirmSeat(
  tx: TxClient,
  seatId: number,
  userId: string,
): Promise<boolean> {
  const affected = await tx.$executeRaw`
    UPDATE "Seat"
    SET status = ${"BOOKED"}::"SeatStatus", "lockExpiresAt" = NULL
    WHERE id = ${seatId}
      AND status = ${"LOCKED"}::"SeatStatus"
      AND "lockedBy" = ${userId}
      AND "lockExpiresAt" > now()
  `;
  return affected === 1;
}

/**
 * Atomically releases a seat lock this user holds, returning it to
 * AVAILABLE. Returns true iff this call released it.
 */
export async function tryReleaseSeat(
  tx: TxClient,
  seatId: number,
  userId: string,
): Promise<boolean> {
  const affected = await tx.$executeRaw`
    UPDATE "Seat"
    SET status = ${"AVAILABLE"}::"SeatStatus", "lockedBy" = NULL, "lockExpiresAt" = NULL
    WHERE id = ${seatId}
      AND status = ${"LOCKED"}::"SeatStatus"
      AND "lockedBy" = ${userId}
  `;
  return affected === 1;
}
