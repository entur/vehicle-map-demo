import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";
import {
  DELAY_EARLY,
  DELAY_LATE,
  DELAY_ON_TIME,
  EDGE_INK,
  EDGE_WHITE,
  OCCUPANCY_FEW,
  OCCUPANCY_FULL,
  OCCUPANCY_NOT_BOARDING,
  OCCUPANCY_OK,
  OCCUPANCY_STANDING,
  ROUTE,
  SEVERITY_MUTED,
  SEVERITY_NOTABLE,
  SEVERITY_SEVERE,
} from "./dataColours.ts";

// The panel backgrounds of the two colour schemes (theme.ts background.paper).
const PANELS = ["#ffffff", "#23262d"];

describe("map-mark fills", () => {
  // No fill can contrast with both Positron (near white) and Fiord (dark
  // slate), so separation comes from the two-tone edge. The fill must read
  // against both rings of that edge.
  it.each([SEVERITY_SEVERE, SEVERITY_NOTABLE, SEVERITY_MUTED, ROUTE])(
    "%s reads against both edge rings",
    (fill) => {
      expect(contrastRatio(fill, EDGE_INK)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(fill, EDGE_WHITE)).toBeGreaterThanOrEqual(2.5);
    },
  );
});

describe("text colours", () => {
  it.each([SEVERITY_SEVERE, DELAY_LATE, DELAY_EARLY, DELAY_ON_TIME])(
    "%s reaches 3:1 on both panels",
    (colour) => {
      for (const panel of PANELS) {
        expect(contrastRatio(colour, panel)).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe("occupancy glyph colours", () => {
  // A coloured icon whose label is in title/aria-label, not text.
  it.each([
    OCCUPANCY_OK,
    OCCUPANCY_FEW,
    OCCUPANCY_STANDING,
    OCCUPANCY_FULL,
    OCCUPANCY_NOT_BOARDING,
  ])("%s reaches 2:1 on both panels", (colour) => {
    for (const panel of PANELS) {
      expect(contrastRatio(colour, panel)).toBeGreaterThanOrEqual(2);
    }
  });
});
