import { useCallback, useEffect, useRef } from "react";
import type { Layer } from "@deck.gl/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Season } from "../../domain/season.ts";
import { burstDurationS } from "../../domain/fireworks.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import { cappedViewBounds } from "../../utils/cappedViewBounds.ts";
import { launchBounds, launchStrip } from "../../domain/fireworkSchedule.ts";
import { useKioskInput } from "../../hooks/useKioskInput.ts";
import { FireworkShow, type LaunchView } from "./fireworkShow.ts";
import { FireworksClock } from "./fireworksClock.ts";
import {
  fireworkLayers,
  sparkInstances,
  type SparkInstance,
} from "./fireworkLayers.ts";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type SeasonalWindow = {
  __seasonal?: {
    season?: Season;
    count?: number;
    twinkling?: boolean;
    rockets?: number;
  };
};

/** Lets the Playwright tests see the rockets. Development builds only. */
function reportRockets(rockets: number) {
  if (!import.meta.env.DEV) return;
  const w = window as SeasonalWindow;
  if (w.__seasonal?.rockets === rockets) return;
  w.__seasonal = { ...w.__seasonal, rockets };
}

/**
 * New Year's fireworks over the 3D map, handed to `onLayers` as deck.gl
 * layers: `VehicleModels` owns the map's only interleaved overlay. They are
 * drawn only while `on` (the season) and `shown` (3D, with the models shown);
 * otherwise the hook hands over nothing and runs no show, clock or timer, and
 * under reduced motion it never does.
 *
 * A `FireworksClock` decides when frames run. A frame changes only the
 * layer's time; the spark instances are rebuilt, from a new epoch, only when
 * the show launches or prunes. A barrage is announced through `onBarrage`, so
 * the Christmas lights stay awake under it.
 *
 * The last activity is kept across clocks, as the flags keep theirs, so leaving
 * 3D and coming back does not make an idle screen active again. A frame that
 * throws is logged once and draws nothing: a decoration must never stop the
 * clock, which would leave an idle wall screen without fireworks for good.
 */
export function useSeasonalFireworks({
  map,
  on,
  shown,
  scheme,
  onLayers,
  onBarrage,
}: {
  map: MapLibreMap | undefined;
  on: boolean;
  shown: boolean;
  scheme: MapScheme;
  onLayers: (layers: Layer[]) => void;
  onBarrage: (untilMs: number) => void;
}): void {
  const running = on && shown;
  const clockRef = useRef<FireworksClock | null>(null);
  // When someone was last there, kept across clocks. The season starting
  // counts as activity.
  const lastActivityMs = useRef<number | null>(null);
  // Read by the clock's frames, which outlive a render.
  const current = useRef({ scheme, onLayers, onBarrage });
  useEffect(() => {
    current.current = { scheme, onLayers, onBarrage };
  }, [scheme, onLayers, onBarrage]);
  // Redraws with the current scheme between frames; set while a clock runs.
  const redrawRef = useRef<(() => void) | null>(null);

  const onInput = useCallback(() => {
    lastActivityMs.current = Date.now();
    clockRef.current?.activity();
  }, []);
  useKioskInput(on, onInput);

  // Watches for someone being there all season, with or without a clock.
  useEffect(() => {
    if (!map || !on) return;
    if (lastActivityMs.current === null) lastActivityMs.current = Date.now();
    const onMove = () => {
      lastActivityMs.current = Date.now();
    };
    map.on("move", onMove);
    // The clock sleeps on a hidden page; coming back counts as someone being
    // there again, which wakes it.
    const onVisibility = () => {
      if (document.visibilityState === "visible") onInput();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      map.off("move", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [map, on, onInput]);

  useEffect(() => {
    if (!map || !running || prefersReducedMotion()) return;
    const show = new FireworkShow();
    let instances: SparkInstance[] = [];
    let epochMs = Date.now();
    let epochKey = 0;
    // A frame that failed leaves the instances unknown; the next rebuilds.
    let stale = false;
    let failed = false;
    let logged = false;
    const fail = (error: unknown) => {
      failed = true;
      stale = true;
      if (logged) return;
      logged = true;
      console.error("Fireworks failed; drawing none this frame", error);
    };

    const draw = (nowMs: number) => {
      current.current.onLayers(
        fireworkLayers(instances, {
          visible: true,
          scheme: current.current.scheme,
          timeS: (nowMs - epochMs) / 1000,
          epochKey,
        }),
      );
    };
    const inAir = (nowMs: number) =>
      show.bursts().filter((b) => b.launchMs + burstDurationS() * 1000 > nowMs)
        .length;

    // Called first in every frame, so it also clears the last frame's failure.
    const view = (): LaunchView => {
      failed = false;
      try {
        const centre = map.getCenter();
        // Rockets go up over the ground under the lower part of the screen,
        // so that their bursts are in view; see `LAUNCH_SCREEN_SHARE`.
        const { clientWidth, clientHeight } = map.getContainer();
        const corners = launchStrip(clientWidth, clientHeight).map((point) =>
          map.unproject(point).toArray(),
        );
        return {
          bounds: launchBounds(corners, cappedViewBounds(map)),
          groundAt: (lngLat) => map.queryTerrainElevation(lngLat) ?? null,
          centreGroundM: map.queryTerrainElevation(centre) ?? null,
        };
      } catch (error) {
        fail(error);
        return {
          bounds: [
            [0, 0],
            [0, 0],
          ],
          groundAt: () => null,
          centreGroundM: null,
        };
      }
    };

    const clock = new FireworksClock(map, {
      reducedMotion: false,
      lastActivityMs: lastActivityMs.current ?? undefined,
      show: {
        update: (nowMs, launchView, scattering) => {
          if (failed) return false;
          try {
            return show.update(nowMs, launchView, scattering);
          } catch (error) {
            fail(error);
            return false;
          }
        },
        busy: (nowMs) => {
          try {
            return show.busy(nowMs);
          } catch (error) {
            fail(error);
            return false;
          }
        },
      },
      view,
      onFrame: (nowMs, changed) => {
        try {
          if (failed) {
            current.current.onLayers([]);
            return;
          }
          if (changed || stale) {
            stale = false;
            epochMs = nowMs;
            epochKey++;
            instances = sparkInstances(show.bursts(), epochMs);
          }
          draw(nowMs);
          reportRockets(inAir(nowMs));
        } catch (error) {
          fail(error);
          try {
            current.current.onLayers([]);
          } catch {
            // Nothing more to do: the next frame tries again.
          }
        }
      },
      onBarrage: (untilMs) => current.current.onBarrage(untilMs),
    });
    clockRef.current = clock;
    redrawRef.current = () => {
      if (!failed) draw(Date.now());
    };
    reportRockets(0);
    return () => {
      clock.dispose();
      clockRef.current = null;
      redrawRef.current = null;
      current.current.onLayers([]);
      reportRockets(0);
    };
  }, [map, running]);

  // A scheme switch changes the blending; a sleeping clock draws no frame.
  useEffect(() => {
    redrawRef.current?.();
  }, [scheme]);
}
