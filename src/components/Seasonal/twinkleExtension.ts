import { LayerExtension } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import { TWINKLE_MIN, TWINKLE_PERIOD_S } from "../../domain/twinkle.ts";

export type TwinkleExtensionProps<D> = {
  /** Each tree's phase, 0–1, so trees do not twinkle in step. */
  getPhase: (d: D) => number;
  twinkleTimeS: number;
  /** 0 = steady and fully lit, 1 = full twinkle. */
  twinkleAmount: number;
  /** Which group of bulbs this layer draws, of `twinkleGroups`. */
  twinkleGroup: number;
  twinkleGroups: number;
};

type TwinkleUniforms = {
  timeS: number;
  amount: number;
  group: number;
  groups: number;
};

/** A GLSL float literal: `3` must be written `3.0`. */
const glslFloat = (n: number) =>
  Number.isInteger(n) ? n.toFixed(1) : String(n);

/*
 * The block's members must be in the order and of the types of `uniformTypes`:
 * luma.gl packs the values by that table, not by name.
 */
const uniformBlock = /* glsl */ `\
#define TWINKLE_PERIOD_S ${glslFloat(TWINKLE_PERIOD_S)}
#define TWINKLE_MIN ${glslFloat(TWINKLE_MIN)}
#define TWINKLE_TAU 6.283185307179586

layout(std140) uniform twinkleUniforms {
  float timeS;
  float amount;
  float group;
  float groups;
} twinkle;
`;

/**
 * `twinkleBrightness` in src/domain/twinkle.ts, per vertex: the bulb colour is
 * dimmed before lighting, so a lamp material's glow fades with it.
 */
const filterColor = /* glsl */ `\
  float twinkleWave = 0.5 - 0.5 * cos(TWINKLE_TAU * (
    twinkle.timeS / TWINKLE_PERIOD_S + instancePhases + twinkle.group / twinkle.groups
  ));
  color.rgb *= 1.0 - twinkle.amount * (1.0 - TWINKLE_MIN) * twinkleWave;
`;

/**
 * A luma.gl shader module. Typed by hand: `@luma.gl/shadertools`, which
 * declares `ShaderModule`, is only a transitive dependency here.
 */
export const twinkleShaderModule = {
  name: "twinkle",
  vs: uniformBlock,
  inject: {
    "vs:#decl": "in float instancePhases;\n",
    "vs:DECKGL_FILTER_COLOR": filterColor,
  },
  uniformTypes: {
    timeS: "f32",
    amount: "f32",
    group: "f32",
    groups: "f32",
  },
  // Steady until the first draw sets the real values.
  defaultUniforms: { timeS: 0, amount: 0, group: 0, groups: 1 },
} as const;

type TwinkleLayer = Layer<TwinkleExtensionProps<unknown>>;

/**
 * Fades a `SimpleMeshLayer`'s colour along the twinkle curve, in the shader:
 * each tree's phase is an instanced attribute uploaded with the data, and the
 * time, amount and group are uniforms, so a tick changes uniforms only.
 */
export class TwinkleExtension extends LayerExtension {
  static extensionName = "TwinkleExtension";

  static defaultProps = {
    getPhase: { type: "accessor", value: 0 },
    twinkleTimeS: 0,
    twinkleAmount: 0,
    twinkleGroup: 0,
    twinkleGroups: 1,
  };

  getShaders() {
    return { modules: [twinkleShaderModule] };
  }

  initializeState(this: TwinkleLayer) {
    this.getAttributeManager()?.addInstanced({
      instancePhases: { size: 1, accessor: "getPhase" },
    });
  }

  draw(this: TwinkleLayer) {
    const { twinkleTimeS, twinkleAmount, twinkleGroup, twinkleGroups } =
      this.props;
    this.setShaderModuleProps({
      twinkle: {
        timeS: twinkleTimeS,
        amount: twinkleAmount,
        group: twinkleGroup,
        groups: twinkleGroups,
      } satisfies TwinkleUniforms,
    });
  }
}
