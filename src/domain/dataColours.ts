/**
 * Every colour that carries data meaning, on the map and in the panels.
 *
 * One set for both colour schemes: Positron (light) is near white and Fiord
 * (dark) is dark slate, so no fill contrasts with both. Map marks therefore
 * get a two-tone edge — EDGE_INK inside, EDGE_WHITE outside — and fills sit in
 * a middle luminance band that reads against both rings. dataColours.test.ts
 * holds the thresholds; docs/superpowers/specs/2026-09-16-base-map-design.md
 * section 3 has the reasoning.
 */

export const EDGE_INK = "#1f2430";
export const EDGE_WHITE = "#ffffff";

export const SEVERITY_SEVERE = "#e5483a";
export const SEVERITY_NOTABLE = "#f08a24";
export const SEVERITY_MUTED = "#9aa1ad";

export const ROUTE = "#1bb4ac";
export const SELECTION_HALO = "#4c86f5";
export const TRACE = "#b06bc0";

export const DELAY_LATE = "#e5483a";
export const DELAY_EARLY = "#3d9be0";
export const DELAY_ON_TIME = "#2fa84f";

export const OCCUPANCY_OK = "#2fa84f";
export const OCCUPANCY_FEW = "#e6a700";
export const OCCUPANCY_STANDING = "#f08a24";
export const OCCUPANCY_FULL = "#e5483a";
export const OCCUPANCY_NOT_BOARDING = "#b0303a";
