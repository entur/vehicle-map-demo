import { useEffect, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { WeatherReading, useWeather } from "../hooks/useWeather.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "./mapStyle.ts";

type WeatherFeedProps = {
  /** The Weather switch is on and the view is 3D. */
  enabled: boolean;
  /** The reading at the map's centre; empty while there is none to show. */
  onChange: (reading: WeatherReading) => void;
};

/**
 * Fetches the weather at the map's centre and reports the reading to
 * `MapView`, which hands its weather to the two things that draw it —
 * `WeatherOverlay`, the rain or snow, and `BaseMapScheme`, the sky — and its
 * numbers to `WeatherCard`. One reading, so the three always show the same
 * fetch. It is a component inside `<Map>` because the fetch follows the map.
 *
 * Only from the zoom where vehicles are 3D models: weather belongs to the
 * street-level scene, and further out it is rain on a map. Nothing is
 * fetched otherwise.
 */
export function WeatherFeed({ enabled, onChange }: WeatherFeedProps) {
  const atModelZoom = useAtModelZoom();
  const reading = useWeather(enabled && atModelZoom);
  useEffect(() => {
    onChange(reading);
  }, [reading, onChange]);
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
