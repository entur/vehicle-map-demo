import { useCallback, useEffect, useRef, useState } from "react";
import {
  KioskSession,
  parseKioskSettings,
  withKioskParams,
} from "../domain/kioskSchedule.ts";

/**
 * The kiosk run, if any, and the way to start and stop one.
 *
 * Read from `?kiosk=<seconds>&kioskIdle=<seconds>` once, on the first
 * render, so a link loaded cold runs from the start. Afterwards the session
 * is mirrored back into the URL, in the style of `useModeQueryParam`: both
 * keys while a run exists, neither once it is stopped, and no other key
 * touched. Kept out of `Filter`, so neither key reaches the vehicle
 * subscription's variables.
 */
export function useKioskSession(): {
  session: KioskSession | null;
  start: (dwellMs: number, idleMs: number) => void;
  stop: () => void;
} {
  const [session, setSession] = useState<KioskSession | null>(() => {
    const settings = parseKioskSettings(window.location.search);
    return settings && { id: 1, ...settings };
  });
  // Every run has its own id, so a stop and a start with the same settings
  // still read as a fresh start.
  const nextId = useRef(2);

  useEffect(() => {
    const href = window.location.href;
    const next = withKioskParams(href, session);
    if (next !== href) window.history.replaceState({}, "", next);
  }, [session]);

  const start = useCallback((dwellMs: number, idleMs: number) => {
    const id = nextId.current++;
    setSession({ id, dwellMs, idleMs });
  }, []);
  const stop = useCallback(() => setSession(null), []);

  return { session, start, stop };
}
