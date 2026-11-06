import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthenticatedError } from "@/lib/auth";
import { tryConfirmSeat } from "@/lib/seatQueries";
import { parseSeatIds } from "@/lib/validation";

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
      return NextResponse.json({ error: "Log in to confirm a booking." }, { status: 401 });
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

  const userId = session.sub;

  const unavailable = await prisma
    .$transaction(async (tx) => {
      const failed: number[] = [];
      for (const seatId of seatIds) {
        const confirmed = await tryConfirmSeat(tx, seatId, userId);
        if (!confirmed) {
          failed.push(seatId);
          continue;
        }
        // Booking.seatId is unique, so a duplicate insert for an already
        // booked seat is also impossible at the schema level as a second
        // line of defense.
        await tx.booking.create({ data: { seatId, userId } });
      }

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
      {
        error: "One or more locks expired or were lost before confirmation.",
        unavailableSeatIds: unavailable,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ bookedSeatIds: seatIds });
}
