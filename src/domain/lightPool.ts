import { VehicleModeEnumeration } from "../types.ts";
import { dimensionsFor } from "./vehicleFootprint.ts";
import type { VehicleMesh } from "./vehicleMeshes.ts";

/**
 * The pool of headlight on the road in front of a vehicle, drawn in dark mode
 * only. It is no light at all: a flat quad at the vehicle's own height,
 * textured with a soft wedge (`lightPoolTexture`) whose alpha does the
 * fading, since the mesh's vertex colours carry none. On a slope it clips into
 * the terrain on one side and floats on the other (`LIGHT_POOL_LIFT` keeps
 * that rare on ordinary streets); that is accepted, because
 * fitting it to the ground would mean several terrain lookups per vehicle,
 * every frame for a chased one.
 *
 * Same model space as the vehicle: +y forward, origin on the ground at the
 * reported position.
 */

/** How far ahead of the front the light reaches, in metres. */
export const LIGHT_POOL_REACH = 16;
/** The pool's width at its far end, in metres. */
export const LIGHT_POOL_WIDTH = 12;
/**
 * Above the ground. At 0.05 m the terrain cut ragged holes in pools on a
 * street as gentle as Prinsens gate in Trondheim; raised this far, a flat,
 * translucent quad still looks as if it lies on the road, and the terrain
 * has room to rise under it before it shows through.
 */
export const LIGHT_POOL_LIFT = 0.4;

/** A ferry carries no headlights; every other mode does. */
export function hasLightPool(mode: VehicleModeEnumeration): boolean {
  return mode !== "FERRY";
}

const cache = new Map<VehicleModeEnumeration, Required<VehicleMesh>>();

/**
 * The quad the pool is drawn on, starting at the vehicle's front. Its texture
 * runs from the near edge (v = 1, the texture's bottom row) to the far edge
 * (v = 0), so the texture is drawn with the lamps at the bottom.
 */
export function lightPoolMesh(
  mode: VehicleModeEnumeration,
): Required<VehicleMesh> {
  const cached = cache.get(mode);
  if (cached) return cached;

  const near = dimensionsFor(mode).length / 2;
  const far = near + LIGHT_POOL_REACH;
  const x = LIGHT_POOL_WIDTH / 2;
  const z = LIGHT_POOL_LIFT;
  // Two triangles, wound counter-clockwise seen from above.
  const corners: [number, number, number, number, number][] = [
    [-x, near, z, 0, 1],
    [x, near, z, 1, 1],
    [x, far, z, 1, 0],
    [-x, near, z, 0, 1],
    [x, far, z, 1, 0],
    [-x, far, z, 0, 0],
  ];
  const mesh: Required<VehicleMesh> = {
    positions: {
      value: new Float32Array(corners.flatMap(([px, py, pz]) => [px, py, pz])),
      size: 3,
    },
    normals: {
      value: new Float32Array(corners.flatMap(() => [0, 0, 1])),
      size: 3,
    },
    colors: {
      value: new Float32Array(corners.flatMap(() => [1, 1, 1])),
      size: 3,
    },
    texCoords: {
      value: new Float32Array(corners.flatMap(([, , , u, v]) => [u, v])),
      size: 2,
    },
  };
  cache.set(mode, mesh);
  return mesh;
}
