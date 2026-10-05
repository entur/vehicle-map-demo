import { useState } from "react";
import { parseKioskParam } from "../domain/kioskSchedule.ts";

/**
 * `?kiosk=<seconds>` as a dwell in ms, or null when kiosk mode is off.
 *
 * Read once and never written. Kiosk mode is set up by loading a link, not
 * toggled in the app, and keeping it out of `Filter` keeps it out of the
 * vehicle subscription's variables.
 */
export function useKioskQueryParam(): number | null {
  const [dwellMs] = useState(() => parseKioskParam(window.location.search));
  return dwellMs;
}
