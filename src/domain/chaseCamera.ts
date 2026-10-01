import { METRES_PER_DEGREE_LAT, normaliseBearing } from "./vehicleFootprint.ts";
import { ROTATION_STEP } from "./viewDimension.ts";

/**
 * One position report for the chased vehicle, timed by when it arrived here.
 * Arrival time rather than `lastUpdated` is the playback timeline: the latter
 * has one-second resolution, too coarse for publishers reporting every second,
 * and arrival time already folds in the feed's latency and any clock skew.
 */
export type ChaseSample = {
  received: number;
  lastUpdated: string;
  lon: number;
  lat: number;
  bearing: number | null;
};

export type LngLat = { lon: number; lat: number };

/**
 * A vehicle whose median report interval is at most this is played back from
 * a buffer. Measured on dev, the fast publishers (ATB, VOT, INN, BRA, KOL, most
 * of MOR) report every 1–3 s; the next tier up is 20 s, where buffering would
 * put the camera 20 s behind the vehicle.
 */
export const FAST_INTERVAL_MS = 5000;

/** Reports kept per chased vehicle; enough for a stable median interval. */
const MAX_SAMPLES = 12;

/** Intervals considered when sizing the playback delay. */
const RECENT_INTERVALS = 8;

/** Slack on top of the longest recent interval, for arrival jitter. */
const PLAYBACK_MARGIN_MS = 250;

/** Below this, movement between two reports is GPS noise, not a heading. */
const MIN_HEADING_METRES = 3;

export function addSample(
  samples: ChaseSample[],
  sample: ChaseSample,
  max = MAX_SAMPLES,
): ChaseSample[] {
  const last = samples[samples.length - 1];
  if (
    last &&
    last.lastUpdated === sample.lastUpdated &&
    last.lon === sample.lon &&
    last.lat === sample.lat
  ) {
    return samples;
  }
  const next = [...samples, sample];
  return next.length > max ? next.slice(next.length - max) : next;
}

export type Cadence = {
  medianIntervalMs: number;
  fast: boolean;
  /** How far behind real time a buffered vehicle is played back. */
  playbackDelayMs: number;
};

export function cadenceOf(samples: ChaseSample[]): Cadence | null {
  if (samples.length < 3) return null;
  const intervals = samples
    .slice(1)
    .map((s, i) => s.received - samples[i].received);
  const sorted = [...intervals].sort((a, b) => a - b);
  const medianIntervalMs = sorted[Math.floor(sorted.length / 2)];
  const longestRecent = Math.max(...intervals.slice(-RECENT_INTERVALS));
  return {
    medianIntervalMs,
    fast: medianIntervalMs <= FAST_INTERVAL_MS,
    playbackDelayMs: Math.min(
      FAST_INTERVAL_MS,
      longestRecent + PLAYBACK_MARGIN_MS,
    ),
  };
}

export type ChasePosition = LngLat & {
  /** Degrees clockwise from north in [0, 360), or null when unknown. */
  heading: number | null;
  /** True when the time fell outside the buffer and was held at its end. */
  clamped: boolean;
};

export function distanceMetres(a: LngLat, b: LngLat): number {
  const north = (b.lat - a.lat) * METRES_PER_DEGREE_LAT;
  const east =
    (b.lon - a.lon) *
    METRES_PER_DEGREE_LAT *
    Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(north, east);
}

/** Initial great-circle bearing from `a` to `b`, in [0, 360). */
export function bearingBetween(a: LngLat, b: LngLat): number {
  const r = Math.PI / 180;
  const dLon = (b.lon - a.lon) * r;
  const y = Math.sin(dLon) * Math.cos(b.lat * r);
  const x =
    Math.cos(a.lat * r) * Math.sin(b.lat * r) -
    Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dLon);
  return (((Math.atan2(y, x) / r) % 360) + 360) % 360;
}

/**
 * Heading over one segment: the direction of travel when the vehicle moved
 * far enough for that to mean something, otherwise the published bearing.
 */
function segmentHeading(from: ChaseSample, to: ChaseSample): number | null {
  if (distanceMetres(from, to) >= MIN_HEADING_METRES) {
    return bearingBetween(from, to);
  }
  return normaliseBearing(to.bearing);
}

