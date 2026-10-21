import { LayerExtension } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import {
  RISE_S,
  SPARK_DRAG,
  SPARK_GRAVITY,
  SPARK_LIFE_S,
  TRAIL_LAG_S,
  TRAIL_SAMPLES,
  type Vec3,
} from "../../domain/fireworks.ts";

export type FireworksExtensionProps<D> = {
  /** Seconds since launch are this less the instance's `getLaunchS`. */
  fireworksTimeS: number;
  getLaunchS: (d: D) => number;
  /** The spark's unit direction, east, north, up. */
  getDirection: (d: D) => Vec3;
  getSpeed: (d: D) => number;
  /** How far a trail sample runs behind its spark, in seconds. */
  getLagS: (d: D) => number;
  /** 0 the rocket's head, 1 a spark. */
  getKind: (d: D) => number;
  /** How far below the burst the rocket starts, in metres. */
  getHeightM: (d: D) => number;
};

type FireworksUniforms = {
  timeS: number;
};

/** A GLSL float literal: `3` must be written `3.0`. */
const glslFloat = (n: number) =>
  Number.isInteger(n) ? n.toFixed(1) : String(n);

/*
 * The block's members must be in the order and of the types of `uniformTypes`:
 * luma.gl packs the values by that table, not by name.
 */
const uniformBlock = /* glsl */ `\
#define FIREWORKS_RISE_S ${glslFloat(RISE_S)}
#define FIREWORKS_SPARK_LIFE_S ${glslFloat(SPARK_LIFE_S)}
#define FIREWORKS_SPARK_GRAVITY ${glslFloat(SPARK_GRAVITY)}
#define FIREWORKS_SPARK_DRAG ${glslFloat(SPARK_DRAG)}
#define FIREWORKS_TRAIL_SAMPLES ${glslFloat(TRAIL_SAMPLES)}
#define FIREWORKS_TRAIL_LAG_S ${glslFloat(TRAIL_LAG_S)}

layout(std140) uniform fireworksUniforms {
  float timeS;
} fireworks;
`;

const declarations = /* glsl */ `\
in float instanceFireworkLaunchS;
in vec3 instanceFireworkDirections;
in float instanceFireworkSpeeds;
in float instanceFireworkLagS;
in float instanceFireworkKinds;
in float instanceFireworkHeightM;
vec3 fireworks_offset;
float fireworks_brightness;
`;

/**
 * `rocketRise`, `sparkOffset` and `sparkBrightness` in
 * src/domain/fireworks.ts, per vertex. The instance's position is the burst;
 * the offset from it is east, north and up in metres, in world space rather
 * than the mesh's, so it does not go through the instance's model matrix.
 *
 * The rocket's head climbs from the ground below the burst and is gone at the
 * burst. A spark's time is clamped at 0, since `sparkOffset` would fly it
 * backwards before then: a trail sample is still before its own start just
 * after the burst, and its brightness of 0 keeps it unseen until it starts.
 * Each trail sample is dimmer than the one ahead of it.
 */
const mainStart = /* glsl */ `\
  float fireworksAge = fireworks.timeS - instanceFireworkLaunchS;
  if (instanceFireworkKinds < 0.5) {
    float fireworksU = clamp(fireworksAge / FIREWORKS_RISE_S, 0.0, 1.0);
    float fireworksRise = 1.0 - (1.0 - fireworksU) * (1.0 - fireworksU);
    fireworks_offset = vec3(0.0, 0.0, (fireworksRise - 1.0) * instanceFireworkHeightM);
    fireworks_brightness =
      fireworksAge >= 0.0 && fireworksAge < FIREWORKS_RISE_S ? 1.0 : 0.0;
  } else {
    float fireworksSparkT = fireworksAge - FIREWORKS_RISE_S - instanceFireworkLagS;
    float fireworksT = max(fireworksSparkT, 0.0);
    float fireworksD = 1.0 - exp(-FIREWORKS_SPARK_DRAG * fireworksT);
    float fireworksReach = instanceFireworkSpeeds * fireworksD / FIREWORKS_SPARK_DRAG;
    float fireworksFall = FIREWORKS_SPARK_GRAVITY / FIREWORKS_SPARK_DRAG
      * (fireworksT - fireworksD / FIREWORKS_SPARK_DRAG);
    fireworks_offset = instanceFireworkDirections * fireworksReach
      - vec3(0.0, 0.0, fireworksFall);
    float fireworksLife = 1.0 - min(1.0, fireworksT / FIREWORKS_SPARK_LIFE_S);
    float fireworksTrail = 1.0
      - instanceFireworkLagS / FIREWORKS_TRAIL_LAG_S / FIREWORKS_TRAIL_SAMPLES;
    fireworks_brightness = fireworksSparkT < 0.0
      ? 0.0
      : fireworksLife * fireworksLife * fireworksTrail;
  }
`;

