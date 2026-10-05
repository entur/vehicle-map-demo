import { SxProps, Theme } from "@mui/material/styles";
import { SURFACE_INSET } from "./theme.ts";

/** MapLibre's control buttons are 29px wide (maplibre-gl.css). */
const MAP_CONTROL_WIDTH = 29;

/**
 * The right-hand toolbar: `RightMenuButtons`' 36px buttons plus its 4px
 * padding either side, and the 8px gap `RightMenu` keeps beside it.
 */
const TOOLBAR_WIDTH = 36 + 2 * 4;
const TOOLBAR_GAP = 8;

const LEFT = SURFACE_INSET + MAP_CONTROL_WIDTH + SURFACE_INSET;

/** Everything across the screen that is not the card, so it stops short of the toolbar. */
const NOT_CARD = LEFT + TOOLBAR_GAP + TOOLBAR_WIDTH + SURFACE_INSET;

/**
 * Geometry shared by the two left-hand detail panels — the selected vehicle's
 * and the selected situation's. One definition so the two cannot drift into
 * looking like different kinds of surface.
 *
 * A card beside MapLibre's top-left control stack: the stack's inset (see the
 * `.maplibregl-ctrl-top-left` rule in index.css), its button width, and the
 * same inset again. Nothing sits above it, so it runs the full height. On a
 * narrow screen it gives way to the right-hand toolbar rather than covering
 * it; an open tool panel may still overlap it, and `RightMenu` sits above.
 */
export const DETAIL_PANEL_SX = {
  position: "absolute",
  top: SURFACE_INSET,
  bottom: SURFACE_INSET,
  left: LEFT,
  width: `min(340px, calc(100vw - ${NOT_CARD}px))`,
  zIndex: 2,
  padding: 2,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
} as const satisfies SxProps<Theme>;

/**
 * Below this width the detail panels leave the left-hand column and become a
 * bottom sheet (`DetailSheet`), since a full-height card leaves a phone with a
 * strip of map narrower than the card.
 */
export const DETAIL_SHEET_MEDIA_QUERY = "(max-width: 599.95px)";

/**
 * The same panels on a phone: docked to the bottom, full width between the
 * insets every card keeps, `height` px tall and `bottom` px off the bottom
 * edge. Both come from `src/domain/bottomSheet.ts` (`sheetHeight`,
 * `sheetBottom`), which also gives the map the matching bottom padding, so
 * the two cannot disagree about what is hidden.
 */
export function detailSheetSx(height: number, bottom: number) {
  return {
    position: "absolute",
    left: SURFACE_INSET,
    right: SURFACE_INSET,
    bottom,
    height,
    zIndex: 2,
    paddingX: 2,
    paddingBottom: 2,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } as const satisfies SxProps<Theme>;
}
