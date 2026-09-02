import { describe, expect, it } from "vitest";
import { journeyDateOf, mayResolveJourney } from "./journeyDate.ts";

describe("journeyDateOf", () => {
  it("reads the trailing YY-MM-DD as an ISO date", () => {
    expect(journeyDateOf("VYG:DatedServiceJourney:1013_ASR-HAG_26-09-02")).toBe(
      "2026-09-02",
    );
  });

  it("returns null for an id that carries no date", () => {
    expect(journeyDateOf("ATB:ServiceJourney:311_260106098642683_7010")).toBe(
      null,
    );
  });
});

describe("mayResolveJourney", () => {
  const today = "2026-09-02";

  it("keeps a journey dated today", () => {
    expect(
      mayResolveJourney("VYG:DatedServiceJourney:1013_ASR-HAG_26-09-02", today),
    ).toBe(true);
  });

  it("keeps a journey dated in the future", () => {
    expect(
      mayResolveJourney("GOA:DatedServiceJourney:B716_26-09-21", today),
    ).toBe(true);
  });

  it("drops a journey dated in the past", () => {
    expect(
      mayResolveJourney("NSB:DatedServiceJourney:2708_SKI-STB_24-11-12", today),
    ).toBe(false);
  });

  it("keeps an undated journey, which may be planned for any day", () => {
    expect(
      mayResolveJourney("ATB:ServiceJourney:311_260106098642683_7010", today),
    ).toBe(true);
  });
});
