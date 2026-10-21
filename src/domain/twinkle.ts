/** Seconds for one group of bulbs to fade down and back up. */
export const TWINKLE_PERIOD_S = 3;
/** The dimmest a bulb gets, as a share of full brightness. */
export const TWINKLE_MIN = 0.35;

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
