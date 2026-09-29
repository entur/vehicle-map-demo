import { useLayoutEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { setPaddingInPlace } from "../utils/setPaddingInPlace.ts";

/** How far above the sheet's edge a selection must sit to count as in view. */
const IN_VIEW_MARGIN = 40;

type MapBottomPaddingProps = {
  /** px of the map's bottom edge hidden by the detail sheet; 0 when there is none. */
  bottom: number;
  /** The selection to bring out from under the sheet, if it lands there. */
  keepInView: [number, number] | null;
};

/**
 * Pads the map's bottom edge by what the phone's detail sheet hides, so every
 * camera move that centres on something — following a vehicle, framing a
 * situation, a chase — centres it in the part of the map still visible.
 *
 * A layout effect, so the padding is in place before the passive effects of
 * the same commit run: selecting a situation opens the sheet and fits the map
 * to it in one render, and the fit must already see the sheet.
 *
 * The padding is changed in place (see `setPaddingInPlace`), so opening,
 * resizing or closing the sheet leaves the map where it was on screen.
 */
export function MapBottomPadding({
  bottom,
  keepInView,
}: MapBottomPaddingProps) {
  const { current: mapRef } = useMap();
  const [lon, lat] = keepInView ?? [null, null];

  useLayoutEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    setPaddingInPlace(map, { bottom });
    // Typed partial, but MapLibre always returns all four edges.
    const top = map.getPadding().top ?? 0;

    if (lon === null || lat === null) return;
    const point = map.project([lon, lat]);
    const { clientWidth: w, clientHeight: h } = map.getCanvas();
    const visible =
      point.x >= 0 &&
      point.x <= w &&
      point.y >= top &&
      point.y <= h - bottom - IN_VIEW_MARGIN;
    if (!visible) {
      map.easeTo({ center: [lon, lat], duration: 400, essential: true });
    }
  }, [mapRef, bottom, lon, lat]);

  return null;
}
