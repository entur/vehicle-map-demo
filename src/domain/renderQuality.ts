/**
 * How much the map spends on drawing, for machines that cannot keep up: a
 * wall screen on an integrated GPU. It belongs to the device, not to what is
 * shown, so it is the URL's `?quality=` rather than part of `Filter`, and a
 * kiosk link carries it. High is the default and is left out of the URL.
 */
export type RenderQuality = "low" | "medium" | "high";

/** Cheapest first: the order the control shows them in. */
export const RENDER_QUALITIES: RenderQuality[] = ["low", "medium", "high"];

/** What a link without `?quality=` gets, and what is left out of the URL. */
export const DEFAULT_RENDER_QUALITY: RenderQuality = "high";

export function parseRenderQuality(
  value: string | null | undefined,
): RenderQuality {
  return (
    RENDER_QUALITIES.find((quality) => quality === value) ??
    DEFAULT_RENDER_QUALITY
  );
}

export type QualitySettings = {
  /**
   * The most canvas pixels drawn per frame; a larger screen is drawn at a
   * lower pixel ratio and scaled up. Null draws at the device's own ratio.
   */
  maxPixels: number | null;
  /**
   * Whether labels fade in and out. While a fade is under way MapLibre
   * redraws on every display frame, and a moving camera keeps one under way:
   * measured during a chase, 59 frames a second for 30 camera moves. Off,
   * the map is drawn once per camera move, and `chaseFps` is what it costs.
   */
  labelFade: boolean;
  /**
   * How often the chase moves the camera. Every move is a full redraw with
   * terrain, and a rate the machine cannot hold arrives unevenly, which reads
   * as stutter where a steady lower rate does not. On a 120 Hz screen an
   * uncapped chase would redraw twice as often for motion no smoother.
   */
  chaseFps: number;
  /**
   * Hillshade in 3D. Hidden, its elevation tiles are not fetched or prepared
   * either. Terrain and buildings stay: a chase reads by them.
   */
  hillshade: boolean;
  /**
   * The style's slightly see-through buildings. MapLibre draws translucent
   * extrusions twice, a depth pass and then colour, and opaque ones once:
   * measured in software rendering, 25% more frames at Low.
   */
  translucentBuildings: boolean;
  /**
   * The seasonal lights, flags and fireworks, and falling rain or snow. Off,
   * lights and flags hold still as under `prefers-reduced-motion`, and no
   * fireworks or precipitation are drawn. Measured on an idle Christmas map,
   * 12.5 repaints a second for the twinkle against none.
   */
  animations: boolean;
};

export const QUALITY_SETTINGS: Record<RenderQuality, QualitySettings> = {
  high: {
    maxPixels: null,
    labelFade: true,
    chaseFps: 30,
    hillshade: true,
    translucentBuildings: true,
    animations: true,
  },
  medium: {
    maxPixels: 1920 * 1080,
    labelFade: false,
    chaseFps: 30,
    hillshade: true,
    translucentBuildings: true,
    animations: true,
  },
  low: {
    maxPixels: 1280 * 720,
    labelFade: false,
    chaseFps: 20,
    hillshade: false,
    translucentBuildings: false,
    animations: false,
  },
};

export const QUALITY_LABELS: Record<RenderQuality, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * What each level gives up, for someone setting up a screen rather than
 * someone who knows the settings above. Change a row, change its caption.
 */
export const QUALITY_CAPTIONS: Record<RenderQuality, string> = {
  high: "Full detail and every effect. Start here.",
  medium:
    "At most Full HD detail, so 4K and high-resolution screens look a little softer, and labels appear without fading. Try this first if the map stutters.",
  low: "Softer picture, no hill shading in 3D, solid buildings, fewer camera updates when following a vehicle, and nothing animated. For screens that still stutter on Medium.",
};

/**
 * The pixel ratio to draw a `cssWidth` × `cssHeight` map at: the device's,
 * lowered until the canvas holds at most `maxPixels`. Null when the device's
 * own ratio already fits, so the map goes on following it.
 */
export function pixelRatioFor(
  maxPixels: number | null,
  devicePixelRatio: number,
  cssWidth: number,
  cssHeight: number,
): number | null {
  const area = cssWidth * cssHeight;
  if (maxPixels === null || area <= 0) return null;
  if (area * devicePixelRatio * devicePixelRatio <= maxPixels) return null;
  return Math.sqrt(maxPixels / area);
}
