import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TOTAL_SEATS = 20;

async function main() {
  for (let seatNumber = 1; seatNumber <= TOTAL_SEATS; seatNumber++) {
    await prisma.seat.upsert({
      where: { seatNumber },
      update: {},
      create: { seatNumber },
    });
  }
  console.log(`Seeded ${TOTAL_SEATS} seats.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
