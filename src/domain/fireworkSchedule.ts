import { FIREWORK_COLOURS, mulberry32, type Rgb } from "./fireworks.ts";
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

/** The slot containing `nowMs`. Oslo's offset is whole hours, so the UTC floor is the Oslo floor. */
export function slotAt(nowMs: number): Slot {
  const startMs = Math.floor(nowMs / BARRAGE_INTERVAL_MS) * BARRAGE_INTERVAL_MS;
  return { startMs, finale: isNewYearInOslo(startMs) };
}

/** The start of the first slot strictly after `nowMs`. */
export function nextSlotStartMs(nowMs: number): number {
  return (Math.floor(nowMs / BARRAGE_INTERVAL_MS) + 1) * BARRAGE_INTERVAL_MS;
}

export function slotEndMs(slot: Slot): number {
  return slot.startMs + (slot.finale ? FINALE : BARRAGE).durationMs;
}

export type Launch = {
  atMs: number;
  /** Share of the view's width, west to east. */
  fx: number;
  /** Share of the view's height, south to north. */
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
  // Drawn from the remaining colours, so the two usually differ.
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

/** Longitude and latitude of a share of the view, linear in both. */
export function launchPoint(
  [[west, south], [east, north]]: ViewBounds,
  fx: number,
  fy: number,
): [number, number] {
  return [west + (east - west) * fx, south + (north - south) * fy];
}

/**
 * The screen points, in pixels, whose ground the launches spread over: the
 * corners of the lower `LAUNCH_SCREEN_SHARE` of the part of a `width` ×
 * `height` screen the map is seen through, top left, top right, bottom left,
 * bottom right. `bottomPx` is the map's bottom padding, which covers it (the
 * phone's detail sheet, the kiosk's band); the other edges' padding frames the
 * camera rather than covering the map, as the chase's top padding does.
 */
export function launchStrip(
  width: number,
  height: number,
  bottomPx = 0,
): [Corner, Corner, Corner, Corner] {
  const bottom = Math.max(0, height - bottomPx);
  const top = bottom * (1 - LAUNCH_SCREEN_SHARE);
  return [
    [0, top],
    [width, top],
    [0, bottom],
    [width, bottom],
  ];
}

type Corner = [number, number];

/**
 * Where rockets may go up: `strip`, the ground under `launchStrip`'s corners
 * as longitude and latitude in the same order, and `view`, the view the
 * vehicles use.
 */
export type LaunchArea = {
  strip: [Corner, Corner, Corner, Corner];
  view: ViewBounds;
};

/**
 * The longitude and latitude of a launch: `fx` across the screen, `fy` up from
 * its bottom edge, interpolated over the strip's own four corners rather than
 * over their box, which on a turned map (a chase follows the vehicle's
 * heading) is up to twice the strip and reaches off screen. A point outside
 * the view the vehicles use is moved to its edge; a corner that could not be
 * placed leaves the whole view.
 */
export function launchPointIn(
  { strip, view }: LaunchArea,
  fx: number,
  fy: number,
): [number, number] {
  if (
    !strip.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
  ) {
    return launchPoint(view, fx, fy);
  }
  const [tl, tr, bl, br] = strip;
  const lerp = (a: Corner, b: Corner, f: number): Corner => [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
  ];
  const [lng, lat] = lerp(lerp(bl, br, fx), lerp(tl, tr, fx), fy);
  const [[west, south], [east, north]] = view;
  return [
    Math.min(east, Math.max(west, lng)),
    Math.min(north, Math.max(south, lat)),
  ];
}

/**
 * The ground height to burst above. MapLibre answers 0 (or null) for a
 * terrain tile still loading, so a non-positive reading falls back to the
 * view centre's.
 */
export function groundFor(
  groundM: number | null,
  centreGroundM: number | null,
): number {
  if (groundM !== null && groundM > 0) return groundM;
  return Math.max(centreGroundM ?? 0, 0);
}
