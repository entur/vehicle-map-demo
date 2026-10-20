import { describe, expect, it } from "vitest";
import { pumpkinLayers } from "./pumpkinLayers.ts";
import type { Pumpkin } from "../../domain/pumpkinPlacement.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
} from "../Vehicle/vehicleModelLayers.ts";
import type { MapScheme } from "../basemap/basemap.ts";

const pumpkin = (key: string): Pumpkin => ({
  key,
  position: [10.75, 59.91],
  height: 2,
  yaw: 30,
  tint: [230, 120, 30],
});
const P = pumpkin("a#0");
const Q = pumpkin("b#0");

const options = (scheme: MapScheme = "light", visible = true) => ({
  visible,
  opacity: visible ? 1 : 0,
  scheme,
  getElevation: () => 0,
  positionTrigger: null,
});

describe("pumpkinLayers", () => {
  it("builds nothing while hidden or empty", () => {
    expect(pumpkinLayers([P], options("light", false))).toEqual([]);
    expect(pumpkinLayers([], options())).toEqual([]);
  });

  it("draws plain pumpkins in light mode: body and stems, no faces", () => {
    expect(pumpkinLayers([P, Q], options()).map((l) => l.id)).toEqual([
      "seasonal-pumpkins-body",
      "seasonal-pumpkins-stems",
    ]);
  });

  it("lights the faces as lamps in dark mode", () => {
    const layers = pumpkinLayers([P], options("dark"));
    const material = (id: string) =>
      layers.find((layer) => layer.id === id)?.props.material;
    expect(layers.map((l) => l.id)).toContain("seasonal-pumpkins-faces");
    expect(material("seasonal-pumpkins-faces")).toBe(
      MODEL_MATERIALS.dark.lamps,
    );
    expect(material("seasonal-pumpkins-body")).toBe(
      MODEL_MATERIALS.dark.shaded,
    );
    expect(material("seasonal-pumpkins-stems")).toBe(
      MODEL_MATERIALS.dark.shaded,
    );
  });

  // The destination signs once took the map from 25 to 1.9 fps by adding a
  // layer per sign; pumpkins are instances of one mesh, never a layer each.
  it("keeps the layer count fixed however many pumpkins there are", () => {
    const many = Array.from({ length: 200 }, (_, i) => pumpkin(`s${i}#0`));
    expect(pumpkinLayers(many, options("dark"))).toHaveLength(3);
  });

  it("draws under the vehicle icons", () => {
    for (const layer of pumpkinLayers([P], options("dark")))
      expect(layer.props.beforeId).toBe(MODEL_BEFORE_LAYER);
  });

  it("scales each pumpkin by its height and turns it by its yaw", () => {
    const [body] = pumpkinLayers([P], options());
    const { getScale, getOrientation, getColor } = body.props as unknown as {
      getScale: (p: Pumpkin) => number[];
      getOrientation: (p: Pumpkin) => number[];
      getColor: (p: Pumpkin) => number[];
    };
    expect(getScale(P)).toEqual([2, 2, 2]);
    expect(getOrientation(P)).toEqual([0, -30, 0]);
    expect(getColor(P)).toEqual([230, 120, 30]);
  });
});
