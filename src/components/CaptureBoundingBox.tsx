import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { Filter } from "../types.ts";

// a simple throttle
const throttle = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number,
) => {
  let isWaiting = false;
  return (...args: T) => {
    if (isWaiting) return;
    callback(...args);
    isWaiting = true;
    setTimeout(() => (isWaiting = false), delay);
  };
};

// Simple boundingBox comparison to avoid unnecessary re-renders
const arraysAreEqual = (a?: number[][], b?: number[][]) => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
};

export function CaptureBoundingBox({
  setCurrentFilter,
}: {
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
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

      setCurrentFilter((prevFilter) => {
        if (!prevFilter) {
          return {
            boundingBox,
          };
        }

        if (arraysAreEqual(prevFilter.boundingBox, boundingBox)) {
          return prevFilter;
        }

        return {
          ...prevFilter,
          boundingBox,
        };
      });
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
