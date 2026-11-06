export type SeatStatus = "AVAILABLE" | "LOCKED" | "BOOKED";

export type SeatDto = {
  id: number;
  seatNumber: number;
  status: SeatStatus;
  lockExpiresAt: string | null;
  lockedByMe: boolean;
};
