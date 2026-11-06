import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthenticatedError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireSession(req);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Log in to view booking history." }, { status: 401 });
    }
    throw err;
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: { seat: { select: { seatNumber: true } }, user: { select: { email: true } } },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      seatNumber: b.seat.seatNumber,
      email: b.user.email,
      createdAt: b.createdAt,
    })),
  });
}
