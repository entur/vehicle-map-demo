import { useState } from "react";
import { createPortal } from "react-dom";
import { ControlPosition, useControl, useMap } from "react-map-gl/maplibre";
import { RotationDirection, rotatedBearing } from "../domain/viewDimension.ts";
import { PortalControl } from "./portalControl.ts";

/**
 * Labelled and drawn by how the map turns on screen, which is the opposite of
 * the bearing: raising the bearing swings the camera clockwise, so the map
 * itself turns counterclockwise.
 */
const BUTTONS: { direction: RotationDirection; label: string; path: string }[] =
  [
    {
      direction: "clockwise",
      label: "Rotate map counterclockwise",
      path: "M7.5 4.5 3.5 8l4 3.5M4 8h7.5a5 5 0 1 1-4.6 7",
    },
    {
      direction: "counterclockwise",
      label: "Rotate map clockwise",
      path: "M14.5 4.5 18.5 8l-4 3.5M18 8h-7.5a5 5 0 1 0 4.6 7",
    },
  ];

/**
 * Buttons that turn the map a fixed step about its centre, so a 3D view can
 * be swung round to see behind buildings without knowing the right-drag or
 * Ctrl-drag gesture that does the same. Rendered only in 3D; the compass still
 * returns the map to north.
 */
export function RotateControl({
  position = "top-left",
}: {
  position?: ControlPosition;
}) {
  const [control] = useState(() => new PortalControl());
  useControl(() => control, { position });
  const { current: mapRef } = useMap();

  const rotate = (direction: RotationDirection) => {
    const map = mapRef?.getMap();
    if (!map) return;
    map.easeTo({
      bearing: rotatedBearing(map.getBearing(), direction),
      duration: 500,
    });
  };

  return createPortal(
    <>
      {BUTTONS.map(({ direction, label, path }) => (
        <button
          key={direction}
          type="button"
          className="rotate-button"
          title={label}
          aria-label={label}
          onClick={() => rotate(direction)}
        >
          <svg viewBox="0 0 22 22" width="18" height="18" aria-hidden="true">
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </>,
    control.container,
  );
}
