import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { Filter } from "../types.ts";
import { throttle } from "../utils/throttle.ts";
import { MODEL_REACH_METRES, padBounds } from "../domain/vehiclesInView.ts";

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
  paused,
}: {
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
  /**
   * While the chase camera runs it owns the bounding box: its pitched,
   * per-frame camera would otherwise balloon the box toward the horizon and
   * re-open the subscription twice a second. Unpausing captures the viewport
   * again straight away.
   */
  paused: boolean;
}) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map || paused) return;

    const handleMoveEnd = throttle(() => {
      const bounds = map.getMap().getBounds();
      // Padded by a model's reach: the box tests the vehicle's reported
      // position, its model's centre, so an unpadded box drops a train whose
      // front half is still on screen. Zoomed out the padding is nothing.
      const boundingBox: number[][] = padBounds(
        [
          [bounds.getWest(), bounds.getSouth()],
          [bounds.getEast(), bounds.getNorth()],
        ],
        MODEL_REACH_METRES,
      );

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
      // A trailing capture after this point would overwrite the box the
      // chase camera owns once it pauses us.
      handleMoveEnd.cancel();
    };
  }, [map, setCurrentFilter, paused]);

  return null;
}
