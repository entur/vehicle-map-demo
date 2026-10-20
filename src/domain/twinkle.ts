/** Seconds for one group of bulbs to fade down and back up. */
export const TWINKLE_PERIOD_S = 3;
/** The dimmest a bulb gets, as a share of full brightness. */
export const TWINKLE_MIN = 0.35;
/** Time without activity before the twinkle begins to settle. */
export const TWINKLE_IDLE_MS = 60_000;
/** How long the twinkle takes to ease to steady once it settles. */
export const TWINKLE_SETTLE_MS = 1_000;

/**
 * Brightness 0–1 of `group` (of `groups`) on a tree with `phase`, at `timeS`;
 * `amount` 0 = steady fully lit, 1 = full twinkle. The shader reproduces this
 * curve exactly, so change both together.
 */
export function twinkleBrightness(
  timeS: number,
  phase: number,
  group: number,
  groups: number,
  amount: number,
): number {
  const wave =
    0.5 -
    0.5 *
      Math.cos(
        2 * Math.PI * (timeS / TWINKLE_PERIOD_S + phase + group / groups),
      );
  return 1 - amount * (1 - TWINKLE_MIN) * wave;
}

/**
 * How much twinkle to show: 1 while active, easing to 0 over
 * TWINKLE_SETTLE_MS after TWINKLE_IDLE_MS without activity; 0 under reduced
 * motion.
 */
export function twinkleAmount(
  nowMs: number,
  lastActivityMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0;
  const t = Math.min(
    1,
    Math.max(0, (nowMs - lastActivityMs - TWINKLE_IDLE_MS) / TWINKLE_SETTLE_MS),
  );
  return 1 - t * t * (3 - 2 * t);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * How much twinkle to show after waking at `wakeMs` with `fromAmount` showing:
 * the same ease as the settle, run upwards, so lights that had settled (or
 * were settling) fade back into the twinkle instead of jumping to it. 1 once
 * TWINKLE_SETTLE_MS has passed.
 */
export function twinkleWake(
  nowMs: number,
  wakeMs: number,
  fromAmount: number,
): number {
  const t = Math.min(1, Math.max(0, (nowMs - wakeMs) / TWINKLE_SETTLE_MS));
  return fromAmount + (1 - fromAmount) * smoothstep(t);
}
