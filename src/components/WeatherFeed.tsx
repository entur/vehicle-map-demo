import { useEffect, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useWeather } from "../hooks/useWeather.ts";
import { Weather } from "../domain/weather.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "./mapStyle.ts";

type WeatherFeedProps = {
  /** The Weather switch is on and the view is 3D. */
  enabled: boolean;
  /** The weather at the map's centre, or null while there is none to show. */
  onChange: (weather: Weather | null) => void;
};

/**
 * Fetches the weather at the map's centre and reports it to `MapView`, which
 * hands it to the two things that draw it: `WeatherOverlay`, the rain or
 * snow, and `BaseMapScheme`, the sky. It is a component inside `<Map>`
 * because the fetch follows the map.
 *
 * Only from the zoom where vehicles are 3D models: weather belongs to the
 * street-level scene, and further out it is rain on a map. Nothing is
 * fetched otherwise.
 */
export function WeatherFeed({ enabled, onChange }: WeatherFeedProps) {
  const atModelZoom = useAtModelZoom();
  const weather = useWeather(enabled && atModelZoom);
  useEffect(() => {
    onChange(weather);
  }, [weather, onChange]);
  return null;
}

/** Whether the map is zoomed in to where vehicles are drawn as 3D models. */
function useAtModelZoom(): boolean {
  const { current: mapRef } = useMap();
  const [atModelZoom, setAtModelZoom] = useState(
    () => (mapRef?.getZoom() ?? 0) >= VEHICLE_MODEL_MIN_ZOOM,
  );
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const update = () =>
      setAtModelZoom(map.getZoom() >= VEHICLE_MODEL_MIN_ZOOM);
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [mapRef]);
  return atModelZoom;
}
