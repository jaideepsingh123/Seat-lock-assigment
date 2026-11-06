import { TOTAL_SEATS } from "@/lib/constants";

export function parseSeatIds(body: unknown): number[] | null {
  if (typeof body !== "object" || body === null || !("seatIds" in body)) return null;
  const { seatIds } = body as { seatIds: unknown };
  if (!Array.isArray(seatIds) || seatIds.length === 0) return null;

  const unique = new Set(seatIds);
  if (unique.size !== seatIds.length) return null;

  const ids: number[] = [];
  for (const id of seatIds) {
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > TOTAL_SEATS) {
      return null;
    }
    ids.push(id);
  }
  return ids;
}
