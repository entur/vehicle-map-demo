import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Layer } from "@deck.gl/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { VehicleUpdate } from "../../types.ts";
import { flagDesignFor, type Season } from "../../domain/season.ts";
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
  __seasonal?: {
    season: Season;
    count: number;
    twinkling: boolean;
    rockets?: number;
  };
};

/**
 * The season's flags on the vehicle models — Norway's for 17. mai, the
 * rainbow for Pride — handed to `onLayers` as deck.gl
 * layers: `VehicleModels` owns the map's only interleaved overlay. Outside the
 * season it hands over nothing and runs no clock.
 *
 * The flags flutter by an `AnimationClock`, which exists only while flags are
 * shown, fed as the Christmas lights' is. Whether any are shown changes with
 * the feed, not with anyone at the screen, so the hook keeps the clock's start
 * and the last activity across clocks, watching input and camera movement all
 * season: a clock created on a map left alone starts settled and does not
 * tick, and one created while someone is there carries on. A tick builds the
 * flags again from the same flagged vehicles — the same array, so deck.gl keeps
 * their instance data and only the cloth's uniforms change — and sets no React
 * state. The models themselves are never rebuilt by it.
 *
 * `flutterNow` gives the chased vehicle's flags, rebuilt every chase frame,
 * the same pose as the rest. They are drawn by the caller, but the clock runs
 * for them too (`chasedFlagged`), even when no other vehicle flies a flag.
 * Every tick calls `onChasedTick` for them, other flags in view or not: a
 * chase frame is skipped while the vehicle stands still, so without it the
 * chased flags would freeze. A tick with other flags hands both over in one
 * `onLayers`; one without hands over nothing more, which would re-send every
 * other layer for nothing.
 */
export function useSeasonalFlags({
  map,
  season,
  vehicles,
  options,
  chasedFlagged = false,
  onLayers,
  onChasedTick,
}: {
  map: MapLibreMap | undefined;
  season: Season | null;
  vehicles: VehicleUpdate[];
  options: Omit<ModelLayerOptions, "idPrefix"> | null;
  /** Whether the chased vehicle, left out of `vehicles`, flies flags. */
  chasedFlagged?: boolean;
  onLayers: (layers: Layer[]) => void;
  /**
   * Redraws the chased vehicle's flags, on every tick while it flies them;
   * hands them over only when `send`, since otherwise `onLayers` follows.
   */
  onChasedTick?: (send: boolean) => void;
}): { flutterNow: () => AnimationState } {
  const design = flagDesignFor(season);
  const inSeason = design !== null;
  const shown = inSeason && options !== null && options.visible;
  // One array per vehicle frame, handed to every tick until the next frame.
  // Not looked for while no flag can be shown: zoomed out, `vehicles` is the
  // whole feed.
  const flagged = useMemo(
    () => (shown ? flaggedVehicles(vehicles) : NO_VEHICLES),
    [shown, vehicles],
  );
  const flying = shown && flagged.length > 0;
  // The clock runs for the chased vehicle's flags as well.
  const fluttering = flying || (shown && chasedFlagged);

  const draw = useCallback(
    (flutter: AnimationState, tick = false) => {
      // A tick with no flags but the chased vehicle's has nothing to hand
      // over: the last draw already handed over none.
      const handsOver = !tick || flying;
      // The chased vehicle's flags are redrawn on every tick, other flags in
      // view or not: a chase standing still publishes no frames to do it.
      // Sent with the other flags when there are any, in one handover.
      if (tick && shown && chasedFlagged) onChasedTick?.(!handsOver);
      if (handsOver) {
        onLayers(
          flying && options && design
            ? flagLayers(flagged, {
                ...options,
                idPrefix: "vehicle-flags",
                flutter,
                design,
              })
            : [],
        );
      }
      // Lets the Playwright tests see the flags. Development builds only.
      if (import.meta.env.DEV && season !== null && inSeason) {
        const w = window as SeasonalWindow;
        w.__seasonal = {
          ...w.__seasonal,
          season,
          // The flags drawn: none while the models are hidden.
          count:
            (flying ? flagged.length : 0) +
            (fluttering && chasedFlagged ? 1 : 0),
          twinkling: flutter.amount > 0,
        };
      }
    },
    [
      shown,
      flying,
      fluttering,
      flagged,
      options,
      season,
      inSeason,
      design,
      chasedFlagged,
      onLayers,
      onChasedTick,
    ],
  );
  // The clock outlives a redraw; its ticks draw with whatever is current.
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const clockRef = useRef<AnimationClock | null>(null);
  // When the flutter's time began and when someone was last there, kept
  // across clocks. The season starting counts as activity.
  const since = useRef<{ startMs: number; lastActivityMs: number } | null>(
    null,
  );

  const onInput = useCallback(() => {
    if (since.current) since.current.lastActivityMs = Date.now();
    clockRef.current?.activity();
  }, []);
  useKioskInput(inSeason, onInput);

  // Watches for someone being there all season, with or without a clock.
  useEffect(() => {
    if (!map || !inSeason) return;
    if (!since.current) {
      const now = Date.now();
      since.current = { startMs: now, lastActivityMs: now };
    }
    const onMove = () => {
      if (since.current) since.current.lastActivityMs = Date.now();
    };
    map.on("move", onMove);
    // The clock stops its timer on a hidden page; coming back counts as
    // someone being there again, which starts it.
    const onVisibility = () => {
      if (document.visibilityState === "visible") onInput();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      map.off("move", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [map, inSeason, onInput]);

  // Declared before the drawing effect, so a clock started in this commit is
  // already there when the drawing effect reads it.
  useEffect(() => {
    if (!map || !fluttering) return;
    const clock = new AnimationClock(map, {
      reducedMotion: prefersReducedMotion(),
      onTick: (state) => drawRef.current(state, true),
      ...since.current,
    });
    clockRef.current = clock;
    return () => {
      clock.dispose();
      clockRef.current = null;
    };
  }, [map, fluttering]);

  useEffect(() => {
    draw(clockRef.current?.current() ?? STILL);
  }, [draw]);

  const flutterNow = useCallback(
    () => clockRef.current?.current() ?? STILL,
    [],
  );
  return { flutterNow };
}
