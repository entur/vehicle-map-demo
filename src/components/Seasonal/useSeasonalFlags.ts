import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Layer } from "@deck.gl/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { VehicleUpdate } from "../../types.ts";
import { FLAG_SEASON, type Season } from "../../domain/season.ts";
import type { ModelLayerOptions } from "../Vehicle/vehicleModelLayers.ts";
import { useKioskInput } from "../../hooks/useKioskInput.ts";
import { AnimationClock, type AnimationState } from "./animationClock.ts";
import { flaggedVehicles, flagLayers } from "./flagLayers.ts";

/** The cloth's still pose: no clock, or reduced motion. */
const STILL: AnimationState = { timeS: 0, amount: 0 };

const NO_VEHICLES: VehicleUpdate[] = [];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type SeasonalWindow = {
  __seasonal?: { season: Season; count: number; twinkling: boolean };
};

/**
 * The 17. mai flags on the vehicle models, handed to `onLayers` as deck.gl
 * layers: `VehicleModels` owns the map's only interleaved overlay. Outside the
 * season it hands over nothing and runs no clock.
 *
 * The flags flutter by an `AnimationClock`, which exists only while flags are
 * shown, created and fed as the Christmas lights' is. A tick builds the flags
 * again from the same flagged vehicles — the same array, so deck.gl keeps
 * their instance data and only the cloth's uniforms change — and sets no React
 * state. The models themselves are never rebuilt by it.
 *
 * `flutterNow` gives the chased vehicle's flags, rebuilt every chase frame,
 * the same pose as the rest. They are drawn by the caller, but the clock runs
 * for them too (`chasedFlagged`), even when no other vehicle flies a flag.
 */
export function useSeasonalFlags({
  map,
  season,
  vehicles,
  options,
  chasedFlagged = false,
  onLayers,
}: {
  map: MapLibreMap | undefined;
  season: Season | null;
  vehicles: VehicleUpdate[];
  options: Omit<ModelLayerOptions, "idPrefix"> | null;
  /** Whether the chased vehicle, left out of `vehicles`, flies flags. */
  chasedFlagged?: boolean;
  onLayers: (layers: Layer[]) => void;
}): { flutterNow: () => AnimationState } {
  const inSeason = season === FLAG_SEASON;
  // One array per vehicle frame, handed to every tick until the next frame.
  const flagged = useMemo(
    () => (inSeason ? flaggedVehicles(vehicles) : NO_VEHICLES),
    [inSeason, vehicles],
  );
  const shown = inSeason && options !== null && options.visible;
  const flying = shown && flagged.length > 0;
  // The clock runs for the chased vehicle's flags as well.
  const fluttering = flying || (shown && chasedFlagged);

  const draw = useCallback(
    (flutter: AnimationState) => {
      onLayers(
        flying && options
          ? flagLayers(flagged, {
              ...options,
              idPrefix: "vehicle-flags",
              flutter,
            })
          : [],
      );
      // Lets the Playwright tests see the flags. Development builds only.
      if (import.meta.env.DEV && inSeason) {
        (window as SeasonalWindow).__seasonal = {
          season: FLAG_SEASON,
          // The flags drawn: none while the models are hidden.
          count:
            (flying ? flagged.length : 0) +
            (fluttering && chasedFlagged ? 1 : 0),
          twinkling: flutter.amount > 0,
        };
      }
    },
    [flying, fluttering, flagged, options, inSeason, chasedFlagged, onLayers],
  );
  // The clock outlives a redraw; its ticks draw with whatever is current.
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const clockRef = useRef<AnimationClock | null>(null);

  // Declared before the drawing effect, so a clock started in this commit is
  // already there when the drawing effect reads it.
  useEffect(() => {
    if (!map || !fluttering) return;
    const clock = new AnimationClock(map, {
      reducedMotion: prefersReducedMotion(),
      onTick: (state) => drawRef.current(state),
    });
    clockRef.current = clock;
    // The clock stops its timer on a hidden page; coming back counts as
    // someone being there again, which starts it.
    const onVisibility = () => {
      if (document.visibilityState === "visible") clock.activity();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clock.dispose();
      clockRef.current = null;
    };
  }, [map, fluttering]);

  const onInput = useCallback(() => clockRef.current?.activity(), []);
  useKioskInput(fluttering, onInput);

  useEffect(() => {
    draw(clockRef.current?.current() ?? STILL);
  }, [draw]);

  const flutterNow = useCallback(
    () => clockRef.current?.current() ?? STILL,
    [],
  );
  return { flutterNow };
}
