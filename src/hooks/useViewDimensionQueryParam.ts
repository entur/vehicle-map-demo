import { useEffect, useRef } from "react";
import { ViewDimension, parseViewDimension } from "../domain/viewDimension.ts";

/**
 * Reads `?view=` once on load, then mirrors the dimension back into the URL.
 * Same shape as `useModeQueryParam`, and like it touches only its own key.
 * 2D is the default, so it is left out of the URL rather than written as
 * `view=2d` into every shared link.
 */
export function useViewDimensionQueryParam(
  dimension: ViewDimension,
  setDimension: (dimension: ViewDimension) => void,
) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const params = new URLSearchParams(window.location.search);
    setDimension(parseViewDimension(params.get("view")));
  }, [setDimension]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (dimension === "2d") {
      if (!url.searchParams.has("view")) return;
      url.searchParams.delete("view");
    } else {
      if (url.searchParams.get("view") === dimension) return;
      url.searchParams.set("view", dimension);
    }
    window.history.replaceState({}, "", url.toString());
  }, [dimension]);
}