export function positionAt(
  samples: ChaseSample[],
  time: number,
): ChasePosition | null {
  if (samples.length === 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];

  if (samples.length === 1) {
    return {
      lon: first.lon,
      lat: first.lat,
      heading: normaliseBearing(first.bearing),
      clamped: true,
    };
  }
  if (time <= first.received) {
    return {
      lon: first.lon,
      lat: first.lat,
      heading: segmentHeading(first, samples[1]),
      clamped: true,
    };
  }
  if (time >= last.received) {
    return {
      lon: last.lon,
      lat: last.lat,
      heading: segmentHeading(samples[samples.length - 2], last),
      clamped: true,
    };
  }

  const i = samples.findIndex((s) => s.received > time);
  const from = samples[i - 1];
  const to = samples[i];
  const t = (time - from.received) / (to.received - from.received);
  return {
    lon: from.lon + (to.lon - from.lon) * t,
    lat: from.lat + (to.lat - from.lat) * t,
    heading: segmentHeading(from, to),
    clamped: false,
  };
}

/** Playback runs at no less than this share of real time while falling back… */
const MIN_PLAYBACK_RATE = 0.5;
/** …and no more than this while catching up. */
const MAX_PLAYBACK_RATE = 1.5;
/** Within the rate limits, a gap to the target closes with this time constant. */
const PLAYBACK_CATCHUP_MS = 700;
/** A gap larger than this is jumped, not crawled — after a stalled tab, say. */
const PLAYBACK_RESYNC_MS = 5000;

/**
 * The next playback time, moved `dtMs` of real time on and nudged toward
 * `target` by running a little slow or fast. The target moves whenever the
 * playback delay does, which tracks the longest recent report interval: one
 * late report moves it a second or more into the past in a single frame.
 * Jumping there would run the camera backwards along the road; running at
 * half speed for a couple of seconds does not.
 */
export function advancePlaybackTime(
  previous: number | null,
  dtMs: number,
  target: number,
): number {
  if (previous === null || Math.abs(target - previous) > PLAYBACK_RESYNC_MS) {
    return target;
  }
  const error = target - (previous + dtMs);
  const rate = Math.min(
    MAX_PLAYBACK_RATE,
    Math.max(MIN_PLAYBACK_RATE, 1 + error / PLAYBACK_CATCHUP_MS),
  );
  return previous + dtMs * rate;
}

export type ChaseTarget = ChasePosition & {
  buffered: boolean;
  cadence: Cadence | null;
  /** The buffered playback time, to carry into the next frame; null if not buffered. */
  playbackTime: number | null;
};

export type PlaybackClock = {
  /** The previous frame's `playbackTime`. */
  previous: number | null;
  dtMs: number;
};

/**
 * Where the camera should be aimed at `now`. A fast vehicle is played back
 * through its buffer, about `playbackDelayMs` behind real time, so it moves
 * continuously between reports; pass the previous frame's clock so playback
 * eases between delays instead of jumping. Anything else — including a vehicle
 * whose cadence is not yet known — is aimed at its newest report, and the
 * caller glides there.
 */
export function chaseTarget(
  samples: ChaseSample[],
  now: number,
  clock: PlaybackClock = { previous: null, dtMs: 0 },
): ChaseTarget | null {
  const cadence = cadenceOf(samples);
  const buffered = cadence?.fast ?? false;
  // The clock stops at the newest report rather than running on past it: a
  // late report would otherwise make the position jump forward on arrival, by
  // however long the clock had run on. Stopped, playback resumes from that
  // report and catches up at the capped rate instead.
  const playbackTime = buffered
    ? Math.min(
        advancePlaybackTime(
          clock.previous,
          clock.dtMs,
          now - cadence!.playbackDelayMs,
        ),
        samples[samples.length - 1].received,
      )
    : null;
  const position = positionAt(samples, playbackTime ?? Infinity);
  return position && { ...position, buffered, cadence, playbackTime };
}

/** Moves `current` towards `target` by `alpha` along the shorter arc; [0, 360). */
export function smoothAngle(
  current: number,
  target: number,
  alpha: number,
): number {
  const diff = ((((target - current) % 360) + 540) % 360) - 180;
  return (((current + diff * alpha) % 360) + 360) % 360;
}

/** Frame-rate independent exponential smoothing factor. */
export function smoothingAlpha(dtMs: number, timeConstantMs: number): number {
  return 1 - Math.exp(-dtMs / timeConstantMs);
}

/**
 * The smallest half-height of the subscription box while chasing. Measured,
 * the default chase camera (zoom 17.5, pitch 60°) shows about 1 km ahead.
 */
