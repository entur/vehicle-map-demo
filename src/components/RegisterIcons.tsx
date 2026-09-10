import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

import busIcon from "../static/images/bus.png";
import ferryIcon from "../static/images/ferry.png";
import trainIcon from "../static/images/train.png";
import tramIcon from "../static/images/tram.png";
import greenMarkerIcon from "../static/images/markerGreen.png";
import redMarker from "../static/images/redUpdate.png";
import orangeMarker from "../static/images/yellowUpdate.png";
import greenMarker from "../static/images/greenUpdate.png";
import skullMarker from "../static/images/skull.png";
import redLight from "../static/images/redLight.png";
import orangeLight from "../static/images/orangeLight.png";
import greenLight from "../static/images/greenLight.png";
import ufo from "../static/images/ufo.png";
import occupancy0 from "../static/images/occupancy0.png";
import occupancy1 from "../static/images/occupancy1.png";
import occupancy2 from "../static/images/occupancy2.png";
import occupancy3 from "../static/images/occupancy3.png";
import occupancy4 from "../static/images/occupancy4.png";
import occupancy5 from "../static/images/occupancy5.png";
import occupancy6 from "../static/images/occupancy6.png";
import redSkull from "../static/images/skullRed.png";

const images = [
  { name: "bus-icon", url: busIcon },
  { name: "ferry-icon", url: ferryIcon },
  { name: "train-icon", url: trainIcon },
  { name: "tram-icon", url: tramIcon },
  { name: "green-marker-icon", url: greenMarkerIcon },
  { name: "red-marker", url: redMarker },
  { name: "orange-marker", url: orangeMarker },
  { name: "green-marker", url: greenMarker },
  { name: "skull-marker", url: skullMarker },
  { name: "red-light", url: redLight },
  { name: "orange-light", url: orangeLight },
  { name: "green-light", url: greenLight },
  { name: "ufo", url: ufo },
  { name: "occupancy0", url: occupancy0 },
  { name: "occupancy1", url: occupancy1 },
  { name: "occupancy2", url: occupancy2 },
  { name: "occupancy3", url: occupancy3 },
  { name: "occupancy4", url: occupancy4 },
  { name: "occupancy5", url: occupancy5 },
  { name: "occupancy6", url: occupancy6 },
  { name: "red-skull-marker", url: redSkull },
];

export function RegisterIcons() {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    const handleMapLoad = () => {
      images.forEach(async ({ name, url }) => {
        if (!map.hasImage(name)) {
          const response = await map.loadImage(url);
          if (response.data) {
            map.addImage(name, response.data);
          }
        }
      });
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
