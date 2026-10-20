import { useEffect, useState } from "react";
import type { Layer } from "@deck.gl/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Season } from "../../domain/season.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import { cappedViewBounds } from "../../utils/cappedViewBounds.ts";
import { pumpkinLayers } from "./pumpkinLayers.ts";
import {
  DecorationController,
  NOTHING_PLACED,
  Placed,
} from "./decorationController.ts";
import { DECORATIONS } from "../../domain/decorationPlacement.ts";

/**
 * How often pumpkins are placed again during a chase. Its camera fires
 * `moveend` every frame, and placement is far too much work for that.
 */
export const PUMPKIN_CHASE_INTERVAL_MS = 1000;
/** Outside a chase: often enough to follow tiles as they load. */
const PUMPKIN_INTERVAL_MS = 250;

type PumpkinWindow = { __pumpkins?: { count: number } };

/**
 * The seasonal pumpkins, handed to `onLayers` as deck.gl layers:
 * `VehicleModels` owns the map's only interleaved overlay and draws them with
 * everything else 3D.
 *
 * Placing them (`DecorationController`) and drawing them are separate. Placing
 * runs only while the season is on and the models are shown (zoom 16 and
 * up), and starts afresh when a chase starts or ends; the models' fade-in
 * steps their opacity twenty times, and a scheme switch changes their
 * lighting, and both only draw the same pumpkins again. Off-season nothing is
 * listened to or read.
 */
export function usePumpkins({
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
      intervalMs: chasing ? PUMPKIN_CHASE_INTERVAL_MS : PUMPKIN_INTERVAL_MS,
      onPlaced: setPlaced,
    });
    return () => {
      controller.dispose();
      setPlaced(NOTHING_PLACED);
    };
  }, [map, season, visible, chasing]);

  useEffect(() => {
    const elevationOf = new Map(
      placed.decorations.map((pumpkin, i) => [pumpkin, placed.elevations[i]]),
    );
    onLayers(
      pumpkinLayers(placed.decorations, {
        visible,
        opacity,
        scheme,
        getElevation: (pumpkin) => elevationOf.get(pumpkin) ?? 0,
        positionTrigger: placed.key,
      }),
    );
  }, [placed, visible, opacity, scheme, onLayers]);

  // Lets the Playwright tests see the pumpkins. Development builds only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as PumpkinWindow).__pumpkins =
      season === null ? undefined : { count: placed.decorations.length };
  }, [season, placed]);
}
