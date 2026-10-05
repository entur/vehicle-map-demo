import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import {
  FILTERABLE_FLAGS,
  FLAG_LEVEL,
  STALE_OPEN_ENDED_DAYS,
  situationFlags,
} from "./situationFlags.ts";
import { JourneyRefSlot } from "./journeyRef.ts";
import { Affects } from "../types.ts";

const NOW = Date.parse("2026-08-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) =>
  new Date(NOW + offsetDays * DAY).toISOString();

/** Affects naming a single journey, identified only in `slot`. */
const withOneJourneyRef = (slot: JourneyRefSlot, id: string): Affects => ({
  vehicleModes: null,
  stopPoints: null,
  stopPlaces: null,
  operators: null,
  affectedLines: null,
  vehicleJourneys: [
    {
      serviceJourney: null,
      datedServiceJourney: null,
      [slot]: { id },
      line: null,
      operator: null,
      stops: null,
      affectedPointsOnLink: null,
    },
  ],
});

describe("situationFlags", () => {
  it("flags a period with no end time as noEndTime", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-10), endTime: null }],
    });
    expect(situationFlags(situation, NOW)).toContain("noEndTime");
  });

  it("does not flag noEndTime when every period has an end time", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-10), endTime: iso(10) }],
    });
    expect(situationFlags(situation, NOW)).not.toContain("noEndTime");
  });

  it("flags noEndTime when only one of several periods lacks an end time", () => {
    const situation = makeSituation({
      validityPeriods: [
        { startTime: iso(-10), endTime: iso(-5) },
        { startTime: iso(-4), endTime: null },
      ],
    });
    expect(situationFlags(situation, NOW)).toContain("noEndTime");
  });

  it("flags staleOpenEnded just past the threshold", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-200), endTime: null }],
      creationTime: iso(-(STALE_OPEN_ENDED_DAYS + 1)),
    });
    expect(situationFlags(situation, NOW)).toContain("staleOpenEnded");
  });

  it("does not flag staleOpenEnded just inside the threshold", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-10), endTime: null }],
      creationTime: iso(-(STALE_OPEN_ENDED_DAYS - 1)),
    });
    expect(situationFlags(situation, NOW)).not.toContain("staleOpenEnded");
  });

  it("does not flag staleOpenEnded when the situation has an end time", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-200), endTime: iso(10) }],
      creationTime: iso(-500),
    });
    expect(situationFlags(situation, NOW)).not.toContain("staleOpenEnded");
  });

  it("never flags staleOpenEnded without a creationTime", () => {
    const situation = makeSituation({
      validityPeriods: [{ startTime: iso(-200), endTime: null }],
      creationTime: null,
    });
    const flags = situationFlags(situation, NOW);
    expect(flags).toContain("noEndTime");
    expect(flags).not.toContain("staleOpenEnded");
  });

  it("flags notYetActive when every period starts in the future", () => {
    const situation = makeSituation({
      validityPeriods: [
        { startTime: iso(3), endTime: iso(5) },
        { startTime: iso(7), endTime: iso(9) },
      ],
    });
    expect(situationFlags(situation, NOW)).toContain("notYetActive");
  });

  it("does not flag notYetActive when any period has already started", () => {
    const situation = makeSituation({
      validityPeriods: [
        { startTime: iso(-1), endTime: iso(5) },
        { startTime: iso(7), endTime: iso(9) },
      ],
    });
    expect(situationFlags(situation, NOW)).not.toContain("notYetActive");
  });

  it("flags no time flag when there are no validity periods", () => {
    expect(situationFlags(makeSituation({ validityPeriods: [] }), NOW)).toEqual(
      [],
    );
  });

  it("flags mistypedJourneyRef when a journey ref is in the wrong slot", () => {
    const situation = makeSituation({
      affects: withOneJourneyRef("datedServiceJourney", "ATB:ServiceJourney:1"),
    });
    expect(situationFlags(situation, NOW)).toContain("mistypedJourneyRef");
  });

  it("does not flag mistypedJourneyRef when the ref matches its slot", () => {
    const situation = makeSituation({
      affects: withOneJourneyRef(
        "datedServiceJourney",
        "ATB:DatedServiceJourney:1",
      ),
    });
    expect(situationFlags(situation, NOW)).not.toContain("mistypedJourneyRef");
  });

  // The time flags are computed behind an early return for a situation with no
  // validity periods. mistypedJourneyRef does not depend on time, so it must
  // survive that guard — the ATB situations that carry a bad ref are exactly
  // the ones whose other metadata is thin.
  it("flags mistypedJourneyRef on a situation with no validity periods", () => {
    const situation = makeSituation({
      validityPeriods: [],
      affects: withOneJourneyRef("datedServiceJourney", "ATB:ServiceJourney:1"),
    });
    expect(situationFlags(situation, NOW)).toEqual(["mistypedJourneyRef"]);
  });

  it("rates mistypedJourneyRef and staleOpenEnded warnings, the other two info", () => {
    expect(FLAG_LEVEL.staleOpenEnded).toBe("warning");
    expect(FLAG_LEVEL.mistypedJourneyRef).toBe("warning");
    expect(FLAG_LEVEL.noEndTime).toBe("info");
    expect(FLAG_LEVEL.notYetActive).toBe("info");
  });

  it("offers mistypedJourneyRef as a filter facet", () => {
    expect(FILTERABLE_FLAGS).toContain("mistypedJourneyRef");
  });
});
