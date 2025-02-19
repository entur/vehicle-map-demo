import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { Filter } from "./types";

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

export function CaptureBoundingBox({
  setCurrentFilter,
}: {
  currentFilter: Filter | null;
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
}) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;

    // We define the callback *inside* the effect
    const handleMoveEnd = throttle(() => {
      const bounds = map.getMap().getBounds();
      const boundingBox = [
        [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
      ];

      // Use the *functional* form
      setCurrentFilter((prevFilter) => {
        // If you’ve allowed null, you need to handle it safely
        // Example: return a brand new filter if prevFilter is null
        if (!prevFilter) {
          return {
            // fill in whatever defaults you need
            codespaceId: "",
            boundingBox,
          };
        }

        // If boundingBox didn’t actually change, return prevFilter to avoid spurious updates
        // (Optional) But can help prevent repeated renders
        if (arraysAreEqual(prevFilter.boundingBox, boundingBox)) {
          return prevFilter;
        }

        // Otherwise merge the new bounding box
        return {
          ...prevFilter,
          boundingBox,
        };
      });
    }, 500);

    // Attach the moveend listener
    const mapInstance = map.getMap();
    mapInstance.on("moveend", handleMoveEnd);

    // Call once to initialize boundingBox
    handleMoveEnd();

    // Clean up listener on unmount (or if 'map' changes)
    return () => {
      mapInstance.off("moveend", handleMoveEnd);
    };

    // IMPORTANT:
    // *Only* list dependencies that truly require re-attaching the listener
  }, [map, setCurrentFilter]);

  return null;
}

// Simple boundingBox comparison to avoid unnecessary re-renders
function arraysAreEqual(a?: number[][], b?: number[][]) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}
