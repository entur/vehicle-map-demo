import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  VIEW_3D_LAYERS,
  ViewDimension,
  cameraFor,
  terrainFor,
} from "../domain/viewDimension.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";

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

    // Only the style needs to be parsed; see whenLayerExists for why this is
    // not map.isStyleLoaded().
    return whenLayerExists(map, VIEW_3D_LAYERS[0], apply);
  }, [dimension, mapRef]);

  return null;
}
