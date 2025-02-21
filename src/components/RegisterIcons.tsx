import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

import busIcon from "../static/images/bus.png";
import ferryIcon from "../static/images/ferry.png";
import trainIcon from "../static/images/train.png";
import tramIcon from "../static/images/tram.png";

// Prepare a small list of icons we want to register
const images = [
  { name: "bus-icon", url: busIcon },
  { name: "ferry-icon", url: ferryIcon },
  { name: "train-icon", url: trainIcon },
  { name: "tram-icon", url: tramIcon },
];

export function RegisterIcons() {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!mapRef) return; // map not yet initialized
    const map = mapRef.getMap();

    // We only want to load & add images after the map has loaded once.
    const handleMapLoad = () => {
      images.forEach(async ({ name, url }) => {
        // Avoid re-adding images if they are already added
        if (!map.hasImage(name)) {
          const response = await map.loadImage(url);
          if (response.data) {
            map.addImage(name, response.data);
          }
        }
      });
    };

    // If the map is already "loaded" (depending on how quickly it initializes),
    // you can call handleMapLoad immediately. Otherwise, wait for "load".
    if (map.isStyleLoaded()) {
      handleMapLoad();
    } else {
      map.once("load", handleMapLoad);
    }

    // Optional cleanup
    return () => {
      map.off("load", handleMapLoad);
      // Not strictly necessary to remove images, but you could do so if unmounting
    };
  }, [mapRef]);

  return null;
}
