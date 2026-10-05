import { IControl } from "react-map-gl/maplibre";

/**
 * An empty MapLibre control container. Buttons are rendered into it with a
 * portal so they stay ordinary React components and sit in the control stack
 * with the zoom and geolocate buttons, styled like them.
 */
export class PortalControl implements IControl {
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
