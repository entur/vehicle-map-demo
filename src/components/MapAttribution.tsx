import { useEffect } from "react";
import { AttributionControl, useMap } from "react-map-gl/maplibre";

type MapAttributionProps = {
  /** Told the strip's height in px whenever it changes, 0 when it is gone. */
  onHeightChange: (px: number) => void;
  /** A credit, as HTML, for something that is not a map source. */
  credit?: string;
};

/**
 * The map's attribution: a strip of small type flush in the bottom-right
 * corner on every screen, as other maps have it. Never collapsed to
 * MapLibre's compact button, which it would otherwise be on a narrow map.
 *
 * Its height is reported because on a phone it wraps — the terrain and the
 * aerial imagery each add a credit — and the detail sheet stands clear above
 * it (`sheetBottom`) rather than covering it. Observed, since the credits
 * change with the layers shown.
 *
 * MapLibre reads a control's custom attribution once, when it is added, so a
 * change of `credit` remounts the control; the strip is then a new element,
 * which is why the effect depends on `credit` too.
 */
export function MapAttribution({
  onHeightChange,
  credit,
}: MapAttributionProps) {
  const { current: mapRef } = useMap();

  // Runs after AttributionControl's own effect has added the control.
  useEffect(() => {
    const strip = mapRef
      ?.getContainer()
      .querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
    if (!strip) return;
    const report = () => onHeightChange(strip.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(strip);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [mapRef, onHeightChange, credit]);

  return (
    <AttributionControl
      key={credit}
      position="bottom-right"
      compact={false}
      customAttribution={credit}
    />
  );
}
