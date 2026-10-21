import { describe, expect, it } from "vitest";
import {
  burstSparks,
  RISE_S,
  SPARK_DRAG,
  SPARK_GRAVITY,
  SPARK_LIFE_S,
  TRAIL_LAG_S,
  TRAIL_SAMPLES,
} from "../../domain/fireworks.ts";
import { sparkModel } from "../../domain/vehicleMeshes.ts";
import { MODEL_BEFORE_LAYER } from "../Vehicle/vehicleModelLayers.ts";
import { BURST_SPARKS, type Burst } from "./fireworkShow.ts";
import {
  FireworksExtension,
  fireworksShaderModule,
} from "./fireworksExtension.ts";
import {
  fireworkLayers,
  sparkInstances,
  type SparkInstance,
} from "./fireworkLayers.ts";

const DAY_MS = 86_400_000;

const burst = (key: string, launchMs: number): Burst => ({
  key,
  launchMs,
  position: [10.75, 59.91, 250],
  heightM: 200,
  sparks: burstSparks(7, BURST_SPARKS, [
    [255, 0, 0],
    [0, 0, 255],
  ]),
});

const options = (
  scheme: "light" | "dark" = "dark",
  visible = true,
  epochKey: unknown = 1,
) => ({ visible, scheme, timeS: 2, epochKey }) as const;

describe("sparkInstances", () => {
  it("is one rocket head and every spark's trail per burst", () => {
    const instances = sparkInstances([burst("a", 0), burst("b", 1000)], 0);
    expect(instances).toHaveLength(2 * (1 + BURST_SPARKS * TRAIL_SAMPLES));
    expect(instances.filter((i) => i.kind === 0)).toHaveLength(2);
  });

  it("lags each trail sample behind the one ahead of it", () => {
    const sparks = sparkInstances([burst("a", 0)], 0).filter(
      (i) => i.kind === 1,
    );
    expect(sparks.slice(0, TRAIL_SAMPLES).map((i) => i.lagS)).toEqual(
      Array.from({ length: TRAIL_SAMPLES }, (_, i) => i * TRAIL_LAG_S),
    );
  });

  it("launch times are relative to the data's own epoch", () => {
    const launchMs = 30 * DAY_MS;
    const instances = sparkInstances([burst("a", launchMs)], launchMs - 1000);
    expect(instances.every((i) => i.launchS === 1)).toBe(true);
  });

  it("carries the burst's point, height and the sparks' flight", () => {
    const b = burst("a", 0);
    const [head, first] = sparkInstances([b], 0);
    expect(head.position).toEqual(b.position);
    expect(head.heightM).toBe(b.heightM);
    expect(first.direction).toEqual(b.sparks[0].direction);
    expect(first.speed).toBe(b.sparks[0].speed);
    expect(first.colour).toEqual(b.sparks[0].colour);
  });
});