export const CHASE_BOX_MIN_HALF_SIZE_M = 2000;

/** The box is recentred once the vehicle leaves this share of its middle. */
const RECENTRE_FRACTION = 0.5;

/** A box up to this many times the needed size is kept rather than shrunk. */
const MAX_OVERSIZE = 2;

/**
 * The vehicle subscription's bounding box while chasing, given how far the
 * view reaches from the vehicle. A pitched camera's viewport bounds balloon
 * toward the horizon, and a camera that moves every frame would re-open the
 * subscription continuously, so the chase uses a box around the vehicle
 * instead, returned unchanged (same identity) until the vehicle nears its
 * edge or the view outgrows it.
 *
 * It is sized to twice the view's reach, with the vehicle allowed to drift
 * half-way to the edge, so what is on screen stays inside it. Sized larger,
 * every vehicle frame carries — and the map re-processes — vehicles far out
 * of sight: a fixed ±5.5 km box put about 250 vehicles through the model and
 * marker layers on every frame in central Trondheim, for a view showing a few.
 */
export function chaseBoundingBox(
  box: number[][] | undefined,
  lon: number,
  lat: number,
  viewReachMetres: number,
): number[][] {
  const neededHalfLat =
    Math.max(CHASE_BOX_MIN_HALF_SIZE_M, 2 * viewReachMetres) /
    METRES_PER_DEGREE_LAT;
  if (box) {
    const [[minLon, minLat], [maxLon, maxLat]] = box;
    const boxHalfLat = (maxLat - minLat) / 2;
    const boxHalfLon = (maxLon - minLon) / 2;
    if (
      boxHalfLat >= neededHalfLat - 1e-9 &&
      boxHalfLat <= neededHalfLat * MAX_OVERSIZE &&
      Math.abs(lat - (minLat + boxHalfLat)) <= boxHalfLat * RECENTRE_FRACTION &&
      Math.abs(lon - (minLon + boxHalfLon)) <= boxHalfLon * RECENTRE_FRACTION
    ) {
      return box;
    }
  }
  const halfLon = neededHalfLat / Math.cos((lat * Math.PI) / 180);
  return [
    [lon - halfLon, lat - neededHalfLat],
    [lon + halfLon, lat + neededHalfLat],
  ];
}

/** Share of the visible map padded off the top, so the road ahead shows. */
export const CHASE_TOP_PADDING_SHARE = 0.35;

/**
 * The chase's top padding: a share of the map left visible above `bottom`,
 * the px the phone's detail sheet and the chase HUD hide. A share of the
 * whole map would overlap them once the sheet is open, leaving the vehicle
 * no room at all.
 */
export function chaseTopPadding(mapHeight: number, bottom: number): number {
  return Math.round(CHASE_TOP_PADDING_SHARE * Math.max(0, mapHeight - bottom));
}

/**
 * The chase camera's pitch, and the steepest an orbit can tilt to. MapLibre's
 * default maximum: going steeper means raising `maxPitch` for the chase and
 * lowering it again after the exit animation — a second, delayed restore that
 * a new chase, or StrictMode's double mount, can land in the middle of,
 * capping or stranding the pitch.
 */
export const CHASE_PITCH = 60;

/**
 * Where the chase camera looks from, relative to the vehicle: `bearingOffset`
 * degrees clockwise from its heading, in [0, 360), at `pitch`. Relative, so a
 * view from the side stays one when the vehicle turns.
 */
export type ChaseOrbit = { bearingOffset: number; pitch: number };

/** The chase's own view, from behind the vehicle. */
export const BEHIND: ChaseOrbit = { bearingOffset: 0, pitch: CHASE_PITCH };

/** Degrees a drag turns or tilts the camera per px, as MapLibre's pitch does. */
const ORBIT_DEGREES_PER_PX = 0.5;
/** Degrees one press of the up or down arrow tilts the camera. */
const TILT_KEY_STEP = 10;
/** Within this of a step, an offset counts as on it. */
const ORBIT_TOLERANCE = 0.5;

function wrapDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function clampPitch(pitch: number): number {
  return Math.min(CHASE_PITCH, Math.max(0, pitch));
}

/**
 * The orbit after a drag of `dx`, `dy` px. The signs are MapLibre's own for a
 * rotate and pitch drag: rightwards turns the map as if grabbed below its
 * centre, downwards flattens the view.
 */
