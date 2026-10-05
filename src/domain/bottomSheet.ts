/**
 * The detail panels' phone layout: a sheet docked to the bottom of the screen
 * at one of three heights. Plain TypeScript so the heights, and the map
 * padding derived from them, are testable without a DOM.
 */

export type SheetSnap = "peek" | "half" | "full";

export const SHEET_SNAPS: readonly SheetSnap[] = ["peek", "half", "full"];

/**
 * Tall enough for the selected vehicle's header — line, origin → destination,
 * mode/operator/codespace and the delay — and the drag handle above it.
 */
export const PEEK_HEIGHT = 148;

/** Share of the viewport the half-open sheet takes. */
const HALF_SHARE = 0.5;

/**
 * Left clear above the fully open sheet, so the mode pill stays in view and
 * the map is still visibly there to drag the sheet back down to. Measured
 * from the top of the screen, so a sheet raised off the bottom is shorter
 * rather than reaching higher.
 */
const FULL_TOP_CLEARANCE = 60;

/** Clear space between the attribution strip and the sheet above it. */
const ATTRIBUTION_GAP = 4;

/** Where the sheet floats when nothing is under it; every card's inset. */
const DEFAULT_BOTTOM = 12;

/**
 * How far off the bottom edge the sheet floats: `inset`, or clear above the
 * map's attribution strip when that is taller — which it is once it wraps,
 * as it does on a phone when the terrain or aerial imagery adds its credit.
 * The strip is flush in the corner and must stay readable, so the sheet
 * makes room for it rather than covering it.
 */
export function sheetBottom(inset: number, attributionHeight: number): number {
  return Math.max(inset, attributionHeight + ATTRIBUTION_GAP);
}

/**
 * The sheet's height, in px, at `snap` in a viewport `viewportHeight` tall,
 * floating `bottom` px off its bottom edge.
 */
export function sheetHeight(
  snap: SheetSnap,
  viewportHeight: number,
  bottom = DEFAULT_BOTTOM,
): number {
  const full = Math.max(
    PEEK_HEIGHT,
    viewportHeight - bottom - FULL_TOP_CLEARANCE,
  );
  switch (snap) {
    case "peek":
      return Math.min(PEEK_HEIGHT, full);
    case "half":
      return Math.min(
        full,
        Math.max(PEEK_HEIGHT, Math.round(viewportHeight * HALF_SHARE)),
      );
    case "full":
      return full;
  }
}

/** The snaps up to and including `max`, lowest first. */
function snapsUpTo(max: SheetSnap): readonly SheetSnap[] {
  return SHEET_SNAPS.slice(0, SHEET_SNAPS.indexOf(max) + 1);
}

/** `snap`, or `max` if `snap` opens further than it. */
export function clampSnap(snap: SheetSnap, max: SheetSnap): SheetSnap {
  return SHEET_SNAPS.indexOf(snap) > SHEET_SNAPS.indexOf(max) ? max : snap;
}

/**
 * The snap whose height is nearest `height` — where a released drag lands —
 * never opening further than `max`.
 */
export function nearestSnap(
  height: number,
  viewportHeight: number,
  max: SheetSnap = "full",
  bottom = DEFAULT_BOTTOM,
): SheetSnap {
  let best: SheetSnap = "peek";
  for (const snap of snapsUpTo(max)) {
    if (
      Math.abs(sheetHeight(snap, viewportHeight, bottom) - height) <
      Math.abs(sheetHeight(best, viewportHeight, bottom) - height)
    ) {
      best = snap;
    }
  }
  return best;
}

/**
 * What tapping the handle does: open a step further, wrapping back to peek
 * after `max`.
 */
export function nextSnap(snap: SheetSnap, max: SheetSnap = "full"): SheetSnap {
  const snaps = snapsUpTo(max);
  return snaps[(snaps.indexOf(clampSnap(snap, max)) + 1) % snaps.length];
}

/**
 * The furthest the sheet opens. A chase caps it at half: the chase's own
 * controls sit above the sheet, and a fully open sheet leaves them no room.
 */
export function maxSnapFor(chasing: boolean): SheetSnap {
  return chasing ? "half" : "full";
}

/**
 * How much of the map's bottom edge the sheet hides — the map padding that
 * keeps the camera centring on what is still visible. The sheet floats
 * `inset` px off the bottom edge (see `sheetBottom`), and that gap is hidden
 * in effect too.
 */
export function sheetMapInset(
  snap: SheetSnap,
  viewportHeight: number,
  inset: number,
): number {
  return sheetHeight(snap, viewportHeight, inset) + inset;
}

/**
 * How a detail panel is laid out: the desktop's left-hand card, or the phone's
 * bottom sheet at a snap the user controls. `MapView` owns the snap, because
 * it also pads the map by the sheet's height.
 */
export type DetailLayout =
  | { kind: "card" }
  | {
      kind: "sheet";
      snap: SheetSnap;
      /** The furthest the handle opens it; `snap` never exceeds it. */
      maxSnap: SheetSnap;
      /** px it floats off the bottom edge, from `sheetBottom`. */
      bottom: number;
      setSnap: (snap: SheetSnap) => void;
    };

/** A pointer that moved less than this before release tapped the handle. */
export const TAP_SLOP_PX = 6;
