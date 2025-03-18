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
