import type { Layer } from "@deck.gl/core";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import {
  TRAIL_LAG_S,
  TRAIL_SAMPLES,
  type Rgb,
  type Vec3,
} from "../../domain/fireworks.ts";
import { sparkModel } from "../../domain/vehicleMeshes.ts";
import type { MapScheme } from "../basemap/basemap.ts";
import {
  glowing,
  LIGHT_POOL_PARAMETERS,
  MODEL_BEFORE_LAYER,
} from "../Vehicle/vehicleModelLayers.ts";
import type { Burst } from "./fireworkShow.ts";
import {
  FireworksExtension,
  type FireworksExtensionProps,
} from "./fireworksExtension.ts";

export type SparkInstance = {
  /** The burst: longitude, latitude, altitude in metres. */
  position: [number, number, number];
  /** Launch, in seconds after the data's epoch. */
  launchS: number;
  direction: Vec3;
  speed: number;
  colour: Rgb;
  lagS: number;
  /** 0 the rocket's head, 1 a spark. */
  kind: 0 | 1;
  heightM: number;
};

export type FireworkLayerOptions = {
  visible: boolean;
  scheme: MapScheme;
  /** Seconds after the data's epoch. */
  timeS: number;
  /** Changes with the epoch the instances' launch times are counted from. */
  epochKey: unknown;
};

/** The rocket's head as it climbs: a warm white, whatever it bursts into. */
const ROCKET_COLOUR: Rgb = [255, 230, 180];

/**
 * One instance for every build: deck.gl compares extensions, and a new one per
 * frame would count as a change to the layer's shaders.
 */
const FIREWORKS = [new FireworksExtension()];

/**
 * Drawn with the models, under the icon layer. `beforeId` is read by the
 * interleaved overlay rather than declared on the layer's props, so it is
 * spread in, as the other model layers do.
 */
const PLACEMENT = { beforeId: MODEL_BEFORE_LAYER };

/** Lit by ambient light alone, at full strength: the colour as drawn. */
const UNLIT = glowing(1);

/**
 * In dark mode sparks are added to what is under them, like the light pools,
 * so they glow and overlapping sparks brighten; on the light map that would
 * wash out to white, so there they are painted over it. Neither writes depth,
 * so a spark does not hide the one behind it; both test it, so buildings and
 * terrain still hide sparks behind them.
 */
const BLENDING: Record<MapScheme, Record<string, unknown>> = {
  dark: LIGHT_POOL_PARAMETERS,
  light: {
    depthWriteEnabled: false,
    blend: true,
    blendColorOperation: "add",
    blendColorSrcFactor: "src-alpha",
    blendColorDstFactor: "one-minus-src-alpha",
    blendAlphaOperation: "add",
    blendAlphaSrcFactor: "one",
    blendAlphaDstFactor: "one-minus-src-alpha",
  },
};

/**
 * The instances for the bursts in the air: per burst, the rocket's head and
 * `TRAIL_SAMPLES` copies of each spark, each lagging the one ahead of it.
 * Launch times are counted from `epochMs`, so they stay small enough for the
 * shader's float32 arithmetic.
 */
export function sparkInstances(
  bursts: readonly Burst[],
  epochMs: number,
): SparkInstance[] {
  const instances: SparkInstance[] = [];
  for (const { launchMs, position, heightM, sparks } of bursts) {
    const launchS = (launchMs - epochMs) / 1000;
    instances.push({
      position,
      launchS,
      direction: [0, 0, 1],
      speed: 0,
      colour: ROCKET_COLOUR,
      lagS: 0,
      kind: 0,
      heightM,
    });
    for (const { direction, speed, colour } of sparks) {
      for (let i = 0; i < TRAIL_SAMPLES; i++) {
        instances.push({
          position,
          launchS,
          direction,
          speed,
          colour,
          lagS: i * TRAIL_LAG_S,
          kind: 1,
          heightM,
        });
      }
    }
  }
  return instances;
}

/**
 * The deck.gl layer drawing the fireworks: one instance of the spark mesh per
 * rocket head and trail sample, flown by the shader. The data changes on a
 * launch or a prune; a frame changes only `timeS`, a uniform.
 */
export function fireworkLayers(
  instances: SparkInstance[],
  { visible, scheme, timeS, epochKey }: FireworkLayerOptions,
): Layer[] {
  if (!visible) return [];
  return [
    new SimpleMeshLayer<SparkInstance, FireworksExtensionProps<SparkInstance>>({
      ...PLACEMENT,
      id: "fireworks",
      data: instances,
      mesh: sparkModel(),
      material: UNLIT,
      parameters: BLENDING[scheme],
      extensions: FIREWORKS,
      getPosition: (d) => d.position,
      getColor: (d) => d.colour,
      getLaunchS: (d) => d.launchS,
      getDirection: (d) => d.direction,
      getSpeed: (d) => d.speed,
      getLagS: (d) => d.lagS,
      getKind: (d) => d.kind,
      getHeightM: (d) => d.heightM,
      fireworksTimeS: timeS,
      fireworksAdditive: scheme === "dark",
      updateTriggers: {
        getPosition: epochKey,
        getColor: epochKey,
        getLaunchS: epochKey,
        getDirection: epochKey,
        getSpeed: epochKey,
        getLagS: epochKey,
        getKind: epochKey,
        getHeightM: epochKey,
      },
    }),
  ];
}
