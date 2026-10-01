import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** `window.innerHeight`, re-read on resize — a phone's URL bar changes it. */
export function useViewportHeight(): number {
  return useSyncExternalStore(subscribe, () => window.innerHeight);
}
