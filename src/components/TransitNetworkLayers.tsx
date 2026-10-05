import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { TRANSIT_NETWORK_LAYERS } from "../domain/transitNetwork.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";

/**
 * Shows or hides the transit network drawn from the base map's tiles. Sole
 * owner of those layers' visibility; their colours follow the scheme through
 * BaseMapScheme. Mode switches never touch them.
 */
export function TransitNetworkLayers({ visible }: { visible: boolean }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const apply = () => {
      const visibility = visible ? "visible" : "none";
      for (const id of TRANSIT_NETWORK_LAYERS) {
        if (map.getLayoutProperty(id, "visibility") !== visibility) {
          map.setLayoutProperty(id, "visibility", visibility);
        }
      }
    };

    // See whenLayerExists for why this is not map.isStyleLoaded().
    return whenLayerExists(map, TRANSIT_NETWORK_LAYERS[0], apply);
  }, [visible, mapRef]);

  return null;
}
