import { LayerExtension } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import {
  FLUTTER_AMPLITUDE,
  FLUTTER_PERIOD_S,
  FLUTTER_STILL,
  FLUTTER_WAVES,
} from "../../domain/flutter.ts";
import { FLAG_SPLAY_DEG } from "../../domain/vehicleMeshes.ts";

export type FlutterExtensionProps<D> = {
  /** Each vehicle's phase, 0–1, so flags do not flutter in step. */
  getPhase: (d: D) => number;
  flutterTimeS: number;
  /** 0 = the still pose, 1 = the full flutter. */
  flutterAmount: number;
  /** The cloth's length in model units, which the offset is a share of. */
  flutterLength: number;
};

type FlutterUniforms = {
  timeS: number;
  amount: number;
  clothLength: number;
};

/** A GLSL float literal: `3` must be written `3.0`. */
const glslFloat = (n: number) =>
  Number.isInteger(n) ? n.toFixed(1) : String(n);

/*
 * The block's members must be in the order and of the types of `uniformTypes`:
 * luma.gl packs the values by that table, not by name.
 */
const splay = (FLAG_SPLAY_DEG * Math.PI) / 180;

const uniformBlock = /* glsl */ `\
#define FLUTTER_PERIOD_S ${glslFloat(FLUTTER_PERIOD_S)}
#define FLUTTER_AMPLITUDE ${glslFloat(FLUTTER_AMPLITUDE)}
#define FLUTTER_WAVES ${glslFloat(FLUTTER_WAVES)}
#define FLUTTER_STILL ${glslFloat(FLUTTER_STILL)}
#define FLUTTER_PI 3.141592653589793
#define FLAG_SPLAY_COS ${glslFloat(Math.cos(splay))}
#define FLAG_SPLAY_SIN ${glslFloat(Math.sin(splay))}

layout(std140) uniform flutterUniforms {
  float timeS;
  float amount;
  float clothLength;
} flutter;
`;

/**
 * `flutterOffset` in src/domain/flutter.ts, per vertex, across the cloth's own
 * plane: each cloth is turned `FLAG_SPLAY_DEG` out from −y to its side, so its
 * outward normal in model space is (side·cos, sin, 0). The side is the sign of
 * model x, where `flagModelFor` keeps each cloth wholly: a face and its back
 * face share their positions and so move together, which the normal's sign
 * would not give, and the mesh needs no extra attribute. The mesh's positions
 * are an attribute and cannot be rewritten, and no hook runs before the
 * instance transform, so the offset is taken through it here, where the
 * attributes are in scope: columns 0 and 1 of the instance's model matrix are
 * where model x and y land. `fract` keeps `sin`'s argument within one turn,
 * which some mobile GPUs reduce poorly.
 */
const mainStart = /* glsl */ `\
  float flutterU = texCoords.x;
  float flutterTravelling = sin(2.0 * FLUTTER_PI * fract(
    flutter.timeS / FLUTTER_PERIOD_S + instanceFlutterPhases - FLUTTER_WAVES * flutterU
  ));
  float flutterShare = flutterU * (
    FLUTTER_STILL * sin(FLUTTER_PI * flutterU)
    + flutter.amount * FLUTTER_AMPLITUDE * flutterTravelling
  );
  float flutterSide = sign(positions.x);
  vec3 flutterAcross = instanceModelMatrixCol0 * (flutterSide * FLAG_SPLAY_COS)
    + instanceModelMatrixCol1 * FLAG_SPLAY_SIN;
  flutter_displacement = flutterAcross * (flutterShare * flutter.clothLength);
`;

/**
 * Adds the offset where SimpleMeshLayer offers the transformed vertex, scaled
 * and projected as the layer does the vertex itself: the transform is linear,
 * so this is the same as bending the cloth in model space before it.
 */
const filterSize = /* glsl */ `\
  vec3 flutterOffset = flutter_displacement * simpleMesh.sizeScale;
  size += simpleMesh.composeModelMatrix ? flutterOffset : project_size(flutterOffset);
`;

/**
 * A luma.gl shader module. Typed by hand: `@luma.gl/shadertools`, which
 * declares `ShaderModule`, is only a transitive dependency here.
 */
export const flutterShaderModule = {
  name: "flutter",
  vs: uniformBlock,
  inject: {
    "vs:#decl": "in float instanceFlutterPhases;\nvec3 flutter_displacement;\n",
    "vs:#main-start": mainStart,
    "vs:DECKGL_FILTER_SIZE": filterSize,
  },
  uniformTypes: {
    timeS: "f32",
    amount: "f32",
    clothLength: "f32",
  },
  // Flat until the first draw sets the real values.
  defaultUniforms: { timeS: 0, amount: 0, clothLength: 0 },
} as const;

type FlutterLayer = Layer<FlutterExtensionProps<unknown>>;

/**
 * Bends a `SimpleMeshLayer`'s cloth along the flutter curve, in the shader,
 * by each vertex's `u` (texture coordinate x, 0 at the pole): each vehicle's
 * phase is an instanced attribute uploaded with the data, and the time,
 * amount and cloth length are uniforms, so a tick changes uniforms only.
 */
export class FlutterExtension extends LayerExtension {
  static extensionName = "FlutterExtension";

  static defaultProps = {
    getPhase: { type: "accessor", value: 0 },
    flutterTimeS: 0,
    flutterAmount: 0,
    flutterLength: 0,
  };

  getShaders() {
    return { modules: [flutterShaderModule] };
  }

  initializeState(this: FlutterLayer) {
    this.getAttributeManager()?.addInstanced({
      instanceFlutterPhases: { size: 1, accessor: "getPhase" },
    });
  }

  draw(this: FlutterLayer) {
    const { flutterTimeS, flutterAmount, flutterLength } = this.props;
    this.setShaderModuleProps({
      flutter: {
        timeS: flutterTimeS,
        amount: flutterAmount,
        clothLength: flutterLength,
      } satisfies FlutterUniforms,
    });
  }
}
