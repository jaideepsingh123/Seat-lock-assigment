import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthenticatedError } from "@/lib/auth";
import { releaseExpiredLocks, tryLockSeat } from "@/lib/seatQueries";
import { parseSeatIds } from "@/lib/validation";
import { LOCK_DURATION_MS } from "@/lib/constants";

class SeatsUnavailableError extends Error {
  constructor(public seatIds: number[]) {
    super("Seats unavailable");
  }
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Log in to lock seats." }, { status: 401 });
    }
    throw err;
  }

  const seatIds = parseSeatIds(await req.json().catch(() => null));
  if (!seatIds) {
    return NextResponse.json(
      { error: "Invalid request: seatIds must be a non-empty array of unique seat ids." },
      { status: 400 },
    );
  }

  const lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  const userId = session.sub;

  const unavailable = await prisma
    .$transaction(async (tx) => {
      await releaseExpiredLocks(tx);

      const failed: number[] = [];
      for (const seatId of seatIds) {
        const won = await tryLockSeat(tx, seatId, userId, lockExpiresAt);
        if (!won) failed.push(seatId);
      }

      // All-or-nothing: if any requested seat couldn't be claimed, roll the
      // whole transaction back so we never leave the user holding a partial
      // selection.
      if (failed.length > 0) {
        throw new SeatsUnavailableError(failed);
      }
      return failed;
    })
    .catch((err) => {
      if (err instanceof SeatsUnavailableError) return err.seatIds;
      throw err;
    });

  if (unavailable.length > 0) {
    return NextResponse.json(
      { error: "One or more selected seats are no longer available.", unavailableSeatIds: unavailable },
      { status: 409 },
    );
  }

  return NextResponse.json({ lockedSeatIds: seatIds, lockExpiresAt });
}
