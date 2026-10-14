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
 * change of `credit` remounts the control and the strip is then a new
 * element. The height is therefore read from whichever strip is in the
 * corner when the corner changes size, never from one strip held on to: the
 * old strip is still in the document when this effect runs, and measuring it
 * reported 0 once it was removed, which sank the sheet over the new credit.
 */
export function MapAttribution({
  onHeightChange,
  credit,
}: MapAttributionProps) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const corner = mapRef
      ?.getContainer()
      .querySelector<HTMLElement>(".maplibregl-ctrl-bottom-right");
    if (!corner) return;
    const report = () =>
      onHeightChange(
        corner.querySelector<HTMLElement>(".maplibregl-ctrl-attrib")
          ?.offsetHeight ?? 0,
      );
    report();
    const observer = new ResizeObserver(report);
    observer.observe(corner);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [mapRef, onHeightChange]);

  return (
    <AttributionControl
      key={credit}
      position="bottom-right"
      compact={false}
      customAttribution={credit}
    />
  );
}
