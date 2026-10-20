import { describe, expect, it } from "vitest";
import { christmasTreeLayers } from "./christmasTreeLayers.ts";
import { TwinkleExtension, twinkleShaderModule } from "./twinkleExtension.ts";
import type { TwinkleState } from "./twinkleClock.ts";
import type { Decoration } from "../../domain/decorationPlacement.ts";
import { christmasTreeModel, TREE } from "../../domain/vehicleMeshes.ts";
import { TWINKLE_PERIOD_S, twinkleBrightness } from "../../domain/twinkle.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
} from "../Vehicle/vehicleModelLayers.ts";
import type { MapScheme } from "../basemap/basemap.ts";

const tree = (key: string, phase = 0.4): Decoration => ({
  key,
  position: [10.75, 59.91],
  height: 4.5,
  yaw: 30,
  tint: [40, 110, 50],
  phase,
});
const T = tree("a#0", 0.4);
const U = tree("b#0", 0.7);

const options = (
  scheme: MapScheme = "light",
  visible = true,
  twinkle: TwinkleState = { timeS: 1.25, amount: 0.8 },
) => ({
  visible,
  opacity: visible ? 1 : 0,
  scheme,
  getElevation: () => 0,
  positionTrigger: null,
  twinkle,
});

const BULB_IDS = Array.from(
  { length: TREE.bulbGroups },
  (_, g) => `seasonal-trees-bulbs-${g}`,
);

type TwinkleLayerProps = {
  getPhase: (d: Decoration) => number;
  twinkleTimeS: number;
  twinkleAmount: number;
  twinkleGroup: number;
  twinkleGroups: number;
};

describe("christmasTreeLayers", () => {
  it("builds nothing while hidden or empty", () => {
    expect(christmasTreeLayers([T], options("light", false))).toEqual([]);
    expect(christmasTreeLayers([], options())).toEqual([]);
  });

  // One layer per tree once took the map to a crawl; trees are instances.
  it("has the same layer count for 1 and 200 trees", () => {
    const many = Array.from({ length: 200 }, (_, i) => tree(`s${i}#0`));
    expect(christmasTreeLayers(many, options("dark"))).toHaveLength(
      3 + TREE.bulbGroups,
    );
    expect(christmasTreeLayers([T], options("dark"))).toHaveLength(
      3 + TREE.bulbGroups,
    );
  });

  it("draws the bulbs and star in light mode as well as dark", () => {
    for (const scheme of ["light", "dark"] as const)
      expect(
        christmasTreeLayers([T], options(scheme)).map((l) => l.id),
      ).toEqual([
        "seasonal-trees-canopy",
        "seasonal-trees-trunk",
        "seasonal-trees-star",
        ...BULB_IDS,
      ]);
  });

  it("uses lamp materials in dark mode", () => {
    const layers = christmasTreeLayers([T], options("dark"));
    const material = (id: string) =>
      layers.find((layer) => layer.id === id)?.props.material;
    expect(material("seasonal-trees-canopy")).toBe(MODEL_MATERIALS.dark.shaded);
    expect(material("seasonal-trees-trunk")).toBe(MODEL_MATERIALS.dark.shaded);
    expect(material("seasonal-trees-star")).toBe(MODEL_MATERIALS.dark.lamps);
    for (const id of BULB_IDS)
      expect(material(id)).toBe(MODEL_MATERIALS.dark.lamps);
  });

  it("draws under the vehicle icons", () => {
    for (const layer of christmasTreeLayers([T], options("dark")))
      expect((layer.props as { beforeId?: string }).beforeId).toBe(
        MODEL_BEFORE_LAYER,
      );
  });

  it("tints the canopy per tree and scales and turns every part", () => {
    const [canopy] = christmasTreeLayers([T], options());
    const { getScale, getOrientation, getColor } = canopy.props as unknown as {
      getScale: (d: Decoration) => number[];
      getOrientation: (d: Decoration) => number[];
      getColor: (d: Decoration) => number[];
    };
    expect(getScale(T)).toEqual([4.5, 4.5, 4.5]);
    expect(getOrientation(T)).toEqual([0, -30, 0]);
    expect(getColor(T)).toEqual([40, 110, 50]);
  });

  it("gives every bulb layer the twinkle props and the tree's phase", () => {
    const layers = christmasTreeLayers(
      [T, U],
      options("dark", true, { timeS: 2.5, amount: 0.6 }),
    );
    const { bulbs } = christmasTreeModel();
    BULB_IDS.forEach((id, g) => {
      const layer = layers.find((l) => l.id === id)!;
      const props = layer.props as unknown as TwinkleLayerProps;
      expect(props.twinkleTimeS).toBe(2.5);
      expect(props.twinkleAmount).toBe(0.6);
      expect(props.twinkleGroup).toBe(g);
      expect(props.twinkleGroups).toBe(TREE.bulbGroups);
      expect(props.getPhase(T)).toBe(0.4);
      expect(props.getPhase(U)).toBe(0.7);
      expect(layer.props.mesh).toBe(bulbs[g]);
      expect(layer.props.extensions).toHaveLength(1);
      expect(layer.props.extensions[0]).toBeInstanceOf(TwinkleExtension);
    });
  });

  // A wall screen runs for weeks: in float32, seconds since start would step
  // visibly, so the time is wrapped to one period in double precision first.
  it("wraps the time to one period before it becomes a uniform", () => {
    const timeS = 1e7 + 0.5;
    const [bulb] = christmasTreeLayers(
      [T],
      options("dark", true, { timeS, amount: 1 }),
    ).slice(3);
    const wrapped = (bulb.props as unknown as TwinkleLayerProps).twinkleTimeS;
    expect(wrapped).toBeGreaterThanOrEqual(0);
    expect(wrapped).toBeLessThan(TWINKLE_PERIOD_S);
    for (let group = 0; group < TREE.bulbGroups; group++)
      expect(twinkleBrightness(wrapped, 0.4, group, 3, 1)).toBeCloseTo(
        twinkleBrightness(timeS, 0.4, group, 3, 1),
        6,
      );
  });

  it("does not twinkle the canopy, trunk or star", () => {
    const layers = christmasTreeLayers([T], options("dark"));
    for (const layer of layers.slice(0, 3))
      expect(layer.props.extensions ?? []).toHaveLength(0);
  });

  it("changes only the uniforms from one tick to the next", () => {
    const trees = [T, U];
    const a = christmasTreeLayers(
      trees,
      options("dark", true, { timeS: 1, amount: 1 }),
    );
    const b = christmasTreeLayers(
      trees,
      options("dark", true, { timeS: 1.08, amount: 1 }),
    );
    a.forEach((layer, i) => {
      expect(b[i].props.data).toBe(layer.props.data);
      expect(b[i].props.mesh).toBe(layer.props.mesh);
      expect(b[i].props.extensions).toEqual(layer.props.extensions);
    });
    // One extension instance across builds, so deck.gl sees no extension change.
    expect(b[3].props.extensions[0]).toBe(a[3].props.extensions[0]);
    expect((b[3].props as unknown as TwinkleLayerProps).getPhase).toBe(
      (a[3].props as unknown as TwinkleLayerProps).getPhase,
    );
  });
});

