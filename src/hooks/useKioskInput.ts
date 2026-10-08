import { useEffect } from "react";

const INPUT_EVENTS = ["pointerdown", "wheel", "keydown"] as const;

/**
 * Calls `onInput` on any touch, click, wheel or key while `enabled` — what
 * pauses a kiosk. Captured, so input reaches the kiosk before anything that
 * stops it. The kiosk's own camera moves raise none of these events.
 */
export function useKioskInput(enabled: boolean, onInput: () => void) {
  useEffect(() => {
    if (!enabled) return;
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    return () => {
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, [enabled, onInput]);
}
