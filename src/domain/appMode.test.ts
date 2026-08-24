import { describe, expect, it } from "vitest";
import { mapStyle } from "../components/mapStyle.ts";
import { RightContentType } from "../components/RightMenu/types.ts";
import { MapViewOptions } from "../types.ts";
import {
  APP_MODES,
  MODE_DEFAULT_VISIBLE_LAYERS,
  MODE_DORMANT_LAYERS,
  MODE_LAYERS,
  MODE_SOURCES,
  MODE_SWITCHED_LAYERS,
  isSituationsFeedEnabled,
  isVehicleFeedEnabled,
  otherMode,
  parseAppMode,
  isWideTool,
  rightRailTools,
} from "./appMode.ts";

/** The base map belongs to no mode and is never hidden or cleared. */
const BASE_LAYER = "osm";
const BASE_SOURCE = "osm";

describe("MODE_LAYERS", () => {
  it("claims every non-base layer in the style exactly once", () => {
    const styleLayers = mapStyle.layers
      .map((layer) => layer.id)
      .filter((id) => id !== BASE_LAYER);
    const claimed = APP_MODES.flatMap((mode) => MODE_LAYERS[mode]);

    expect([...claimed].sort()).toEqual([...styleLayers].sort());
  });

  it("names only layers that exist in the style", () => {
    const styleLayers = new Set(mapStyle.layers.map((layer) => layer.id));
    for (const mode of APP_MODES) {
      for (const id of MODE_LAYERS[mode]) {
        expect(styleLayers.has(id)).toBe(true);
      }
    }
  });
});

describe("MODE_SOURCES", () => {
  it("claims every non-base source in the style exactly once", () => {
    const styleSources = Object.keys(mapStyle.sources).filter(
      (id) => id !== BASE_SOURCE,
    );
    const claimed = APP_MODES.flatMap((mode) => MODE_SOURCES[mode]);

    expect([...claimed].sort()).toEqual([...styleSources].sort());
  });
});

