import { SxProps, Theme } from "@mui/material/styles";
import { SURFACE_INSET } from "./theme.ts";

/** MapLibre's control buttons are 29px wide (maplibre-gl.css). */
const MAP_CONTROL_WIDTH = 29;

/**
 * Geometry shared by the two left-hand detail panels — the selected vehicle's
 * and the selected situation's. One definition so the two cannot drift into
 * looking like different kinds of surface.
 *
 * A card beside MapLibre's top-left control stack: the stack's inset (see the
 * `.maplibregl-ctrl-top-left` rule in index.css), its button width, and the
 * same inset again. Nothing sits above it, so it runs the full height.
 */
export const DETAIL_PANEL_SX = {
  position: "absolute",
  top: SURFACE_INSET,
  bottom: SURFACE_INSET,
  left: SURFACE_INSET + MAP_CONTROL_WIDTH + SURFACE_INSET,
  width: "min(340px, calc(100vw - 80px))",
  zIndex: 2,
  padding: 2,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
} as const satisfies SxProps<Theme>;
