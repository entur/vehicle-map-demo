import type { Map } from "maplibre-gl";
import {
  BOUNDS_REFERENCE_PITCH,
  ViewBounds,
  ViewCamera,
  capViewBounds,
} from "../domain/vehiclesInView.ts";

/** The map's camera as the view-bounds rules take it. */
export function viewCamera(map: Map): ViewCamera {
  const { lng, lat } = map.getCenter();
  const container = map.getContainer();
  return {
    longitude: lng,
    latitude: lat,
    zoom: map.getZoom(),
    width: container.clientWidth,
    height: container.clientHeight,
    fov: map.getVerticalFieldOfView(),
    padding: map.getPadding(),
  };
}

/**
 * The map's bounds, held to what `capViewBounds` allows once the view is
 * tilted towards the horizon. Up to the reference pitch they are
 * `getBounds()` exactly.
 */
export function cappedViewBounds(map: Map): ViewBounds {
  const bounds = map.getBounds();
  const whole: ViewBounds = [
    [bounds.getWest(), bounds.getSouth()],
    [bounds.getEast(), bounds.getNorth()],
  ];
  if (map.getPitch() <= BOUNDS_REFERENCE_PITCH) return whole;
  return capViewBounds(whole, viewCamera(map));
}
