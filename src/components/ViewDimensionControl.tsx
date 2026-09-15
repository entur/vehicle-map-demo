import { useState } from "react";
import { createPortal } from "react-dom";
import { ControlPosition, useControl } from "react-map-gl/maplibre";
import { ViewDimension } from "../domain/viewDimension.ts";
import { PortalControl } from "./portalControl.ts";

type Props = {
  dimension: ViewDimension;
  setDimension: (dimension: ViewDimension) => void;
  position?: ControlPosition;
};

export function ViewDimensionControl({
  dimension,
  setDimension,
  position = "top-left",
}: Props) {
  const [control] = useState(() => new PortalControl());
  useControl(() => control, { position });

  // The button names the view it switches *to*, like a map-type toggle.
  const next = dimension === "3d" ? "2d" : "3d";
  const label = next === "3d" ? "Show 3D view" : "Show 2D view";

  return createPortal(
    <button
      type="button"
      className="view-dimension-button"
      title={label}
      aria-label={label}
      aria-pressed={dimension === "3d"}
      onClick={() => setDimension(next)}
    >
      {next.toUpperCase()}
    </button>,
    control.container,
  );
}
