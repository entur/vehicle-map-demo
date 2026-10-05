import { describe, expect, it, vi } from "vitest";
import { StyleReadiness, whenLayerExists } from "./whenLayerExists.ts";

function fakeMap(initialLayers: string[] = []) {
  const layers = new Set(initialLayers);
  const handlers = new Set<() => void>();
  const map: StyleReadiness = {
    getLayer: (id) => (layers.has(id) ? {} : undefined),
    on: (_event, handler) => {
      handlers.add(handler);
    },
    off: (_event, handler) => {
      handlers.delete(handler);
    },
  };
  return {
    map,
    addLayer: (id: string) => layers.add(id),
    fireStyleData: () => [...handlers].forEach((handler) => handler()),
    listenerCount: () => handlers.size,
  };
}

describe("whenLayerExists", () => {
  it("runs at once when the layer already exists", () => {
    const { map, listenerCount } = fakeMap(["osm"]);
    const run = vi.fn();
    whenLayerExists(map, "osm", run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(listenerCount()).toBe(0);
  });

  // The case the old isStyleLoaded()/idle guard lost: styledata events keep
  // arriving, and the handler must fire on the first one where the layer is
  // there rather than on a whole-map idle that streaming data can postpone.
  it("waits for styledata until the layer exists, then runs once", () => {
    const { map, addLayer, fireStyleData, listenerCount } = fakeMap();
    const run = vi.fn();
    whenLayerExists(map, "osm", run);
    fireStyleData();
    expect(run).not.toHaveBeenCalled();

    addLayer("osm");
    fireStyleData();
    fireStyleData();
    expect(run).toHaveBeenCalledTimes(1);
    expect(listenerCount()).toBe(0);
  });

  it("never runs after being cancelled", () => {
    const { map, addLayer, fireStyleData, listenerCount } = fakeMap();
    const run = vi.fn();
    const cancel = whenLayerExists(map, "osm", run);
    cancel();
    addLayer("osm");
    fireStyleData();
    expect(run).not.toHaveBeenCalled();
    expect(listenerCount()).toBe(0);
  });
});
