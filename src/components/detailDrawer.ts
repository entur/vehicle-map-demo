/**
 * Geometry shared by the two left-hand detail drawers — the selected vehicle's
 * and the selected situation's. One definition so the two cannot drift into
 * looking like different kinds of surface.
 *
 * The top offset clears the vehicles-mode left rail. Situations mode hides that
 * rail, so its drawer starts lower than it strictly needs to; kept identical
 * deliberately, because two panels that behave the same should look the same.
 */
export const DETAIL_DRAWER_WIDTH = "min(320px, 90vw)";
export const DETAIL_DRAWER_TOP_OFFSET = 220;
