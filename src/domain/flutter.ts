/** Seconds for the flutter to travel once along the cloth. */
export const FLUTTER_PERIOD_S = 1.6;
/** The flutter's amplitude at the free edge, as a share of the cloth's length. */
export const FLUTTER_AMPLITUDE = 0.12;
/** Wavelengths of the flutter along the cloth. */
export const FLUTTER_WAVES = 1;
/** The still pose's curve at mid-cloth, as a share of the cloth's length. */
export const FLUTTER_STILL = 0.06;

/**
 * Offset across the cloth's own splayed plane, as a share of the cloth's length, of the point
 * `u` along the cloth (0 at the pole, 1 at the free edge). `amount` 0 is the
 * still pose, 1 the full flutter. The shader reproduces this curve exactly,
 * so change both together.
 */
export function flutterOffset(
  timeS: number,
  phase: number,
  u: number,
  amount: number,
): number {
  const travelling = Math.sin(
    2 * Math.PI * (timeS / FLUTTER_PERIOD_S + phase - FLUTTER_WAVES * u),
  );
  return (
    u *
    (FLUTTER_STILL * Math.sin(Math.PI * u) +
      amount * FLUTTER_AMPLITUDE * travelling)
  );
}
