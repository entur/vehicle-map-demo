import { VehicleUpdate } from "../types.ts";
import { bodyColourFor } from "./vehicleMeshes.ts";

type RGB = [number, number, number];

/**
 * A NeTEx presentation colour as 0–255 RGB. The API publishes six hex digits
 * without a `#`; a leading `#` is accepted anyway. Anything else is null.
 */
export function hexToRgb(hex: string | null | undefined): RGB | null {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  if (!match) return null;
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16),
  ];
}

/**
 * The colour a vehicle model's body is painted: its line's published colour,
 * or the mode colour when the line publishes none.
 *
 * The published colour is used as-is. Most publishers set a brand colour per
 * product rather than per line — and AKT, for one, publishes black for every
 * line — but this tool shows the feed as delivered, so neither is corrected.
 * See `docs/backend/line-colours.md` for what the data contains.
 */
export function paintFor(vehicle: Pick<VehicleUpdate, "mode" | "line">): RGB {
  return (
    hexToRgb(vehicle.line.presentation?.colour) ?? bodyColourFor(vehicle.mode)
  );
}
