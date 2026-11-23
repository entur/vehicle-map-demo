import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  VIEW_3D_LAYERS,
  ViewDimension,
  cameraFor,
  terrainFor,
  visible3dLayers,
} from "../domain/viewDimension.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";
import { buildingsOpacity } from "./mapStyle.ts";

/**
 * Turns terrain on or off, reveals the 3D-only base layers and tilts the
 * camera. Terrain is set here rather than through `<Map terrain>`: that prop
 * ignores `undefined` and its types reject the `null` that removes terrain.
 *
 * The camera only moves when the pitch or bearing differs, so a 2D first load
 * does not fire a spurious moveend (and with it a bounding-box update).
 *
 * `camera`, while a fixed-view kiosk runs, replaces the dimension's own pitch
 * and bearing, which would otherwise tilt its view to 55° when a `?view=3d`
 * link is read after the map opened on the kiosk's camera. Read when the
 * dimension changes and not otherwise, so a kiosk pausing or resuming moves
 * nothing by itself.
 *
 * `hillshade` and `translucentBuildings` are the render quality's: the
 * hillshade stays hidden in 3D without the first, the buildings are drawn
 * opaque without the second. Both are set apart from the camera, so a
 * quality change moves nothing.
 */
export function ViewDimensionLayers({
  dimension,
  hillshade,
  translucentBuildings,
  camera,
}: {
  dimension: ViewDimension;
  hillshade: boolean;
  translucentBuildings: boolean;
  camera?: { pitch: number; bearing: number };
}) {
  const { current: mapRef } = useMap();
  const cameraOverride = useRef(camera);
  // Declared first, so it lands before the effect below in the same commit.
  useEffect(() => {
    cameraOverride.current = camera;
  });

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const apply = () => {
      map.setTerrain(terrainFor(dimension));
      const target = cameraOverride.current ?? cameraFor(dimension);
      if (
        map.getPitch() !== target.pitch ||
        (target.bearing !== undefined && map.getBearing() !== target.bearing)
      ) {
        map.easeTo({ ...target, duration: 800 });
      }
    };

    // Only the style needs to be parsed; see whenLayerExists for why this is
    // not map.isStyleLoaded().
    return whenLayerExists(map, VIEW_3D_LAYERS[0], apply);
  }, [dimension, mapRef]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const visible = visible3dLayers(dimension, hillshade);
    return whenLayerExists(map, VIEW_3D_LAYERS[0], () => {
      for (const id of VIEW_3D_LAYERS) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(
            id,
            "visibility",
            visible.includes(id) ? "visible" : "none",
          );
        }
      }
    });
  }, [dimension, hillshade, mapRef]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    return whenLayerExists(map, "buildings-3d-layer", () =>
      map.setPaintProperty(
        "buildings-3d-layer",
        "fill-extrusion-opacity",
        buildingsOpacity(translucentBuildings),
      ),
    );
  }, [translucentBuildings, mapRef]);

  return null;
}
