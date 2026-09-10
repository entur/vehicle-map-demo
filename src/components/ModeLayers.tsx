import { GeoJSONSource } from "maplibre-gl";
import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  AppMode,
  MODE_DEFAULT_VISIBLE_LAYERS,
  MODE_LAYERS,
  MODE_SOURCES,
  MODE_SWITCHED_LAYERS,
  otherMode,
} from "../domain/appMode.ts";
import { MapViewOptions } from "../types.ts";

const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [],
};

/**
 * Layers and sources are declared statically in mapStyle and are never added or
 * removed, so leaving a mode does not unmount its layers — it just stops
 * feeding them. This is what actually hides them.
 *
 * Switch-owned layers (`MODE_SWITCHED_LAYERS`) are revealed on entry according
 * to the current MapViewOptions. Layers with no switch but that must always be
 * visible within their mode (`MODE_DEFAULT_VISIBLE_LAYERS`) are unconditionally
 * revealed on entry — their content is governed by whether their source has
 * features, not by a visibility toggle.
 */
export function ModeLayers({
  mode,
  mapViewOptions,
}: {
  mode: AppMode;
  mapViewOptions: MapViewOptions;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const apply = () => {
      const leaving = otherMode(mode);

      for (const id of MODE_LAYERS[leaving]) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        }
      }

      const switched = MODE_SWITCHED_LAYERS[mode];
      for (const id of MODE_LAYERS[mode]) {
        if (!map.getLayer(id)) continue;
        const optionKey = switched[id];
        if (!optionKey) continue;
        map.setLayoutProperty(
          id,
          "visibility",
          mapViewOptions[optionKey] ? "visible" : "none",
        );
      }

      for (const id of MODE_DEFAULT_VISIBLE_LAYERS[mode]) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", "visible");
        }
      }

      for (const sourceId of MODE_SOURCES[leaving]) {
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
        source?.setData(EMPTY_FEATURE_COLLECTION);
      }
    };

    // getLayer/getSource return undefined until the style has loaded, and this
    // effect can run first. Same hazard the vehicle and situation source
    // writers already guard against. Unlike "load", "idle" fires every time
    // the map settles after rendering rather than once per Map instance, so
    // the fallback below can still fire on a later effect run even if an
    // earlier run already consumed a "load"/"idle" event — isStyleLoaded()
    // can go transiently false again well after the initial load.
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("idle", apply);
    // If the effect re-runs before "idle" fires, drop the pending handler —
    // otherwise each run stacks another one and they all fire at once.
    return () => {
      map.off("idle", apply);
    };
  }, [mode, mapRef, mapViewOptions]);

  return null;
}
