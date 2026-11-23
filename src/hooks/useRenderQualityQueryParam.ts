import { useEffect } from "react";
import {
  DEFAULT_RENDER_QUALITY,
  RenderQuality,
  parseRenderQuality,
} from "../domain/renderQuality.ts";

/**
 * `?quality=` as the page was loaded. Read in the state initialiser, not in
 * an effect as `view` is, so no render ever has the default: the first
 * effects to run — the map's resolution, the label fade — already apply the
 * link's quality rather than High and then the link's.
 */
export function initialRenderQuality(): RenderQuality {
  return parseRenderQuality(
    new URLSearchParams(window.location.search).get("quality"),
  );
}

/**
 * Mirrors the quality into the URL, touching only its own key. The default
 * is left out of the URL.
 */
export function useRenderQualityQueryParam(quality: RenderQuality) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (quality === DEFAULT_RENDER_QUALITY) {
      if (!url.searchParams.has("quality")) return;
      url.searchParams.delete("quality");
    } else {
      if (url.searchParams.get("quality") === quality) return;
      url.searchParams.set("quality", quality);
    }
    window.history.replaceState({}, "", url.toString());
  }, [quality]);
}
