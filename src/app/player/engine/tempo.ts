/**
 * Virtual-clock pacing, extracted as a pure function so the speed scale is
 * testable in isolation.
 *
 * `BASE_TEMPO` rebases the whole scale: at 1× the player now runs
 * `BASE_TEMPO`× slower than the raw `At` gap between two steps (founder round 2:
 * "the new 1× must be at least 2× slower"). Every preset stop divides that base
 * pace, so 0.2× is the slowest, unhurried read and 4× the quickest skim.
 */
export const BASE_TEMPO = 2.4;

/** Raw inter-step gap is clamped into this window before the tempo is applied. */
export const MIN_GAP_MS = 380;
export const MAX_GAP_MS = 2600;

/**
 * Delay (ms) the engine waits before advancing to the next step, given the raw
 * `At` gap (ms) between the two steps and the current speed stop.
 */
export function frameDelayMs(gapMs: number, speed: number): number {
  const clamped = Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, gapMs || MIN_GAP_MS));
  return (clamped * BASE_TEMPO) / speed;
}
