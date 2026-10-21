import { beforeAll, describe, expect, it, vi } from "vitest";
import type { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import {
  flaggedVehicles,
  flagLayers,
  type FlagLayerOptions,
  vehiclePhase,
} from "./flagLayers.ts";
import { FlutterExtension, flutterShaderModule } from "./flutterExtension.ts";
import type { AnimationState } from "./animationClock.ts";
import {
  FLUTTER_AMPLITUDE,
  FLUTTER_PERIOD_S,
  FLUTTER_STILL,
  FLUTTER_WAVES,
  flutterOffset,
} from "../../domain/flutter.ts";
import {
  FLAG,
  FLAG_EXAGGERATION,
  flagModelFor,
} from "../../domain/vehicleMeshes.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
  vehicleModelLayers,
} from "../Vehicle/vehicleModelLayers.ts";

const vehicle = (
  vehicleId: string,
  mode: VehicleModeEnumeration = "BUS",
  bearing: number | null = 90,
): VehicleUpdate =>
  ({
    vehicleId,
    mode,
    bearing,
    destinationName: "Sentrum",
    line: { lineRef: "X:Line:1", lineName: "", publicCode: "1" },
    location: { latitude: 59.91, longitude: 10.75 },
    serviceJourney: { id: "X:ServiceJourney:" + vehicleId, date: "" },
  }) as VehicleUpdate;

const getPosition = () => [10.75, 59.91, 0] as [number, number, number];
const getTilt = (v: VehicleUpdate) => ({
  pitch: v.vehicleId === "1" ? 4 : 0,
  poolPitch: 1,
});

const options = (
  visible = true,
  flutter: AnimationState = { timeS: 0.4, amount: 1 },
): FlagLayerOptions => ({
  idPrefix: "models",
  visible,
  opacity: visible ? 1 : 0,
  scheme: "light",
  getPosition,
  getTilt,
  positionTrigger: null,
  flutter,
});

type FlutterProps = {
  getPhase: (v: VehicleUpdate) => number;
  flutterTimeS: number;
  flutterAmount: number;
  flutterLength: number;
};

type Accessors = {
  getPosition: (v: VehicleUpdate) => number[];
  getOrientation: (v: VehicleUpdate) => number[];
};

describe("flagLayers", () => {
  // vehicleModelLayers draws sign textures; in node a canvas that cannot draw
  // is enough to compare against it.
  beforeAll(() => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });
  });

  it("builds nothing while hidden", () => {
    expect(flagLayers([vehicle("1")], options(false))).toEqual([]);
  });

  it("flags no other mode, and no vehicle without a bearing", () => {
    const unflagged = [
      vehicle("1", "METRO"),
      vehicle("2", "RAIL"),
      vehicle("3", "FERRY"),
      vehicle("4", "AIR"),
      vehicle("5", "BUS", null),
    ];
    expect(flaggedVehicles(unflagged)).toEqual([]);
    expect(flagLayers(unflagged, options())).toEqual([]);
  });

  it("builds a pole and a cloth layer per flagged mode present", () => {
    const vehicles = [
      vehicle("1", "BUS"),
      vehicle("2", "TRAM"),
      vehicle("3", "RAIL"),
      vehicle("4", "BUS"),
    ];
    expect(flagLayers(vehicles, options()).map((l) => l.id)).toEqual([
      "models-BUS-flag-poles",
      "models-BUS-flag-cloth",
      "models-TRAM-flag-poles",
      "models-TRAM-flag-cloth",
    ]);
    const [poles, cloth] = flagLayers(vehicles, options());
    const { poles: poleMesh, cloth: clothMesh } = flagModelFor("BUS")!;
    expect(poles.props.mesh).toBe(poleMesh);
    expect(cloth.props.mesh).toBe(clothMesh);
    expect(poles.props.data).toEqual([vehicles[0], vehicles[3]]);
  });

  // Every vehicle is an instance: a layer per vehicle would crawl in May.
  it("has the same layer count for 1 and 200 buses", () => {
    const many = Array.from({ length: 200 }, (_, i) => vehicle(`b${i}`));
    expect(flagLayers(many, options())).toHaveLength(2);
    expect(flagLayers([vehicle("1")], options())).toHaveLength(2);
  });

  it("is placed, turned and lit like the models", () => {
    const vehicles = [vehicle("1"), vehicle("2", "BUS", 200)];
    const [body] = vehicleModelLayers(vehicles, {
      ...options(),
      idPrefix: "models",
    }).filter((l) => l.id.endsWith("-body"));
    const model = body.props as unknown as Accessors;
    for (const layer of flagLayers(vehicles, options())) {
      const flag = layer.props as unknown as Accessors;
      for (const v of vehicles) {
        expect(flag.getOrientation(v)).toEqual(model.getOrientation(v));
        expect(flag.getPosition(v)).toEqual(model.getPosition(v));
      }
      expect((layer.props as { beforeId?: string }).beforeId).toBe(
        MODEL_BEFORE_LAYER,
      );
      expect(layer.props.opacity).toBe(1);
      expect(layer.props.material).toBe(MODEL_MATERIALS.light.shaded);
    }
  });

  it("flutters the cloth and not the poles", () => {
    const [poles, cloth] = flagLayers([vehicle("1")], options());
    expect(poles.props.extensions ?? []).toHaveLength(0);
    expect(cloth.props.extensions).toHaveLength(1);
    expect(cloth.props.extensions[0]).toBeInstanceOf(FlutterExtension);
  });

  it("takes the flutter props from the animation state", () => {
    const [, cloth] = flagLayers(
      [vehicle("1")],
      options(true, { timeS: 0.9, amount: 0.3 }),
    );
    const props = cloth.props as unknown as FlutterProps;
    expect(props.flutterTimeS).toBeCloseTo(0.9, 9);
    expect(props.flutterAmount).toBe(0.3);
    expect(props.flutterLength).toBeCloseTo(
      FLAG.clothLength * FLAG_EXAGGERATION,
      9,
    );
    expect(props.getPhase(vehicle("1"))).toBe(vehiclePhase(vehicle("1")));
  });

  // A wall screen runs for weeks: in float32, seconds since start would step
  // visibly, so the time is wrapped to one period in double precision first.
  it("wraps the time to one period before it becomes a uniform", () => {
    const timeS = 1e7 + 0.5;
    const [, cloth] = flagLayers(
      [vehicle("1")],
      options(true, { timeS, amount: 1 }),
    );
    const wrapped = (cloth.props as unknown as FlutterProps).flutterTimeS;
    expect(wrapped).toBeGreaterThanOrEqual(0);
    expect(wrapped).toBeLessThan(FLUTTER_PERIOD_S);
    for (const u of [0.25, 0.5, 1])
      expect(flutterOffset(wrapped, 0.3, u, 1)).toBeCloseTo(
        flutterOffset(timeS, 0.3, u, 1),
        6,
      );
  });

  it("changes only the uniforms from one tick to the next", () => {
    const vehicles = [vehicle("1"), vehicle("2", "TRAM")];
    const a = flagLayers(vehicles, options(true, { timeS: 1, amount: 1 }));
    const b = flagLayers(vehicles, options(true, { timeS: 1.08, amount: 0.5 }));
    a.forEach((layer, i) => {
      expect(b[i].props.data).toBe(layer.props.data);
      expect(b[i].props.mesh).toBe(layer.props.mesh);
      expect(b[i].props.parameters).toBe(layer.props.parameters);
      expect(b[i].props.extensions).toEqual(layer.props.extensions);
    });
    // One extension instance across builds, so deck.gl sees no extension change.
    expect(b[1].props.extensions[0]).toBe(a[1].props.extensions[0]);
    expect((b[1].props as unknown as FlutterProps).getPhase).toBe(
      (a[1].props as unknown as FlutterProps).getPhase,
    );
  });

  // Both faces of the cloth lie in one plane: each side shows only its own.
  it("culls the cloth's back faces", () => {
    const [poles, cloth] = flagLayers([vehicle("1")], options());
    expect(cloth.props.parameters).toMatchObject({ cullMode: "back" });
    expect(poles.props.parameters ?? {}).not.toHaveProperty("cullMode");
  });
});

