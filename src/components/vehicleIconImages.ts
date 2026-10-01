import busSvg from "../static/images/vehicles/bus.svg?url";
import coachSvg from "../static/images/vehicles/coach.svg?url";
import metroSvg from "../static/images/vehicles/metro.svg?url";
import railSvg from "../static/images/vehicles/rail.svg?url";
import tramSvg from "../static/images/vehicles/tram.svg?url";
import waterSvg from "../static/images/vehicles/water.svg?url";

/** Source SVG per map image name (see vehicleIcons.ts); the generic icon has none. */
export const VEHICLE_ICON_URLS: Record<string, string> = {
  "vehicle-bus": busSvg,
  "vehicle-coach": coachSvg,
  "vehicle-metro": metroSvg,
  "vehicle-rail": railSvg,
  "vehicle-tram": tramSvg,
  "vehicle-water": waterSvg,
};
