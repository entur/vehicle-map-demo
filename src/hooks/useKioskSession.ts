import { useCallback, useEffect, useRef, useState } from "react";
import {
  KioskSession,
  KioskSettings,
  parseKioskSettings,
  withKioskParams,
} from "../domain/kioskSchedule.ts";

/**
 * The kiosk run, if any, and the way to start and stop one.
 *
 * Read from `?kiosk=<seconds>` or `?kioskView=<camera>`, either with
 * `&kioskIdle=<seconds>`, once, on the first render, so a link loaded cold
 * runs from the start. Afterwards the session is mirrored back into the URL,
 * in the style of `useModeQueryParam`: its keys while a run exists, none once
 * it is stopped, and no other key touched. Kept out of `Filter`, so no kiosk
 * key reaches the vehicle subscription's variables.
 */
export function useKioskSession(): {
  session: KioskSession | null;
  start: (settings: KioskSettings) => void;
  stop: () => void;
} {
  const [session, setSession] = useState<KioskSession | null>(() => {
    const settings = parseKioskSettings(window.location.search);
    return settings && { ...settings, id: 1 };
  });
  // Every run has its own id, so a stop and a start with the same settings
  // still read as a fresh start.
  const nextId = useRef(2);

  useEffect(() => {
    const href = window.location.href;
    const next = withKioskParams(href, session);
    if (next !== href) window.history.replaceState({}, "", next);
  }, [session]);

  const start = useCallback((settings: KioskSettings) => {
    const id = nextId.current++;
    setSession({ ...settings, id });
  }, []);
  const stop = useCallback(() => setSession(null), []);

  return { session, start, stop };
}
