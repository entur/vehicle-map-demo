import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

export function UserPositionDetector() {
  const map = useMap();
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      map.current?.getMap().setCenter({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
      map.current?.getMap().setZoom(14);
    });
  }, [map]);
  return null;
}
