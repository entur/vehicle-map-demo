import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import type { VehicleModeEnumeration, VehicleUpdate } from "../../types.ts";
import { hash } from "../../domain/decorationPlacement.ts";
import { FLUTTER_PERIOD_S } from "../../domain/flutter.ts";
import { normaliseBearing } from "../../domain/vehicleFootprint.ts";
import {
  FLAG,
  FLAG_EXAGGERATION,
  FLAGGED_MODES,
  flagModelFor,
} from "../../domain/vehicleMeshes.ts";
import {
  MODEL_BEFORE_LAYER,
  MODEL_MATERIALS,
  modelOrientation,
  type ModelLayerOptions,
  UNTINTED,
} from "../Vehicle/vehicleModelLayers.ts";
import type { AnimationState } from "./animationClock.ts";
import {
  FlutterExtension,
  type FlutterExtensionProps,
} from "./flutterExtension.ts";

export type FlagLayerOptions = Omit<ModelLayerOptions, "idPrefix"> & {
  idPrefix: string;
  flutter: AnimationState;
};

/**
 * One instance for every build: deck.gl compares extensions, and a new one per
 * tick would count as a change to the layer's shaders.
 */
const FLUTTER = [new FlutterExtension()];

/**
 * The cloth's two faces lie in one plane, facing opposite ways: culling the
 * back faces leaves each side showing only its own.
 */
const CLOTH_PARAMETERS = { cullMode: "back" } as const;

/** The cloth's length in model units, which the flutter is a share of. */
const CLOTH_LENGTH = FLAG.clothLength * FLAG_EXAGGERATION;

/** A vehicle's flutter phase, 0–1, the same on every load. */
export function vehiclePhase(vehicle: VehicleUpdate): number {
  return hash(vehicle.vehicleId) / 2 ** 32;
}

/**
 * The vehicles that fly flags: the flagged modes, drawn as a model with a
 * heading. A vehicle without a usable bearing is the directionless column,
 * which has no front corners to fly them from.
 */
export function flaggedVehicles(vehicles: VehicleUpdate[]): VehicleUpdate[] {
  return vehicles.filter(
    (vehicle) =>
      FLAGGED_MODES.has(vehicle.mode) &&
      normaliseBearing(vehicle.bearing) !== null,
  );
}

/**
 * Whether a vehicle drawn on its own — the chased one, as the chase camera
 * draws it — flies flags. Asked of the drawn vehicle rather than the live
 * feed, which drops a vehicle the chase still draws from its last report.
 */
export function fliesFlags(vehicle: VehicleUpdate | null): boolean {
  return vehicle !== null && flaggedVehicles([vehicle]).length > 0;
}

/**
 * The flagged vehicles by mode, kept per input array: a flutter tick builds
 * the layers again from the same vehicles, and new data arrays would make
 * deck.gl upload every instance attribute again.
 */
const byModeCache = new WeakMap<
  VehicleUpdate[],
  Map<VehicleModeEnumeration, VehicleUpdate[]>
>();

function flaggedByMode(vehicles: VehicleUpdate[]) {
  let byMode = byModeCache.get(vehicles);
  if (!byMode) {
    byMode = new Map();
    for (const vehicle of flaggedVehicles(vehicles)) {
      const list = byMode.get(vehicle.mode) ?? [];
      list.push(vehicle);
      byMode.set(vehicle.mode, list);
    }
    byModeCache.set(vehicles, byMode);
  }
  return byMode;
}

/**
 * The deck.gl layers drawing the 17. mai flags on the models: per flagged
 * mode, one layer for the poles and one for the cloth, every vehicle an
 * instance, placed and turned exactly as its model is. The colours are the
 * mesh's own under a white tint, lit like the body. A flutter tick changes the
 * cloth's uniforms only.
 */
export function flagLayers(
  vehicles: VehicleUpdate[],
  {
    idPrefix,
    visible,
    opacity,
    scheme,
    getPosition,
    getTilt,
    positionTrigger,
    flutter,
  }: FlagLayerOptions,
): SimpleMeshLayer<VehicleUpdate>[] {
  if (!visible) return [];

  // Wrapped here, in double precision: a wall screen runs for weeks, and as a
  // float32 uniform the raw seconds would step the flutter visibly. The curve
  // repeats every period, so this is exactly the same pose.
  const timeS = flutter.timeS % FLUTTER_PERIOD_S;
  const material = MODEL_MATERIALS[scheme].shaded;
  const shared = {
    beforeId: MODEL_BEFORE_LAYER,
    visible,
    opacity,
    getPosition,
    getOrientation: modelOrientation(getTilt),
    getColor: UNTINTED,
    material,
    updateTriggers: {
      getPosition: positionTrigger,
      getOrientation: positionTrigger,
    },
  };

  return [...flaggedByMode(vehicles)].flatMap(([mode, list]) => {
    const { poles, cloth } = flagModelFor(mode)!;
    return [
      new SimpleMeshLayer<VehicleUpdate>({
        ...shared,
        id: `${idPrefix}-${mode}-flag-poles`,
        data: list,
        mesh: poles,
      }),
      new SimpleMeshLayer<VehicleUpdate, FlutterExtensionProps<VehicleUpdate>>({
        ...shared,
        id: `${idPrefix}-${mode}-flag-cloth`,
        data: list,
        mesh: cloth,
        parameters: CLOTH_PARAMETERS,
        extensions: FLUTTER,
        getPhase: vehiclePhase,
        flutterTimeS: timeS,
        flutterAmount: flutter.amount,
        flutterLength: CLOTH_LENGTH,
      }),
    ];
  });
}