/**
 * Scales the spark by its brightness, so a fading spark shrinks to nothing,
 * and adds the offset, where SimpleMeshLayer offers the transformed vertex:
 * projected as the layer projects the vertex itself, but not by `sizeScale`,
 * since the offset is in metres, not mesh units.
 */
const filterSize = /* glsl */ `\
  size *= fireworks_brightness;
  size += simpleMesh.composeModelMatrix ? fireworks_offset : project_size(fireworks_offset);
`;

/**
 * Fades by alpha alone, in both schemes: the light map's ordinary blending and
 * the dark map's additive blending both take the source at `src-alpha`, so
 * fading the colour as well would fade a spark twice.
 */
const filterColor = /* glsl */ `\
  color.a *= fireworks_brightness;
`;

/**
 * A luma.gl shader module. Typed by hand: `@luma.gl/shadertools`, which
 * declares `ShaderModule`, is only a transitive dependency here.
 */
export const fireworksShaderModule = {
  name: "fireworks",
  vs: uniformBlock,
  inject: {
    "vs:#decl": declarations,
    "vs:#main-start": mainStart,
    "vs:DECKGL_FILTER_SIZE": filterSize,
    "vs:DECKGL_FILTER_COLOR": filterColor,
  },
  uniformTypes: {
    timeS: "f32",
  },
  // Nothing in the air until the first draw sets the real time.
  defaultUniforms: { timeS: 0 },
} as const;

type FireworksLayer = Layer<FireworksExtensionProps<unknown>>;

/**
 * Flies a `SimpleMeshLayer`'s sparks in the shader: each instance's launch,
 * direction, speed, trail lag, kind and height are instanced attributes
 * uploaded with the data, and the time is a uniform, so a frame changes a
 * uniform only.
 */
export class FireworksExtension extends LayerExtension {
  static extensionName = "FireworksExtension";

  static defaultProps = {
    fireworksTimeS: 0,
    getLaunchS: { type: "accessor", value: 0 },
    getDirection: { type: "accessor", value: [0, 0, 1] },
    getSpeed: { type: "accessor", value: 0 },
    getLagS: { type: "accessor", value: 0 },
    // A spark, by far the common kind: a burst has one head.
    getKind: { type: "accessor", value: 1 },
    getHeightM: { type: "accessor", value: 0 },
  };

  getShaders() {
    return { modules: [fireworksShaderModule] };
  }

  initializeState(this: FireworksLayer) {
    this.getAttributeManager()?.addInstanced({
      instanceFireworkLaunchS: { size: 1, accessor: "getLaunchS" },
      instanceFireworkDirections: { size: 3, accessor: "getDirection" },
      instanceFireworkSpeeds: { size: 1, accessor: "getSpeed" },
      instanceFireworkLagS: { size: 1, accessor: "getLagS" },
      instanceFireworkKinds: { size: 1, accessor: "getKind" },
      instanceFireworkHeightM: { size: 1, accessor: "getHeightM" },
    });
  }

  draw(this: FireworksLayer) {
    const { fireworksTimeS } = this.props;
    this.setShaderModuleProps({
      fireworks: {
        timeS: fireworksTimeS,
      } satisfies FireworksUniforms,
    });
  }
}
