import { describe, expect, it } from "vitest";
import { journeyPolylines, splitJourneyIds } from "./journeyBatch.ts";

describe("splitJourneyIds", () => {
  it("sends dated ids to datedServiceJourneys and the rest to serviceJourneys", () => {
    expect(
      splitJourneyIds([
        "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-03",
        "ATB:ServiceJourney:311_260106098642683_7010",
        "GOA:DatedServiceJourney:B716-EE_DRM-OS_D641162D_26-09-21",
      ]),
    ).toEqual({
      dated: [
        "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-03",
        "GOA:DatedServiceJourney:B716-EE_DRM-OS_D641162D_26-09-21",
      ],
      undated: ["ATB:ServiceJourney:311_260106098642683_7010"],
    });
  });
});

describe("journeyPolylines", () => {
  it("maps each root's rows back to the id they were asked with", () => {
    const polylines = journeyPolylines({
      datedServiceJourneys: [
        {
          id: "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-03",
          serviceJourney: { pointsOnLink: { points: "vyg-points" } },
        },
      ],
      serviceJourneys: [
        {
          id: "ATB:ServiceJourney:311_260106098642683_7010",
          pointsOnLink: { points: "atb-points" },
        },
      ],
    });
    expect(polylines.get("VYG:DatedServiceJourney:1013_ASR-HAG_26-09-03")).toBe(
      "vyg-points",
    );
    expect(polylines.get("ATB:ServiceJourney:311_260106098642683_7010")).toBe(
      "atb-points",
    );
  });

  it("leaves out an id the API dropped, and one returned without points", () => {
    const polylines = journeyPolylines({
      datedServiceJourneys: [
        {
          id: "VYG:DatedServiceJourney:no-shape_26-09-03",
          serviceJourney: { pointsOnLink: null },
        },
      ],
      serviceJourneys: null,
    });
    expect(polylines.size).toBe(0);
  });
});
