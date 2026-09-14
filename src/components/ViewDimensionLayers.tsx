import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  VIEW_3D_LAYERS,
  ViewDimension,
  cameraFor,
  terrainFor,
} from "../domain/viewDimension.ts";

/**
 * Turns terrain on or off, reveals the 3D-only base layers and tilts the
 * camera. Terrain is set here rather than through `<Map terrain>`: that prop
 * ignores `undefined` and its types reject the `null` that removes terrain.
 *
 * The camera only moves when the pitch differs, so a 2D first load does not
 * fire a spurious moveend (and with it a bounding-box update).
 */
export function ViewDimensionLayers({
  dimension,
}: {
  dimension: ViewDimension;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const apply = () => {
      map.setTerrain(terrainFor(dimension));
      const visibility = dimension === "3d" ? "visible" : "none";
      for (const id of VIEW_3D_LAYERS) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", visibility);
        }
      }
      const { pitch } = cameraFor(dimension);
      if (map.getPitch() !== pitch) {
        map.easeTo({ pitch, duration: 800 });
      }
    };

    // Same style-loaded guard as ModeLayers, for the same reason.
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("idle", apply);
    return () => {
      map.off("idle", apply);
    };
  }, [dimension, mapRef]);

  return null;
}
