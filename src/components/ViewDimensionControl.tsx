import { useState } from "react";
import { createPortal } from "react-dom";
import { ControlPosition, IControl, useControl } from "react-map-gl/maplibre";
import { ViewDimension } from "../domain/viewDimension.ts";

/**
 * An empty MapLibre control container. The button is rendered into it with a
 * portal so it stays an ordinary React component and sits in the control
 * stack with the zoom and geolocate buttons, styled like them.
 */
class PortalControl implements IControl {
  readonly container = document.createElement("div");

  constructor() {
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";
  }

  onAdd() {
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

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
