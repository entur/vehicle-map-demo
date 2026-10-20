import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layer } from "@deck.gl/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Season } from "../../domain/season.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import { cappedViewBounds } from "../../utils/cappedViewBounds.ts";
import { useKioskInput } from "../../hooks/useKioskInput.ts";
import { pumpkinLayers } from "./pumpkinLayers.ts";
import { christmasTreeLayers } from "./christmasTreeLayers.ts";
import { TwinkleClock, type TwinkleState } from "./twinkleClock.ts";
import {
  DecorationController,
  NOTHING_PLACED,
  Placed,
} from "./decorationController.ts";
import {
  DECORATIONS,
  type Decoration,
} from "../../domain/decorationPlacement.ts";

/**
 * How often decorations are placed again during a chase. Its camera fires
 * `moveend` every frame, and placement is far too much work for that.
 */
export const DECORATION_CHASE_INTERVAL_MS = 1000;
/** Outside a chase: often enough to follow tiles as they load. */
const DECORATION_INTERVAL_MS = 250;

/** Lights fully lit and still: no clock, or reduced motion. */
const STEADY: TwinkleState = { timeS: 0, amount: 0 };

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type SeasonalWindow = {
  __seasonal?: { season: Season; count: number; twinkling: boolean };
};

/**
 * The season's decorations — pumpkins or Christmas trees — handed to
 * `onLayers` as deck.gl layers: `VehicleModels` owns the map's only
 * interleaved overlay and draws them with everything else 3D.
 *
 * Placing them (`DecorationController`) and drawing them are separate. Placing
 * runs only while the season is on and the models are shown (zoom 16 and
 * up), and starts afresh when a chase starts or ends; the models' fade-in
 * steps their opacity twenty times, and a scheme switch changes their
 * lighting, and both only draw the same decorations again. Off-season nothing
 * is listened to or read.
 *
 * The trees' lights twinkle by a `TwinkleClock`, which exists only while trees
 * are placed and shown. Each tick draws the same trees again with a new
 * twinkle state — only the bulb layers' uniforms change — and sets no React
 * state.
 */
export function useSeasonalDecorations({
  map,
  season,
  opacity,
  scheme,
  chasing,
  onLayers,
}: {
  map: MapLibreMap | undefined;
  season: Season | null;
  opacity: number;
  scheme: MapScheme;
  chasing: boolean;
  onLayers: (layers: Layer[]) => void;
}) {
  const visible = opacity > 0;
  const [placed, setPlaced] = useState<Placed>(NOTHING_PLACED);

  useEffect(() => {
    if (!map || season === null || !visible) return;
    const controller = new DecorationController(map, {
      spec: DECORATIONS[season],
      viewBounds: () => cappedViewBounds(map),
      intervalMs: chasing
        ? DECORATION_CHASE_INTERVAL_MS
        : DECORATION_INTERVAL_MS,
      onPlaced: setPlaced,
    });
    return () => {
      controller.dispose();
      setPlaced(NOTHING_PLACED);
    };
  }, [map, season, visible, chasing]);

  // One accessor per placement, so a twinkle tick hands deck.gl the same one.
  const getElevation = useMemo(() => {
    const elevationOf = new Map(
      placed.decorations.map((decoration, i) => [
        decoration,
        placed.elevations[i],
      ]),
    );
    return (decoration: Decoration) => elevationOf.get(decoration) ?? 0;
  }, [placed]);

  const draw = useCallback(
    (twinkle: TwinkleState) => {
      const options = {
        visible,
        opacity,
        scheme,
        getElevation,
        positionTrigger: placed.key,
      };
      onLayers(
        season === "christmas"
          ? christmasTreeLayers(placed.decorations, { ...options, twinkle })
          : pumpkinLayers(placed.decorations, options),
      );
    },
    [season, placed, getElevation, visible, opacity, scheme, onLayers],
  );
  // The clock outlives a redraw; its ticks draw with whatever is current.
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const treesShown =
    season === "christmas" && visible && placed.decorations.length > 0;
  const clockRef = useRef<TwinkleClock | null>(null);

  // Declared before the drawing effect, so a clock started in this commit is
  // already there when the drawing effect reads it.
  useEffect(() => {
    if (!map || !treesShown) return;
    const clock = new TwinkleClock(map, {
      reducedMotion: prefersReducedMotion(),
      onTick: (state) => drawRef.current(state),
    });
    clockRef.current = clock;
    // The clock skips ticks on a hidden page; coming back counts as someone
    // being there again.
    const onVisibility = () => {
      if (document.visibilityState === "visible") clock.activity();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clock.dispose();
      clockRef.current = null;
    };
  }, [map, treesShown]);

  const onInput = useCallback(() => clockRef.current?.activity(), []);
  useKioskInput(treesShown, onInput);

  useEffect(() => {
    draw(clockRef.current?.current() ?? STEADY);
  }, [draw]);

  // Lets the Playwright tests see the decorations. Development builds only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as SeasonalWindow).__seasonal =
      season === null
        ? undefined
        : {
            season,
            count: placed.decorations.length,
            twinkling: treesShown && !prefersReducedMotion(),
          };
  }, [season, placed, treesShown]);
}
