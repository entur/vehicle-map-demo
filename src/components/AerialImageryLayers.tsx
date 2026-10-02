import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { AERIAL_LAYER } from "../domain/aerialImagery.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";

/** Shows or hides the aerial photo layer. Sole owner of its visibility. */
export function AerialImageryLayers({ visible }: { visible: boolean }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    // See whenLayerExists for why this is not map.isStyleLoaded().
    return whenLayerExists(map, AERIAL_LAYER, () => {
      map.setLayoutProperty(
        AERIAL_LAYER,
        "visibility",
        visible ? "visible" : "none",
      );
    });
  }, [visible, mapRef]);

  return null;
}
