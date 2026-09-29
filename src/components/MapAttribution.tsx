import { useEffect, useState } from "react";
import { AttributionControl, useMap } from "react-map-gl/maplibre";

type MapAttributionProps = {
  /** A phone's layout: the attribution goes in the top-left stack. */
  narrow: boolean;
  /** Collapse it to its button, as MapLibre does on the map's first drag. */
  collapse: boolean;
};

/**
 * How long the attribution is shown before it collapses on its own. The OSMF
 * attribution guidelines allow a collapse "automatically after five seconds",
 * as well as on map interaction, but not starting collapsed.
 */
const SHOWN_FOR_MS = 5000;

/**
 * The map's attribution. On a wide screen, MapLibre's own place at the bottom
 * right. On a phone, at the foot of the top-left control stack (kept there by
 * CSS order, whatever mounts after it): at the bottom the detail sheet covers
 * it, and lifted above the sheet and a chase's HUD it went under the toolbar.
 *
 * On a narrow map MapLibre shows it expanded until the map is first dragged,
 * which leaves it across the map for as long as nobody drags, and a chase
 * disables dragging. Expanded in the stack it covers the HUD. So it also
 * collapses after `SHOWN_FOR_MS`, and when the sheet opens — tapping a
 * vehicle is map interaction, which the guidelines count as a drag does. Its
 * button still expands it.
 */
export function MapAttribution({ narrow, collapse }: MapAttributionProps) {
  const { current: mapRef } = useMap();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SHOWN_FOR_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!collapse && !shown) return;
    mapRef
      ?.getContainer()
      .querySelector(".maplibregl-ctrl-attrib.maplibregl-compact")
      ?.classList.remove("maplibregl-compact-show");
  }, [mapRef, collapse, shown, narrow]);

  // Keyed so a move re-adds it: a MapLibre control cannot change position.
  const position = narrow ? "top-left" : "bottom-right";
  return <AttributionControl key={position} position={position} />;
}
