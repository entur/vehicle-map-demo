import { describe, expect, it } from "vitest";
import {
  BASE_MAP_SNAPSHOTS,
  MAP_SCHEMES,
  baseMapLayerIds,
} from "../components/basemap/basemap.ts";
import {
  SCHEME_PAINT,
  baseLayerVisibility,
  mapSchemeFor,
  skyFor,
} from "./baseMapScheme.ts";
import { Weather } from "./weather.ts";

const hiddenUpstream = new Set(
  MAP_SCHEMES.flatMap((scheme) =>
    BASE_MAP_SNAPSHOTS[scheme].layers
      .filter(
        (layer) =>
          (layer as { layout?: { visibility?: string } }).layout?.visibility ===
          "none",
      )
      .map((layer) => `${scheme}/${layer.id}`),
  ),
);

describe("baseLayerVisibility", () => {
  it("covers every base layer exactly once", () => {
    for (const scheme of MAP_SCHEMES) {
      const ids = baseLayerVisibility(scheme).map(([id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual([...baseMapLayerIds()].sort());
    }
  });

  it("shows the chosen scheme's layers and hides the other's", () => {
    for (const scheme of MAP_SCHEMES) {
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        const own = id.startsWith(`${scheme}/`);
        const expected = own && !hiddenUpstream.has(id) ? "visible" : "none";
        expect([id, visibility]).toEqual([id, expected]);
      }
    }
  });

  // A layer the snapshot itself ships hidden (Fiord's `highway_ref` at the
  // time of writing) must not be switched on by a scheme change.
  it("never reveals a layer the snapshot ships hidden", () => {
    for (const scheme of MAP_SCHEMES) {
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        if (hiddenUpstream.has(id)) expect(visibility).toBe("none");
      }
    }
  });
});

describe("SCHEME_PAINT", () => {
  it("keeps today's light values", () => {
    expect(SCHEME_PAINT.light).toEqual({
      buildings: "#d6d0c8",
      hillshadeShadow: "#473b24",
      sky: {
        "sky-color": "#b9d7ee",
        "horizon-color": "#eef3f6",
        "sky-horizon-blend": 0.6,
      },
      transit: {
        rail: "#8f96a3",
        ferry: "#6f86a6",
        stopFill: "#ffffff",
        stopStroke: "#5b6475",
        stationFill: "#4a5263",
        stationStroke: "#ffffff",
        text: "#3d4452",
        textHalo: "#ffffff",
      },
      vehicleDotEdge: "#ffffff",
      journeyStopText: "#1f2430",
      journeyStopTextHalo: "#ffffff",
    });
  });

  it("defines every paint for both schemes", () => {
    for (const scheme of MAP_SCHEMES) {
      expect(SCHEME_PAINT[scheme].buildings).toMatch(/^#[0-9a-f]{6}$/);
      expect(SCHEME_PAINT[scheme].hillshadeShadow).toMatch(/^#[0-9a-f]{6}$/);
      expect(SCHEME_PAINT[scheme].sky["sky-color"]).toBeTruthy();
      expect(SCHEME_PAINT[scheme].vehicleDotEdge).toMatch(/^#[0-9a-f]{6}$/);
      expect(SCHEME_PAINT[scheme].journeyStopText).toMatch(/^#[0-9a-f]{6}$/);
      expect(SCHEME_PAINT[scheme].journeyStopTextHalo).toMatch(
        /^#[0-9a-f]{6}$/,
      );
      for (const colour of Object.values(SCHEME_PAINT[scheme].transit)) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("mapSchemeFor", () => {
  it("maps MUI's resolved colour scheme onto a base map", () => {
    expect(mapSchemeFor("dark")).toBe("dark");
    expect(mapSchemeFor("light")).toBe("light");
    // MUI reports undefined before it has resolved the scheme.
    expect(mapSchemeFor(undefined)).toBe("light");
  });
});

describe("skyFor", () => {
  const dry = (cover: Weather["cover"]): Weather => ({
    kind: "none",
    intensity: 0,
    slant: 0,
    cover,
  });
  const falling = (kind: "rain" | "snow", intensity: number): Weather => ({
    kind,
    intensity,
    slant: 0,
    cover: "cloudy",
  });
  /** A colour's lightness, 0–255, as the mean of its channels. */
  const lightness = (colour: unknown) => {
    const hex = String(colour).slice(1);
    return (
      [0, 2, 4]
        .map((i) => parseInt(hex.slice(i, i + 2), 16))
        .reduce((a, b) => a + b) / 3
    );
  };
  /** How far a colour is from grey: the spread of its channels. */
  const chroma = (colour: unknown) => {
    const hex = String(colour).slice(1);
    const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return Math.max(...channels) - Math.min(...channels);
  };
  const SCHEMES = ["light", "dark"] as const;

  it.each(SCHEMES)(
    "is the %s scheme's own sky when the weather is off, unknown or clear",
    (scheme) => {
      expect(skyFor(scheme, null)).toBe(SCHEME_PAINT[scheme].sky);
      expect(skyFor(scheme, dry("clear"))).toBe(SCHEME_PAINT[scheme].sky);
    },
  );

  it.each(SCHEMES)("greys the %s sky as the cloud closes in", (scheme) => {
    const clear = chroma(skyFor(scheme, null)["sky-color"]);
    const partly = chroma(skyFor(scheme, dry("partly"))["sky-color"]);
    const cloudy = chroma(skyFor(scheme, dry("cloudy"))["sky-color"]);
    expect(partly).toBeLessThan(clear);
    expect(cloudy).toBeLessThan(partly);
  });

  // Haze the colour of the horizon, so the far ground fades into the sky.
  it.each(SCHEMES)("hazes the %s map in the horizon's colour", (scheme) => {
    for (const weather of [dry("cloudy"), dry("fog"), falling("rain", 1)]) {
      const sky = skyFor(scheme, weather);
      expect(sky["fog-color"]).toBe(sky["horizon-color"]);
    }
  });

  it.each(SCHEMES)("brings the %s haze nearest in fog", (scheme) => {
    const blend = (weather: Weather) =>
      skyFor(scheme, weather)["fog-ground-blend"] as number;
    expect(blend(dry("fog"))).toBeLessThan(blend(dry("cloudy")));
    expect(blend(dry("fog"))).toBeLessThan(blend(falling("rain", 1)));
  });

  it.each(SCHEMES)(
    "darkens the %s sky and draws the haze in as rain grows heavier",
    (scheme) => {
      const light = skyFor(scheme, falling("rain", 0.2));
      const heavy = skyFor(scheme, falling("rain", 1));
      expect(lightness(heavy["sky-color"])).toBeLessThan(
        lightness(light["sky-color"]),
      );
      expect(heavy["fog-ground-blend"] as number).toBeLessThan(
        light["fog-ground-blend"] as number,
      );
    },
  );

  it.each(SCHEMES)("keeps the %s sky paler in snow than in rain", (scheme) => {
    expect(
      lightness(skyFor(scheme, falling("snow", 1))["sky-color"]),
    ).toBeGreaterThan(
      lightness(skyFor(scheme, falling("rain", 1))["sky-color"]),
    );
  });

  // The dark map's sky must stay dark: a pale overcast would be the
  // brightest thing on screen.
  it("never lifts the dark sky into a glare", () => {
    for (const weather of [
      dry("partly"),
      dry("cloudy"),
      dry("fog"),
      falling("rain", 1),
      falling("snow", 1),
    ]) {
      const sky = skyFor("dark", weather);
      expect(lightness(sky["sky-color"])).toBeLessThan(90);
      expect(lightness(sky["horizon-color"])).toBeLessThan(90);
    }
  });

  it("returns well-formed colours at any intensity", () => {
    for (const intensity of [0, 0.333, 0.5, 1]) {
      const sky = skyFor("light", falling("rain", intensity));
      expect(sky["sky-color"]).toMatch(/^#[0-9a-f]{6}$/);
      expect(sky["horizon-color"]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
