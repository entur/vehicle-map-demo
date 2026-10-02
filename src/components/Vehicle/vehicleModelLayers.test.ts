import { beforeAll, describe, expect, it, vi } from "vitest";
import { VehicleUpdate } from "../../types.ts";
import { MODEL_MATERIALS, vehicleModelLayers } from "./vehicleModelLayers.ts";
import type { MapScheme } from "../basemap/basemap.ts";

const bus = (vehicleId: string, destinationName: string): VehicleUpdate =>
  ({
    vehicleId,
    mode: "BUS",
    bearing: 90,
    destinationName,
    line: { lineRef: "RUT:Line:1", lineName: "", publicCode: "1" },
    location: { latitude: 59.91, longitude: 10.75 },
    serviceJourney: { id: "RUT:ServiceJourney:" + vehicleId, date: "" },
  }) as VehicleUpdate;

const options = (visible: boolean, scheme: MapScheme = "light") => ({
  idPrefix: "models",
  visible,
  opacity: visible ? 1 : 0,
  scheme,
  getPosition: () => [10.75, 59.91, 0] as [number, number, number],
  positionTrigger: null,
});

describe("vehicleModelLayers", () => {
  // The tests run in node: a canvas that cannot draw is enough to count layers.
  beforeAll(() => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });
  });

  // Zoomed out, every vehicle in the feed is in the subscription, and one sign
  // layer per destination came to over 1,600 layers, each with a texture to
  // draw and upload, for models nobody could see.
  it("builds no layers while the models are hidden", () => {
    const vehicles = [bus("1", "Ullevål"), bus("2", "Kolsås")];
    expect(vehicleModelLayers(vehicles, options(false))).toEqual([]);
  });

  it("builds a sign layer per destination once the models show", () => {
    const vehicles = [bus("1", "Ullevål"), bus("2", "Kolsås")];
    const ids = vehicleModelLayers(vehicles, options(true)).map((l) => l.id);
    expect(ids.filter((id) => id.includes("-sign-"))).toHaveLength(2);
  });

  it("lights every part of the model by the colour scheme", () => {
    const vehicles = [bus("1", "Ullevål"), { ...bus("2", ""), bearing: null }];
    for (const scheme of ["light", "dark"] as const) {
      const layers = vehicleModelLayers(vehicles, options(true, scheme));
      const material = (part: string) =>
        layers.find((layer) => layer.id.includes(part))?.props.material;
      const expected = MODEL_MATERIALS[scheme];
      expect(material("-BUS-body"), scheme).toBe(expected.shaded);
      expect(material("-BUS-details"), scheme).toBe(expected.shaded);
      expect(material("-unknown-heading"), scheme).toBe(expected.shaded);
      expect(material("-BUS-lamps"), scheme).toBe(expected.lamps);
      expect(material("-BUS-sign-"), scheme).toBe(expected.signs);
    }
  });
});
