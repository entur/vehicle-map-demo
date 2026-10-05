import { useEffect, useRef } from "react";
import { AppMode, parseAppMode } from "../domain/appMode.ts";

/**
 * Reads `?mode=` once on load, then mirrors the mode back into the URL.
 *
 * Kept separate from `useFilterQueryParams` because mode is not part of
 * `Filter`: it decides which subscription runs, and folding it into the filter
 * object would smuggle a stray key into the vehicle subscription variables.
 * Both hooks build their URL from `window.location.href` and only touch their
 * own keys, so they compose without clobbering each other.
 */
export function useModeQueryParam(
  mode: AppMode,
  setMode: (mode: AppMode) => void,
) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const params = new URLSearchParams(window.location.search);
    setMode(parseAppMode(params.get("mode")));
  }, [setMode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("mode") === mode) return;
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
  }, [mode]);
}