export function orbitByDrag(
  orbit: ChaseOrbit,
  dx: number,
  dy: number,
): ChaseOrbit {
  return {
    bearingOffset: wrapDegrees(orbit.bearingOffset + dx * ORBIT_DEGREES_PER_PX),
    pitch: clampPitch(orbit.pitch - dy * ORBIT_DEGREES_PER_PX),
  };
}

/**
 * The zoom after a pinch that has taken two fingers from `startDistance` px
 * apart to `distance`: one level per doubling, as MapLibre's own pinch.
 */
export function zoomByPinch(
  startZoom: number,
  startDistance: number,
  distance: number,
): number {
  if (startDistance <= 0 || distance <= 0) return startZoom;
  return startZoom + Math.log2(distance / startDistance);
}

/** MapLibre's scroll zoom constants (`scroll_zoom.ts`), so a chase zooms as the map does. */
const WHEEL_STEP_PX = 4.000244140625;
const WHEEL_ZOOM_RATE = 1 / 450;
const TRACKPAD_ZOOM_RATE = 1 / 100;
const LINE_PX = 40;
const DOM_DELTA_LINE = 1;

/**
 * The zoom after one wheel event, by MapLibre's scroll zoom formula: a mouse
 * wheel at the wheel rate, a trackpad's small deltas at the faster one. Told
 * apart by size, where MapLibre also uses timing — a notch is 100 px or a
 * multiple of its wheel step, a trackpad event rarely either.
 */
export function zoomByWheel(
  zoom: number,
  deltaY: number,
  deltaMode: number,
): number {
  const px = deltaMode === DOM_DELTA_LINE ? deltaY * LINE_PX : deltaY;
  if (px === 0) return zoom;
  const wheel = px % WHEEL_STEP_PX === 0 || Math.abs(px) >= 100;
  const rate = wheel ? WHEEL_ZOOM_RATE : TRACKPAD_ZOOM_RATE;
  const levels = Math.log2(2 / (1 + Math.exp(-Math.abs(px) * rate)));
  return px < 0 ? zoom + levels : zoom - levels;
}

/**
 * The orbit after an arrow key, or null for any other key. Left and right
 * step to the next multiple of the rotate buttons' 45°, turning the way a
 * drag in that direction does; up and down tilt.
 */
export function orbitByKey(orbit: ChaseOrbit, key: string): ChaseOrbit | null {
  const { bearingOffset, pitch } = orbit;
  switch (key) {
    case "ArrowRight":
      return {
        pitch,
        bearingOffset: wrapDegrees(
          (Math.floor((bearingOffset + ORBIT_TOLERANCE) / ROTATION_STEP) + 1) *
            ROTATION_STEP,
        ),
      };
    case "ArrowLeft":
      return {
        pitch,
        bearingOffset: wrapDegrees(
          (Math.ceil((bearingOffset - ORBIT_TOLERANCE) / ROTATION_STEP) - 1) *
            ROTATION_STEP,
        ),
      };
    case "ArrowUp":
      return { bearingOffset, pitch: clampPitch(pitch + TILT_KEY_STEP) };
    case "ArrowDown":
      return { bearingOffset, pitch: clampPitch(pitch - TILT_KEY_STEP) };
    default:
      return null;
  }
}

/** True when the orbit is, give or take a hair, the view from behind. */
export function isBehind(orbit: ChaseOrbit): boolean {
  const offset = Math.min(orbit.bearingOffset, 360 - orbit.bearingOffset);
  return (
    offset < ORBIT_TOLERANCE && CHASE_PITCH - orbit.pitch < ORBIT_TOLERANCE
  );
}

/** Moves `current` towards `target` by `alpha`, the offset along the shorter arc. */
export function approachOrbit(
  current: ChaseOrbit,
  target: ChaseOrbit,
  alpha: number,
): ChaseOrbit {
  if (alpha >= 1) return target;
  return {
    bearingOffset: smoothAngle(
      current.bearingOffset,
      target.bearingOffset,
      alpha,
    ),
    pitch: current.pitch + (target.pitch - current.pitch) * alpha,
  };
}

/** The map bearing that shows the vehicle, heading `heading`, from `orbit`. */
export function cameraBearing(heading: number, orbit: ChaseOrbit): number {
  return wrapDegrees(heading + orbit.bearingOffset);
}
