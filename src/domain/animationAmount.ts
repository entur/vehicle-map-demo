/** Time without activity before a seasonal animation begins to settle. */
export const ANIMATION_IDLE_MS = 60_000;
/** How long an animation takes to ease to steady once it settles. */
export const ANIMATION_SETTLE_MS = 1_000;

/**
 * How much of a seasonal animation to show: 1 while active, easing to 0 over
 * ANIMATION_SETTLE_MS after ANIMATION_IDLE_MS without activity; 0 under reduced
 * motion.
 */
export function animationAmount(
  nowMs: number,
  lastActivityMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0;
  const t = Math.min(
    1,
    Math.max(
      0,
      (nowMs - lastActivityMs - ANIMATION_IDLE_MS) / ANIMATION_SETTLE_MS,
    ),
  );
  return 1 - t * t * (3 - 2 * t);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * How much of a seasonal animation to show after waking at `wakeMs` with `fromAmount` showing:
 * the same ease as the settle, run upwards, so an animation that had settled (or
 * was settling) fades back in instead of jumping to it. 1 once
 * ANIMATION_SETTLE_MS has passed.
 */
export function animationWake(
  nowMs: number,
  wakeMs: number,
  fromAmount: number,
): number {
  const t = Math.min(1, Math.max(0, (nowMs - wakeMs) / ANIMATION_SETTLE_MS));
  return fromAmount + (1 - fromAmount) * smoothstep(t);
}
