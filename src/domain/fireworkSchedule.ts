import { FIREWORK_COLOURS, type Rgb } from "./fireworks.ts";
import { mulberry32 } from "./seededRandom.ts";
import type { ViewBounds } from "./vehiclesInView.ts";

/** Barrages start on every fifth minute of the wall clock. */
export const BARRAGE_INTERVAL_MS = 300_000;
export const BARRAGE = { rockets: 24, durationMs: 10_000 };
/** Replaces the 00:00 barrage of 1 January, Oslo time. */
export const FINALE = { rockets: 72, durationMs: 60_000 };
/** Wait between scattered rockets while someone is at the screen. */
export const SCATTERED_DELAY_MS: [number, number] = [2_000, 4_000];
/** Metres above the ground at which a rocket bursts. */
export const BURST_HEIGHT_M: [number, number] = [60, 120];
/** Share of the view kept clear of launches on every side. */
export const LAUNCH_INSET = 0.15;
/**
 * Share of the screen, from its bottom edge, over whose ground rockets go up.
 * Over the upper part a burst is above the top edge: at pitch 60 the height
 * left in view above the ground falls to nothing at the top of the screen, and
 * the view's box puts most of its area there.
 */
export const LAUNCH_SCREEN_SHARE = 0.6;

export type Slot = { startMs: number; finale: boolean };

const osloParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function isNewYearInOslo(ms: number): boolean {
  const parts: Record<string, string> = {};
  for (const p of osloParts.formatToParts(ms)) parts[p.type] = p.value;
  return (
    Number(parts.month) === 1 &&
    Number(parts.day) === 1 &&
    Number(parts.hour) === 0 &&
    Number(parts.minute) === 0
  );
}

/**
 * The start of the slot containing `nowMs`: cheap, unlike `slotAt`, which
 * formats a date, so it is what callers compare to see whether the slot has
 * changed. Oslo's offset is whole hours, so the UTC floor is the Oslo floor.
 */
export function slotStartMs(nowMs: number): number {
  return Math.floor(nowMs / BARRAGE_INTERVAL_MS) * BARRAGE_INTERVAL_MS;
}

/** The slot containing `nowMs`. */
export function slotAt(nowMs: number): Slot {
  const startMs = slotStartMs(nowMs);
  return { startMs, finale: isNewYearInOslo(startMs) };
}

/** The start of the first slot strictly after `nowMs`. */
export function nextSlotStartMs(nowMs: number): number {
  return slotStartMs(nowMs) + BARRAGE_INTERVAL_MS;
}

export function slotEndMs(slot: Slot): number {
  return slot.startMs + (slot.finale ? FINALE : BARRAGE).durationMs;
}

export type Launch = {
  atMs: number;
  /** Share across the screen, left to right (`launchScreenPoint`). */
  fx: number;
  /** Share up the launch strip, from the screen's bottom edge. */
  fy: number;
  heightM: number;
  colours: [Rgb, Rgb];
  seed: number;
};

function between(random: () => number, [low, high]: [number, number]): number {
  return low + random() * (high - low);
}

function launchFrom(atMs: number, random: () => number): Launch {
  const fx = between(random, [LAUNCH_INSET, 1 - LAUNCH_INSET]);
  const fy = between(random, [LAUNCH_INSET, 1 - LAUNCH_INSET]);
  const heightM = between(random, BURST_HEIGHT_M);
  const first = Math.floor(random() * FIREWORK_COLOURS.length);
  // Drawn from the remaining colours, so the two always differ.
  const second =
    (first + 1 + Math.floor(random() * (FIREWORK_COLOURS.length - 1))) %
    FIREWORK_COLOURS.length;
  const seed = Math.floor(random() * 4294967296);
  return {
    atMs,
    fx,
    fy,
    heightM,
    colours: [FIREWORK_COLOURS[first], FIREWORK_COLOURS[second]],
    seed,
  };
}

/** Every rocket of a slot, deterministic in its start so all screens agree. */
export function slotLaunches(slot: Slot): Launch[] {
  const { rockets, durationMs } = slot.finale ? FINALE : BARRAGE;
  const random = mulberry32(slot.startMs);
  const launches: Launch[] = [];
  for (let i = 0; i < rockets; i++) {
    const atMs = slot.startMs + Math.floor(random() * durationMs);
    launches.push(launchFrom(atMs, random));
  }
  return launches.sort((a, b) => a.atMs - b.atMs);
}

/** One rocket for an active screen, launched now. */
export function scatteredLaunch(nowMs: number, random: () => number): Launch {
  return launchFrom(nowMs, random);
}

export function scatteredDelayMs(random: () => number): number {
  return between(random, SCATTERED_DELAY_MS);
}

/**
 * Longitude and latitude of a share of the view, linear in both: where a
 * launch goes when its screen point could not be placed.
 */
export function launchPoint(
  [[west, south], [east, north]]: ViewBounds,
  fx: number,
  fy: number,
): [number, number] {
  return [west + (east - west) * fx, south + (north - south) * fy];
}

/**
 * The screen point, in pixels, a launch goes up from: `fx` across a `width` ×
 * `height` screen and `fy` up the lower `LAUNCH_SCREEN_SHARE` of the part the
 * map is seen through, from its bottom edge. `bottomPx` is the map's bottom
 * padding, which covers it (the phone's detail sheet, the kiosk's band); the
 * other edges' padding frames the camera rather than covering the map, as the
 * chase's top padding does. Spread evenly on the screen, not on the ground,
 * which tilted would crowd them towards the horizon.
 */
export function launchScreenPoint(
  width: number,
  height: number,
  bottomPx: number,
  fx: number,
  fy: number,
): [number, number] {
  const bottom = Math.max(0, height - bottomPx);
  return [fx * width, bottom - fy * bottom * LAUNCH_SCREEN_SHARE];
}

/** Shares up the launch strip a launch is tried at, its own first. */
const FALLBACK_SHARES = [1, 0.5, 0];

/**
 * The longitude and latitude of a launch, from `groundAt`, the ground under
 * the screen point at a share up the launch strip, kept inside `view`, the
 * view the vehicles use. Tilted past 60° the strip's upper part lies beyond
 * that view, and clamping it to the edge would line those launches up along
 * one side; such a launch is tried lower on the screen instead, keeping its
 * share across. Clamped only when nothing lower is inside either, and spread
 * over the whole view when no point could be placed.
 */
export function placeLaunch(
  groundAt: (fy: number) => [number, number],
  view: ViewBounds,
  fx: number,
  fy: number,
): [number, number] {
  const [[west, south], [east, north]] = view;
  let placed: [number, number] | null = null;
  for (const share of FALLBACK_SHARES) {
    const [lng, lat] = groundAt(fy * share);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      return [lng, lat];
    }
    placed ??= [lng, lat];
  }
  if (placed === null) return launchPoint(view, fx, fy);
  const [lng, lat] = placed;
  return [
    Math.min(east, Math.max(west, lng)),
    Math.min(north, Math.max(south, lat)),
  ];
}

/**
 * The ground height to burst above: `groundM`, the ground under the launch,
 * or the view centre's where there is no elevation data there yet. MapLibre
 * answers 0 for a terrain tile still loading, so the caller passes null
 * there; a 0 that is passed is the sea, and is kept.
 */
export function groundFor(
  groundM: number | null,
  centreGroundM: number | null,
): number {
  return groundM ?? centreGroundM ?? 0;
}
