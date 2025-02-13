import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { Filter } from "./types.ts";

const throttle = <T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number,
) => {
  let isWaiting = false;

  return (...args: T) => {
    if (isWaiting) {
      return;
    }

    callback(...args);
    isWaiting = true;

    setTimeout(() => {
      isWaiting = false;
    }, delay);
  };
};

export function CaptureBoundingBox({
  setCurrentFilter,
}: {
  setCurrentFilter: (filter: Filter) => void;
}) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;
    const handleMoveEnd = throttle(() => {
      const bounds = map.getMap().getBounds();
      const boundingBox = [
        [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
      ];
      setCurrentFilter({ boundingBox });
    }, 500);
    const mapInstance = map.getMap();
    mapInstance.on("moveend", handleMoveEnd);

    handleMoveEnd();

    return () => {
      mapInstance.off("moveend", handleMoveEnd);
    };
  }, [map, setCurrentFilter]);

  return null;
}
