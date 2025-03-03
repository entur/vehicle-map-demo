import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

import busIcon from "../static/images/bus.png";
import ferryIcon from "../static/images/ferry.png";
import trainIcon from "../static/images/train.png";
import tramIcon from "../static/images/tram.png";
import eyeIcon from "../static/images/eye.png";

const images = [
  { name: "bus-icon", url: busIcon },
  { name: "ferry-icon", url: ferryIcon },
  { name: "train-icon", url: trainIcon },
  { name: "tram-icon", url: tramIcon },
  { name: "eye-icon", url: eyeIcon },
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
