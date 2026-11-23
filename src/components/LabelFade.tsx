import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

/**
 * Turns MapLibre's label fade off when `fade` is false (`labelFade` in
 * `QUALITY_SETTINGS`, which says why). `fadeDuration` is a constructor
 * option with no setter, so the map's own field is written; it is declared
 * in MapLibre's types and read afresh on every frame. Restored to whatever
 * the map was built with.
 */
export function LabelFade({ fade }: { fade: boolean }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || fade) return;
    const own = map._fadeDuration;
    map._fadeDuration = 0;
    return () => {
      map._fadeDuration = own;
    };
  }, [mapRef, fade]);

  return null;
}
