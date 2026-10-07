import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

import {
  BEARING_ARROW_ICON,
  FOLLOW_BADGE_ICON,
  UNKNOWN_VEHICLE_ICON,
} from "../domain/vehicleIcons.ts";
import {
  VEHICLE_ICON_PIXEL_RATIO,
  bearingArrowImageData,
  followBadgeImageData,
  vehicleIconImageData,
} from "./drawVehicleIcon.ts";
import { VEHICLE_ICON_URLS } from "./vehicleIconImages.ts";
import redMarker from "../static/images/redUpdate.png";
import orangeMarker from "../static/images/yellowUpdate.png";
import greenMarker from "../static/images/greenUpdate.png";
import skullMarker from "../static/images/skull.png";
import redLight from "../static/images/redLight.png";
import orangeLight from "../static/images/orangeLight.png";
import greenLight from "../static/images/greenLight.png";
import occupancy0 from "../static/images/occupancy0.png";
import occupancy1 from "../static/images/occupancy1.png";
import occupancy2 from "../static/images/occupancy2.png";
import occupancy3 from "../static/images/occupancy3.png";
import occupancy4 from "../static/images/occupancy4.png";
import occupancy5 from "../static/images/occupancy5.png";
import occupancy6 from "../static/images/occupancy6.png";
import redSkull from "../static/images/skullRed.png";

const images = [
  { name: "red-marker", url: redMarker },
  { name: "orange-marker", url: orangeMarker },
  { name: "green-marker", url: greenMarker },
  { name: "skull-marker", url: skullMarker },
  { name: "red-light", url: redLight },
  { name: "orange-light", url: orangeLight },
  { name: "green-light", url: greenLight },
  { name: "occupancy0", url: occupancy0 },
  { name: "occupancy1", url: occupancy1 },
  { name: "occupancy2", url: occupancy2 },
  { name: "occupancy3", url: occupancy3 },
  { name: "occupancy4", url: occupancy4 },
  { name: "occupancy5", url: occupancy5 },
  { name: "occupancy6", url: occupancy6 },
  { name: "red-skull-marker", url: redSkull },
];

const vehicleIcons: [name: string, url: string | null][] = [
  ...Object.entries(VEHICLE_ICON_URLS),
  [UNKNOWN_VEHICLE_ICON, null],
];

/**
 * Names this app has registered, per map. An image that exists under one of
 * our names before we register it came from the base map sprite — the app's
 * icon would silently never show — so that is warned about. Kept per map
 * rather than per module so a new map instance (a remount, a hot reload) is
 * checked afresh instead of inheriting names registered on an old one.
 */
const registeredByMap = new WeakMap<object, Set<string>>();

/** True when `name` still has to be added; warns if the sprite has taken it. */
function needsRegistering(
  map: { hasImage(name: string): boolean },
  registered: Set<string>,
  name: string,
) {
  if (!map.hasImage(name)) return true;
  if (!registered.has(name)) {
    console.warn(
      `Map image "${name}" already exists before the app registered it; the base map sprite probably uses the same name, so the app's icon will not show.`,
    );
  }
  return false;
}

export function RegisterIcons() {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    let registered = registeredByMap.get(map);
    if (!registered) {
      registered = new Set();
      registeredByMap.set(map, registered);
    }

    const handleMapLoad = () => {
      images.forEach(async ({ name, url }) => {
        if (!needsRegistering(map, registered, name)) return;
        const response = await map.loadImage(url);
        if (response.data && !map.hasImage(name)) {
          map.addImage(name, response.data);
          registered.add(name);
        }
      });
      for (const [name, url] of vehicleIcons) {
        if (!needsRegistering(map, registered, name)) continue;
        vehicleIconImageData(url)
          .then((data) => {
            if (map.hasImage(name)) return;
            map.addImage(name, data, { pixelRatio: VEHICLE_ICON_PIXEL_RATIO });
            registered.add(name);
          })
          .catch((error: unknown) => console.error(error));
      }
      for (const [name, draw] of [
        [BEARING_ARROW_ICON, bearingArrowImageData],
        [FOLLOW_BADGE_ICON, followBadgeImageData],
      ] as const) {
        if (!needsRegistering(map, registered, name)) continue;
        map.addImage(name, draw(), { pixelRatio: VEHICLE_ICON_PIXEL_RATIO });
        registered.add(name);
      }
    };

    if (map.isStyleLoaded()) {
      handleMapLoad();
    } else {
      map.once("load", handleMapLoad);
    }

    return () => {
      map.off("load", handleMapLoad);
    };
  }, [mapRef]);

  return null;
}