describe("MODE_SWITCHED_LAYERS", () => {
  it("is a subset of the layers the mode owns", () => {
    for (const mode of APP_MODES) {
      const owned = new Set(MODE_LAYERS[mode]);
      for (const id of Object.keys(MODE_SWITCHED_LAYERS[mode])) {
        expect(owned.has(id)).toBe(true);
      }
    }
  });

  it("maps each MapViewOptions key to exactly one layer", () => {
    const keys = APP_MODES.flatMap((mode) =>
      Object.values(MODE_SWITCHED_LAYERS[mode]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("MODE_DEFAULT_VISIBLE_LAYERS", () => {
  it("is a subset of the layers the mode owns", () => {
    for (const mode of APP_MODES) {
      const owned = new Set(MODE_LAYERS[mode]);
      for (const id of MODE_DEFAULT_VISIBLE_LAYERS[mode]) {
        expect(owned.has(id)).toBe(true);
      }
    }
  });

  it("is disjoint from the switch-owned layers per mode", () => {
    for (const mode of APP_MODES) {
      const switched = new Set(Object.keys(MODE_SWITCHED_LAYERS[mode]));
      for (const id of MODE_DEFAULT_VISIBLE_LAYERS[mode]) {
        expect(switched.has(id)).toBe(false);
      }
    }
  });

  it("never contains a dormant layer", () => {
    for (const mode of APP_MODES) {
      for (const id of MODE_DORMANT_LAYERS[mode]) {
        expect(MODE_DEFAULT_VISIBLE_LAYERS[mode]).not.toContain(id);
      }
    }
  });
});

describe("mode layer classification is a total partition", () => {
  it("splits MODE_LAYERS[mode] into pairwise-disjoint switched/always-visible/dormant sets whose union is exact", () => {
    for (const mode of APP_MODES) {
      const switched = new Set(Object.keys(MODE_SWITCHED_LAYERS[mode]));
      const defaultVisible = new Set(MODE_DEFAULT_VISIBLE_LAYERS[mode]);
      const dormant = new Set(MODE_DORMANT_LAYERS[mode]);

      // Pairwise disjoint.
      for (const id of defaultVisible) {
        expect(switched.has(id)).toBe(false);
      }
      for (const id of dormant) {
        expect(switched.has(id)).toBe(false);
        expect(defaultVisible.has(id)).toBe(false);
      }

      // Union is exactly MODE_LAYERS[mode] — a layer added to MODE_LAYERS
      // without being classified into one of the three tables fails here,
      // rather than silently defaulting to "hidden forever".
      const union = [...switched, ...defaultVisible, ...dormant];
      expect(union.sort()).toEqual([...MODE_LAYERS[mode]].sort());
    }
  });
});

describe("feed predicates", () => {
  it("enables exactly one feed per mode", () => {
    for (const mode of APP_MODES) {
      expect(isVehicleFeedEnabled(mode)).toBe(!isSituationsFeedEnabled(mode));
    }
  });

  it("enables the vehicle feed only in vehicles mode", () => {
    expect(isVehicleFeedEnabled("vehicles")).toBe(true);
    expect(isVehicleFeedEnabled("situations")).toBe(false);
  });
});

const KNOWN_CONTENT_TYPES: RightContentType[] = [
  "filtering",
  "info",
  "layers",
  "stoplight",
  "situations",
  "situationStats",
];

describe("rightRailTools", () => {
  it("returns the expected tools per mode", () => {
    expect(rightRailTools("vehicles")).toEqual([
      "layers",
      "filtering",
      "info",
      "stoplight",
    ]);
    expect(rightRailTools("situations")).toEqual([
      "layers",
      "filtering",
      "situations",
      "situationStats",
    ]);
  });

  it("returns only valid RightContentType values", () => {
    for (const mode of APP_MODES) {
      for (const tool of rightRailTools(mode)) {
        expect(KNOWN_CONTENT_TYPES).toContain(tool);
      }
    }
  });
});

describe("isWideTool", () => {
  it("marks the feed report wide and the browsing tools narrow", () => {
    expect(isWideTool("situationStats")).toBe(true);
    expect(isWideTool("situations")).toBe(false);
    expect(isWideTool("filtering")).toBe(false);
  });

  it("marks only tools some mode's rail actually offers", () => {
    // A wide tool no rail can open would silently never widen anything.
    const offered = new Set(APP_MODES.flatMap((mode) => rightRailTools(mode)));
    for (const tool of KNOWN_CONTENT_TYPES) {
      if (isWideTool(tool)) expect(offered.has(tool)).toBe(true);
    }
  });
});

describe("MapViewOptions completeness", () => {
  // RightContentType (and MapViewOptions below) can't be reflected at
  // runtime, so this list is kept explicit and must track
  // `MapViewOptions` in ../types.ts — if a key is added there, add it here
  // too, or this test cannot catch a switch added without a mode
  // assignment.
  const MAP_VIEW_OPTIONS_KEYS: (keyof MapViewOptions)[] = [
    "showVehicleTraces",
    "showVehicles",
    "showDelay",
    "showVehicleHeatmap",
    "showUpdateFrequency",
    "showDeadUpdateFrequency",
    "showOccupancy",
    "showAffectedStops",
    "showAffectedLines",
  ];

  it("assigns every MapViewOptions key to exactly one mode's MODE_SWITCHED_LAYERS", () => {
    const assignedKeys = APP_MODES.flatMap((mode) =>
      Object.values(MODE_SWITCHED_LAYERS[mode]),
    );
    expect([...assignedKeys].sort()).toEqual([...MAP_VIEW_OPTIONS_KEYS].sort());
  });
});

describe("otherMode", () => {
  it("round-trips", () => {
    for (const mode of APP_MODES) {
      expect(otherMode(otherMode(mode))).toBe(mode);
    }
    expect(otherMode("vehicles")).toBe("situations");
  });
});

describe("parseAppMode", () => {
  it("accepts a known mode", () => {
    expect(parseAppMode("situations")).toBe("situations");
  });

  it("falls back to vehicles for anything else", () => {
    expect(parseAppMode("nonsense")).toBe("vehicles");
    expect(parseAppMode(undefined)).toBe("vehicles");
    expect(parseAppMode(null)).toBe("vehicles");
    expect(parseAppMode("")).toBe("vehicles");
  });
});
