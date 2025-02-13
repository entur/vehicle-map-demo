import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { Filter } from "./types.ts";

export function CaptureBoundingBox({
  setCurrentFilter,
}: {
  setCurrentFilter: (filter: Filter) => void;
}) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;
    const handleMoveEnd = () => {
      const bounds = map.getMap().getBounds();
      const boundingBox = [
        [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
      ];
      setCurrentFilter({ boundingBox });
    };
    const mapInstance = map.getMap();
    mapInstance.on("moveend", handleMoveEnd);

    handleMoveEnd();

    return () => {
      mapInstance.off("moveend", handleMoveEnd);
    };
  }, [map, setCurrentFilter]);

  return null;
}