describe("TwinkleExtension", () => {
  const extension = new TwinkleExtension();
  const shaders = extension.getShaders.call({} as never) as {
    modules: (typeof twinkleShaderModule)[];
  };
  const glsl = [
    twinkleShaderModule.vs,
    ...Object.values(twinkleShaderModule.inject),
  ].join("\n");

  it("adds one shader module named twinkle", () => {
    expect(shaders.modules).toEqual([twinkleShaderModule]);
    expect(twinkleShaderModule.name).toBe("twinkle");
  });

  it("declares its uniforms in the order and types of uniformTypes", () => {
    expect(twinkleShaderModule.uniformTypes).toEqual({
      timeS: "f32",
      amount: "f32",
      group: "f32",
      groups: "f32",
    });
    const block = twinkleShaderModule.vs.replace(/\s+/g, " ");
    expect(block).toContain(
      "uniform twinkleUniforms { float timeS; float amount; float group; float groups; } twinkle;",
    );
  });

  it("reads the phase attribute it adds", () => {
    expect(twinkleShaderModule.inject["vs:#decl"]).toContain(
      "in float instancePhases;",
    );
    expect(twinkleShaderModule.inject["vs:DECKGL_FILTER_COLOR"]).toContain(
      "instancePhases",
    );
    expect(twinkleShaderModule.inject["vs:DECKGL_FILTER_COLOR"]).toContain(
      "color.rgb",
    );
  });

  it("carries TWINKLE_PERIOD_S and TWINKLE_MIN from the domain", () => {
    expect(glsl).toMatch(/TWINKLE_PERIOD_S\s+3\.0\b/);
    expect(glsl).toMatch(/TWINKLE_MIN\s+0\.35\b/);
  });
});
