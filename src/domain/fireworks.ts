// The flight of a firework: a rocket climbing to its burst point, then sparks
// flying out under drag and gravity. The shader in `fireworksExtension.ts`
// repeats `rocketRise`, `sparkOffset` and `sparkBrightness`, so change both
// together.

/** Seconds a rocket climbs from launch to its burst. */
export const RISE_S = 1.6;
/** Seconds a spark shines after the burst. */
export const SPARK_LIFE_S = 2.4;
/** Gravity on a spark, m/s². */
export const SPARK_GRAVITY = 9.8;
/** Linear drag on a spark's velocity, 1/s. */
export const SPARK_DRAG = 1.4;
/** Samples in a spark's trail. */
export const TRAIL_SAMPLES = 4;
/** Seconds between a trail sample and the one ahead of it. */
export const TRAIL_LAG_S = 0.05;
/** Launch speed of a spark, m/s, before the 85-105% spread. */
export const SPARK_SPEED = 75;

/** East, north, up, in metres. */
export type Vec3 = [number, number, number];
/** Channels 0-255. */
export type Rgb = [number, number, number];

export const FIREWORK_COLOURS: readonly Rgb[] = [
  [0xff, 0x4d, 0x4d],
  [0xff, 0xd2, 0x3f],
  [0x4d, 0xd2, 0xff],
  [0x7d, 0xff, 0x6a],
  [0xff, 0x7a, 0xf0],
  [0xff, 0xff, 0xff],
  [0xff, 0xa2, 0x3f],
];

/** Share of the burst height climbed `tS` seconds after launch. */
export function rocketRise(tS: number): number {
  const u = Math.min(1, Math.max(0, tS / RISE_S));
  return 1 - (1 - u) * (1 - u);
}

/** Where a spark is, relative to the burst, `tS` seconds after it. */
export function sparkOffset(direction: Vec3, speed: number, tS: number): Vec3 {
  const d = 1 - Math.exp(-SPARK_DRAG * tS);
  const reach = (speed * d) / SPARK_DRAG;
  const fall = (SPARK_GRAVITY / SPARK_DRAG) * (tS - d / SPARK_DRAG);
  return [
    direction[0] * reach,
    direction[1] * reach,
    direction[2] * reach - fall,
  ];
}

/** 1 at the burst, fading to 0 at the end of the spark's life. */
export function sparkBrightness(tS: number): number {
  if (tS < 0) return 0;
  const u = Math.min(1, tS / SPARK_LIFE_S);
  return (1 - u) * (1 - u);
}

export type Spark = { direction: Vec3; speed: number; colour: Rgb };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const JITTER = 0.15;

/** The sparks of one burst, evenly spread with a seeded jitter. */
export function burstSparks(
  seed: number,
  count: number,
  colours: [Rgb, Rgb],
): Spark[] {
  const random = mulberry32(seed);
  const sparks: Spark[] = [];
  for (let i = 0; i < count; i++) {
    const z = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - z * z);
    const phi = i * GOLDEN_ANGLE;
    const x = r * Math.cos(phi) + (random() - 0.5) * JITTER;
    const y = r * Math.sin(phi) + (random() - 0.5) * JITTER;
    const zj = z + (random() - 0.5) * JITTER;
    const length = Math.hypot(x, y, zj);
    sparks.push({
      direction: [x / length, y / length, zj / length],
      speed: SPARK_SPEED * (0.85 + 0.2 * random()),
      colour: i % 3 === 0 ? colours[1] : colours[0],
    });
  }
  return sparks;
}

/** Launch to last light of one rocket. */
export function burstDurationS(): number {
  return RISE_S + SPARK_LIFE_S + TRAIL_SAMPLES * TRAIL_LAG_S;
}
