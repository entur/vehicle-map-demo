import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  quantiseMapBearing,
  vehicleLabelAnchor,
  vehicleLabelOffset,
} from "../../domain/vehicleLabelPlacement.ts";
import { whenLayerExists } from "../../utils/whenLayerExists.ts";

const VEHICLE_LAYER = "vehicle-layer";

/**
 * Keeps line-code labels behind their vehicles on a rotated map. Style
 * expressions cannot read the map's bearing, so the label anchor and offset
 * are rebuilt with it baked in — in `MAP_BEARING_STEP` steps, since each
 * rebuild re-lays out every vehicle label and the chase camera turns the map
 * continuously.
 */
export function VehicleLabelPlacement() {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    // Unknown at first, so the first run always writes: a remount can find the
    // layer already rebuilt for some earlier rotation.
    let applied: number | null = null;
    const apply = () => {
      const bearing = quantiseMapBearing(map.getBearing());
      if (bearing === applied) return;
      applied = bearing;
      map.setLayoutProperty(
        VEHICLE_LAYER,
        "text-anchor",
        vehicleLabelAnchor(bearing),
      );
      map.setLayoutProperty(
        VEHICLE_LAYER,
        "text-offset",
        vehicleLabelOffset(bearing),
      );
    };

    let listening = false;
    const cancel = whenLayerExists(map, VEHICLE_LAYER, () => {
      apply();
      map.on("rotate", apply);
      listening = true;
    });
    return () => {
      cancel();
      if (listening) map.off("rotate", apply);
    };
  }, [mapRef]);

  return null;
}
