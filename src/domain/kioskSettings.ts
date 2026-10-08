import type { Filter } from "../types.ts";
import type { KioskSettings } from "./kioskSchedule.ts";
import type { ViewDimension } from "./viewDimension.ts";
import { FixedCamera, roundCamera } from "./fixedCamera.ts";

/** "Time per vehicle" in the Kiosk tool; DEFAULT_DWELL_MS is among them. */
export const KIOSK_DWELL_CHOICES_MS = [
  60_000, 120_000, 180_000, 300_000, 600_000,
];
/** "Resume after a touch" in the Kiosk tool; IDLE_MS is among them. */
export const KIOSK_IDLE_CHOICES_MS = [30_000, 60_000, 120_000, 300_000];

/**
 * `value` when it is one of `choices`, else `fallback`: a `?kiosk=20` link
 * runs with 20 s, which no select offers.
 */
export function choiceOr(
  choices: number[],
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && choices.includes(value) ? value : fallback;
}

/** "30 s", "3 min", "1 min 30 s". */
export function formatKioskDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

export type KioskSummaryRow = { label: string; value: string };

/**
 * What the kiosk will chase, as the filter panel sets it: codespace,
 * operator and max data age, or "All vehicles" when none is set.
 */
export function kioskFilterSummary(
  filter: Partial<Filter> | null | undefined,
): KioskSummaryRow[] {
  const rows: KioskSummaryRow[] = [];
  if (filter?.codespaceId) {
    rows.push({ label: "Codespace", value: filter.codespaceId });
  }
  if (filter?.operatorRef) {
    rows.push({ label: "Operator", value: filter.operatorRef });
  }
  if (filter?.maxDataAge !== undefined && String(filter.maxDataAge) !== "") {
    rows.push({ label: "Max data age", value: `${filter.maxDataAge} s` });
  }
  return rows.length > 0
    ? rows
    : [{ label: "Vehicles", value: "All vehicles" }];
}

/** What the Kiosk tool can run, with the names it shows for them. */
export const KIOSK_KIND_LABELS: Record<KioskSettings["kind"], string> = {
  chase: "Chase vehicles",
  fixed: "Fixed view",
};

/**
 * A fixed view's camera and dimension in one line, as the Kiosk tool shows
 * it: "59.911, 10.755 · zoom 17.5 · 3D".
 */
export function formatFixedView(
  camera: FixedCamera,
  dimension: ViewDimension,
): string {
  const { latitude, longitude, zoom } = roundCamera(camera);
  return `${latitude}, ${longitude} · zoom ${zoom} · ${dimension.toUpperCase()}`;
}
