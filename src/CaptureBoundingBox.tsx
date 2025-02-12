import {Filter} from "./types.ts";
import {useMap} from "react-map-gl/maplibre";
import {useEffect} from "react";

export function CaptureBoundingBox({setCurrentFilter} : {setCurrentFilter: (filter: Filter) => void}) {
  const {current: map} = useMap();

  const currentBoundingBox = [
    [map?.getMap().getBounds().getSouthWest().lng, map?.getMap().getBounds().getSouthWest().lat],
    [map?.getMap().getBounds().getNorthEast().lng, map?.getMap().getBounds().getNorthEast().lat]
  ];

  useEffect (() => {
    setCurrentFilter({boundingBox: currentBoundingBox});
  }, [currentBoundingBox[0][0] , currentBoundingBox[0][1], currentBoundingBox[1][0], currentBoundingBox[1][1]]);
  return null;
}
