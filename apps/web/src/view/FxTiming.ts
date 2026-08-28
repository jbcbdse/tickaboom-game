export const PLACE_MS = 140;
export const FLIGHT_MS = 420;
export const ROUND_MS = 500;
export const MIN_FLIGHT_MS = 200;

export function roundFlightMs(count: number): number {
  if (count <= 1) {
    return FLIGHT_MS;
  }
  return Math.max(MIN_FLIGHT_MS, Math.round(ROUND_MS * 0.6));
}

export function roundDelayMs(index: number, count: number): number {
  if (count <= 1) {
    return 0;
  }
  return (index / (count - 1)) * (ROUND_MS - roundFlightMs(count));
}
