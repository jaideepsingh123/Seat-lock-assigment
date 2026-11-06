import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthenticatedError } from "@/lib/auth";
import { tryReleaseSeat } from "@/lib/seatQueries";
import { parseSeatIds } from "@/lib/validation";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Log in to manage a reservation." }, { status: 401 });
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
  const released = await prisma.$transaction(async (tx) => {
    const ok: number[] = [];
    for (const seatId of seatIds) {
      if (await tryReleaseSeat(tx, seatId, userId)) ok.push(seatId);
    }
    return ok;
  });

  return NextResponse.json({ releasedSeatIds: released });
}
