import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.booking.deleteMany();
  await prisma.seat.updateMany({
    data: { status: "AVAILABLE", lockedBy: null, lockExpiresAt: null },
  });
  console.log("All seats reset to AVAILABLE and bookings cleared.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
