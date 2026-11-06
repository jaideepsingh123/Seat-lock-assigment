import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { releaseExpiredLocks } from "@/lib/seatQueries";

export async function GET(req: NextRequest) {
  const session = await getSession(req);

  await releaseExpiredLocks(prisma);

  const seats = await prisma.seat.findMany({
    orderBy: { seatNumber: "asc" },
  });

  return NextResponse.json({
    email: session?.email ?? null,
    seats: seats.map((s) => ({
      id: s.id,
      seatNumber: s.seatNumber,
      status: s.status,
      lockExpiresAt: s.lockExpiresAt,
      lockedByMe: session !== null && s.lockedBy === session.sub,
    })),
  });
}
