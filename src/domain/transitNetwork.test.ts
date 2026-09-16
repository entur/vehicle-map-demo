import { describe, expect, it } from "vitest";
import {
  featureFilter,
  type FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  FERRY_FILTER,
  STATION_FILTER,
  STOP_FILTER,
  TRANSIT_LINE_FILTER,
  TRANSIT_NETWORK_LAYERS,
  transitPlaceKind,
} from "./transitNetwork.ts";
import { SCHEME_PAINT, transitNetworkPaint } from "./baseMapScheme.ts";
import { MAP_SCHEMES } from "../components/basemap/basemap.ts";
import { contrastRatio } from "./contrast.ts";

function matches(filter: FilterSpecification, properties: object): boolean {
  const { filter: evaluate } = featureFilter(filter, "layers[0].filter");
  return evaluate(
    { zoom: 16 },
    { type: 1, properties: properties as Record<string, string> },
  );
}

// Property sets as found in OpenFreeMap planet tiles over Oslo and Horten,
// 2026-09-16, reduced to the fields the filters read.
const POI = {
  busStop: { class: "bus", subclass: "bus_stop", name: "Ollebakken" },
  busStation: {
    class: "bus",
    subclass: "bus_station",
    name: "Oslo bussterminal",
  },
  railStation: { class: "railway", subclass: "station", name: "Oslo S" },
  subway: { class: "railway", subclass: "subway", name: "Stortinget" },
  tramStop: { class: "railway", subclass: "tram_stop", name: "Ruseløkka" },
  ferryTerminal: {
    class: "ferry_terminal",
    subclass: "ferry_terminal",
    name: "Horten",
  },
  marina: { class: "harbor", subclass: "marina", name: "Kongen marina" },
  shop: { class: "shop", subclass: "convenience", name: "Narvesen" },
};

describe("transit place filters", () => {
  it("classify real tile features the same way as transitPlaceKind", () => {
    for (const [name, properties] of Object.entries(POI)) {
      const kind = transitPlaceKind(properties);
      expect([name, matches(STATION_FILTER, properties)]).toEqual([
        name,
        kind === "station",
      ]);
      expect([name, matches(STOP_FILTER, properties)]).toEqual([
        name,
        kind === "stop",
      ]);
    }
  });

  it("draws stations, and bus and tram stops, but not other places", () => {
    expect(transitPlaceKind(POI.railStation)).toBe("station");
    expect(transitPlaceKind(POI.subway)).toBe("station");
    expect(transitPlaceKind(POI.busStation)).toBe("station");
    expect(transitPlaceKind(POI.ferryTerminal)).toBe("station");
    expect(transitPlaceKind(POI.busStop)).toBe("stop");
    expect(transitPlaceKind(POI.tramStop)).toBe("stop");
    expect(transitPlaceKind(POI.marina)).toBeNull();
    expect(transitPlaceKind(POI.shop)).toBeNull();
    expect(transitPlaceKind({})).toBeNull();
  });
});

describe("transit line filters", () => {
  it("take rail and metro, tram and light rail, tunnels included", () => {
    for (const properties of [
      { class: "rail", subclass: "rail" },
      { class: "rail", subclass: "rail", brunnel: "tunnel" },
      { class: "transit", subclass: "subway", brunnel: "tunnel" },
      { class: "transit", subclass: "tram", brunnel: "bridge" },
    ]) {
      expect(matches(TRANSIT_LINE_FILTER, properties)).toBe(true);
      expect(matches(FERRY_FILTER, properties)).toBe(false);
    }
  });

  it("take ferries on their own layer, and leave roads out of both", () => {
    expect(matches(FERRY_FILTER, { class: "ferry" })).toBe(true);
    expect(matches(TRANSIT_LINE_FILTER, { class: "ferry" })).toBe(false);
    expect(matches(TRANSIT_LINE_FILTER, { class: "primary" })).toBe(false);
    expect(matches(FERRY_FILTER, { class: "path" })).toBe(false);
  });
});

describe("transitNetworkPaint", () => {
  it("names only transit network layers", () => {
    for (const scheme of MAP_SCHEMES) {
      for (const [id] of transitNetworkPaint(scheme)) {
        expect(TRANSIT_NETWORK_LAYERS).toContain(id);
      }
    }
  });

  it("keeps stop names legible on their halo in both schemes", () => {
    for (const scheme of MAP_SCHEMES) {
      const { text, textHalo, stationFill, stationStroke } =
        SCHEME_PAINT[scheme].transit;
      expect(contrastRatio(text, textHalo)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(stationFill, stationStroke)).toBeGreaterThanOrEqual(
        3,
      );
    }
  });
});
