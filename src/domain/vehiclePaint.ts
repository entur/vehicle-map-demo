import { Line, VehicleUpdate } from "../types.ts";
import { DEFAULT_SIGN_COLOUR, bodyColourFor } from "./vehicleMeshes.ts";

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

/**
 * The colour a vehicle model's destination signs are lit in: its line's
 * published text colour, or a default amber when the line publishes none.
 * Like `paintFor`, as delivered — AKT's yellow on black included.
 */
export function signColourFor(vehicle: Pick<VehicleUpdate, "line">): RGB {
  return hexToRgb(vehicle.line.presentation?.textColour) ?? DEFAULT_SIGN_COLOUR;
}

/** CSS colours for the map's line-code label, or null to keep the default. */
export type LabelColours = { text: string; halo: string };

const toCss = (rgb: RGB) =>
  "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");

/**
 * The line code set in the line's text colour on a halo of its line colour.
 *
 * The two are used only as a pair. A text colour is chosen to be legible
 * against its own line colour, not against the default white halo, and half a
 * pair could put yellow text on white or black text on a dark halo. Measured
 * on dev, every line that publishes one publishes both.
 */
export function labelColoursFor(
  line: Pick<Line, "presentation">,
): LabelColours | null {
  const halo = hexToRgb(line.presentation?.colour);
  const text = hexToRgb(line.presentation?.textColour);
  return halo && text ? { text: toCss(text), halo: toCss(halo) } : null;
}