describe("vehiclePhase", () => {
  it("is in [0, 1), stable, and differs between vehicles", () => {
    const a = vehiclePhase(vehicle("1"));
    const b = vehiclePhase(vehicle("2"));
    for (const phase of [a, b]) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
    expect(vehiclePhase(vehicle("1"))).toBe(a);
    expect(b).not.toBe(a);
  });
});

describe("FlutterExtension", () => {
  const extension = new FlutterExtension();
  const shaders = extension.getShaders.call({} as never) as {
    modules: (typeof flutterShaderModule)[];
  };
  const glsl = [
    flutterShaderModule.vs,
    ...Object.values(flutterShaderModule.inject),
  ].join("\n");

  it("adds one shader module named flutter", () => {
    expect(shaders.modules).toEqual([flutterShaderModule]);
    expect(flutterShaderModule.name).toBe("flutter");
  });

  it("declares its uniforms in the order and types of uniformTypes", () => {
    expect(flutterShaderModule.uniformTypes).toEqual({
      timeS: "f32",
      amount: "f32",
      clothLength: "f32",
    });
    const block = flutterShaderModule.vs.replace(/\s+/g, " ");
    expect(block).toContain(
      "uniform flutterUniforms { float timeS; float amount; float clothLength; } flutter;",
    );
  });

  it("bends by the cloth's u and the vehicle's phase", () => {
    expect(flutterShaderModule.inject["vs:#decl"]).toContain(
      "in float instanceFlutterPhases;",
    );
    expect(glsl).toContain("texCoords.x");
    expect(glsl).toContain("instanceFlutterPhases");
  });

  it("carries the FLUTTER_* constants from the domain", () => {
    expect(glsl).toMatch(
      new RegExp(`FLUTTER_PERIOD_S\\s+${FLUTTER_PERIOD_S}\\b`),
    );
    expect(glsl).toMatch(
      new RegExp(`FLUTTER_AMPLITUDE\\s+${FLUTTER_AMPLITUDE}\\b`),
    );
    expect(glsl).toMatch(new RegExp(`FLUTTER_STILL\\s+${FLUTTER_STILL}\\b`));
    expect(glsl).toMatch(
      new RegExp(`FLUTTER_WAVES\\s+${FLUTTER_WAVES.toFixed(1)}\\b`),
    );
  });
});