describe("fireworkLayers", () => {
  const instances = sparkInstances([burst("a", 0)], 0);

  it("builds nothing while hidden", () => {
    expect(fireworkLayers(instances, options("dark", false))).toEqual([]);
  });

  it("is one layer of the spark mesh, the data passed through", () => {
    const layers = fireworkLayers(instances, options());
    expect(layers).toHaveLength(1);
    const [layer] = layers;
    expect(layer.id).toBe("fireworks");
    expect(layer.props.data).toBe(instances);
    expect((layer.props as unknown as { mesh: unknown }).mesh).toBe(
      sparkModel(),
    );
    expect((layer.props as unknown as { beforeId: unknown }).beforeId).toBe(
      MODEL_BEFORE_LAYER,
    );
  });

  it("adds sparks in dark mode and blends them over in light mode", () => {
    const parameters = (scheme: "light" | "dark") =>
      fireworkLayers(instances, options(scheme))[0].props.parameters as Record<
        string,
        unknown
      >;
    expect(parameters("dark").blendColorDstFactor).toBe("one");
    expect(parameters("light").blendColorDstFactor).toBe("one-minus-src-alpha");
    expect(parameters("dark").depthWriteEnabled).toBe(false);
    expect(parameters("light").depthWriteEnabled).toBe(false);
  });

  it("shares one extension instance between builds", () => {
    const a = fireworkLayers(instances, options())[0].props.extensions;
    const b = fireworkLayers(instances, options("light"))[0].props.extensions;
    expect(a).toHaveLength(1);
    expect(a[0]).toBeInstanceOf(FireworksExtension);
    expect(b).toBe(a);
  });

  it("colours each instance by its own colour", () => {
    const props = fireworkLayers(instances, options())[0].props as unknown as {
      getColor: (i: SparkInstance) => unknown;
    };
    expect(props.getColor(instances[1])).toEqual(instances[1].colour);
  });

  it("re-reads every accessor when the epoch changes", () => {
    const { updateTriggers } = fireworkLayers(
      instances,
      options("dark", true, 42),
    )[0].props as unknown as { updateTriggers: Record<string, unknown> };
    for (const accessor of [
      "getPosition",
      "getColor",
      "getLaunchS",
      "getDirection",
      "getSpeed",
      "getLagS",
      "getKind",
      "getHeightM",
    ]) {
      expect(updateTriggers[accessor]).toBe(42);
    }
  });

  it("passes the time and the scheme's blending to the shader", () => {
    const props = (scheme: "light" | "dark") =>
      fireworkLayers(instances, options(scheme))[0].props as unknown as {
        fireworksTimeS: number;
        fireworksAdditive: boolean;
      };
    expect(props("dark").fireworksTimeS).toBe(2);
    expect(props("dark").fireworksAdditive).toBe(true);
    expect(props("light").fireworksAdditive).toBe(false);
  });
});

describe("FireworksExtension", () => {
  const extension = new FireworksExtension();
  const shaders = extension.getShaders.call({} as never) as {
    modules: (typeof fireworksShaderModule)[];
  };
  const glsl = [
    fireworksShaderModule.vs,
    ...Object.values(fireworksShaderModule.inject),
  ].join("\n");

  it("adds one shader module named fireworks", () => {
    expect(shaders.modules).toEqual([fireworksShaderModule]);
    expect(fireworksShaderModule.name).toBe("fireworks");
  });

  it("declares its uniforms in the order and types of uniformTypes", () => {
    expect(fireworksShaderModule.uniformTypes).toEqual({
      timeS: "f32",
      additive: "f32",
    });
    const block = fireworksShaderModule.vs.replace(/\s+/g, " ");
    expect(block).toContain(
      "uniform fireworksUniforms { float timeS; float additive; } fireworks;",
    );
  });

  it("carries the flight's constants from the domain", () => {
    for (const [name, value] of Object.entries({
      RISE_S,
      SPARK_LIFE_S,
      SPARK_GRAVITY,
      SPARK_DRAG,
      TRAIL_SAMPLES,
      TRAIL_LAG_S,
    })) {
      const literal = Number.isInteger(value)
        ? value.toFixed(1)
        : String(value);
      expect(glsl).toMatch(
        new RegExp(
          `#define FIREWORKS_${name}\\s+${literal.replace(".", "\\.")}\\b`,
        ),
      );
    }
  });

  it("offsets in east, north and up metres, not in model space", () => {
    expect(glsl).not.toContain("instanceModelMatrixCol0");
    expect(glsl).not.toContain("instanceModelMatrixCol1");
    expect(glsl).not.toContain("instanceModelMatrixCol2");
  });

  it("reads every instance's launch data", () => {
    const decl = fireworksShaderModule.inject["vs:#decl"];
    for (const attribute of [
      "in float instanceFireworkLaunchS;",
      "in vec3 instanceFireworkDirections;",
      "in float instanceFireworkSpeeds;",
      "in float instanceFireworkLagS;",
      "in float instanceFireworkKinds;",
      "in float instanceFireworkHeightM;",
    ]) {
      expect(decl).toContain(attribute);
    }
  });

  it("never runs a spark's flight backwards", () => {
    // A trail sample just after the burst is before its own start.
    expect(glsl).toMatch(/max\(\s*fireworksSparkT\s*,\s*0\.0\s*\)/);
  });
});
