import { describe, expect, it } from "vitest";
import { withLayerAsStyleLoaded } from "./withLayerAsStyleLoaded.ts";

/** Like a MapLibre map: `isStyleLoaded` lives on the prototype. */
class FakeMap {
  layers = new Set<string>();
  isStyleLoaded(): boolean {
    // Streaming vehicle frames keep a source busy, so this stays false.
    return false;
  }
  getLayer(id: string) {
    return this.layers.has(id) ? {} : undefined;
  }
}

describe("withLayerAsStyleLoaded", () => {
  it("reports the style loaded inside the call once the layer exists", () => {
    const map = new FakeMap();
    map.layers.add("vehicle-layer");
    let seen: boolean | undefined;
    withLayerAsStyleLoaded(map, "vehicle-layer", () => {
      seen = map.isStyleLoaded();
    });
    expect(seen).toBe(true);
  });

  it("reports it not loaded while the layer is missing", () => {
    const map = new FakeMap();
    let seen: boolean | undefined;
    withLayerAsStyleLoaded(map, "vehicle-layer", () => {
      seen = map.isStyleLoaded();
    });
    expect(seen).toBe(false);
  });

  it("puts the map's own answer back afterwards", () => {
    const map = new FakeMap();
    map.layers.add("vehicle-layer");
    withLayerAsStyleLoaded(map, "vehicle-layer", () => {});
    expect(map.isStyleLoaded()).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(map, "isStyleLoaded")).toBe(
      false,
    );
  });

  it("puts it back when the call throws", () => {
    const map = new FakeMap();
    map.layers.add("vehicle-layer");
    expect(() =>
      withLayerAsStyleLoaded(map, "vehicle-layer", () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(map.isStyleLoaded()).toBe(false);
  });
});
