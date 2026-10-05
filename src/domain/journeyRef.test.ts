import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { AffectedVehicleJourney, Affects } from "../types.ts";
import {
  describeMistype,
  mistypedJourneyRefs,
  mistypedRefsOf,
  netexType,
} from "./journeyRef.ts";

const EMPTY_AFFECTS: Affects = {
  vehicleModes: null,
  stopPoints: null,
  stopPlaces: null,
  operators: null,
  vehicleJourneys: null,
  affectedLines: null,
};

const EMPTY_JOURNEY: AffectedVehicleJourney = {
  serviceJourney: null,
  datedServiceJourney: null,
  line: null,
  operator: null,
  stops: null,
  affectedPointsOnLink: null,
};

/** A situation naming exactly these journey entries. */
function withJourneys(journeys: Partial<AffectedVehicleJourney>[]) {
  return makeSituation({
    affects: {
      ...EMPTY_AFFECTS,
      vehicleJourneys: journeys.map((journey) => ({
        ...EMPTY_JOURNEY,
        ...journey,
      })),
    },
  });
}

describe("netexType", () => {
  it("reads the type segment of a NetEx id", () => {
    expect(netexType("ATB:ServiceJourney:311_260106098642715_6008")).toBe(
      "ServiceJourney",
    );
  });

  it("reads the type segment when the value itself contains colons", () => {
    expect(netexType("VYG:DatedServiceJourney:2107:LLS-ASR:26-05-18")).toBe(
      "DatedServiceJourney",
    );
  });

  it("returns null for an id with no type segment", () => {
    expect(netexType("ATB:ServiceJourney")).toBeNull();
  });

  it("returns null for an id whose type segment is empty", () => {
    expect(netexType("ATB::311_260106098642715_6008")).toBeNull();
  });
});

describe("mistypedJourneyRefs", () => {
  it("reports a ServiceJourney id published in the datedServiceJourney slot", () => {
    const situation = withJourneys([
      {
        datedServiceJourney: {
          id: "ATB:ServiceJourney:311_260106098642715_6008",
        },
      },
    ]);

    expect(mistypedJourneyRefs(situation)).toEqual([
      {
        id: "ATB:ServiceJourney:311_260106098642715_6008",
        slot: "datedServiceJourney",
        actualType: "ServiceJourney",
      },
    ]);
  });

  it("reports a DatedServiceJourney id published in the serviceJourney slot", () => {
    const situation = withJourneys([
      {
        serviceJourney: { id: "VYG:DatedServiceJourney:2107_LLS-ASR_26-05-18" },
      },
    ]);

    expect(mistypedJourneyRefs(situation)).toEqual([
      {
        id: "VYG:DatedServiceJourney:2107_LLS-ASR_26-05-18",
        slot: "serviceJourney",
        actualType: "DatedServiceJourney",
      },
    ]);
  });

  it("reports a malformed id with a null actualType", () => {
    const situation = withJourneys([
      { datedServiceJourney: { id: "not-a-netex-id" } },
    ]);

    expect(mistypedJourneyRefs(situation)).toEqual([
      { id: "not-a-netex-id", slot: "datedServiceJourney", actualType: null },
    ]);
  });

  it("reports nothing when both slots carry the type they are named for", () => {
    const situation = withJourneys([
      {
        serviceJourney: { id: "ATB:ServiceJourney:311_260106098642715_6008" },
        datedServiceJourney: {
          id: "VYG:DatedServiceJourney:2107_LLS-ASR_26-05-18",
        },
      },
    ]);

    expect(mistypedJourneyRefs(situation)).toEqual([]);
  });

  it("reports a repeated ref once, in first-seen order", () => {
    const situation = withJourneys([
      { datedServiceJourney: { id: "ATB:ServiceJourney:a" } },
      { datedServiceJourney: { id: "ATB:ServiceJourney:b" } },
      { datedServiceJourney: { id: "ATB:ServiceJourney:a" } },
    ]);

    expect(mistypedJourneyRefs(situation).map((ref) => ref.id)).toEqual([
      "ATB:ServiceJourney:a",
      "ATB:ServiceJourney:b",
    ]);
  });

  it("reports the same id in both slots separately", () => {
    const situation = withJourneys([
      { datedServiceJourney: { id: "ATB:Foo:1" } },
      { serviceJourney: { id: "ATB:Foo:1" } },
    ]);

    expect(mistypedJourneyRefs(situation).map((ref) => ref.slot)).toEqual([
      "datedServiceJourney",
      "serviceJourney",
    ]);
  });

  it("reports nothing for a situation with no affects", () => {
    expect(mistypedJourneyRefs(makeSituation({ affects: null }))).toEqual([]);
  });

  it("reports nothing for a situation naming no journeys", () => {
    expect(
      mistypedJourneyRefs(makeSituation({ affects: { ...EMPTY_AFFECTS } })),
    ).toEqual([]);
  });
});

describe("mistypedRefsOf", () => {
  it("reports the bad refs of a single journey entry", () => {
    const journey = {
      ...EMPTY_JOURNEY,
      datedServiceJourney: { id: "ATB:ServiceJourney:1" },
    };
    expect(mistypedRefsOf(journey).map((ref) => ref.id)).toEqual([
      "ATB:ServiceJourney:1",
    ]);
  });

  it("reports nothing for a well-typed entry", () => {
    const journey = {
      ...EMPTY_JOURNEY,
      datedServiceJourney: { id: "ATB:DatedServiceJourney:1" },
      serviceJourney: { id: "ATB:ServiceJourney:1" },
    };
    expect(mistypedRefsOf(journey)).toEqual([]);
  });
});

describe("describeMistype", () => {
  it("names the type found and the slot it was found in", () => {
    expect(
      describeMistype({
        id: "ATB:ServiceJourney:1",
        slot: "datedServiceJourney",
        actualType: "ServiceJourney",
      }),
    ).toBe("ServiceJourney id in the datedServiceJourney slot");
  });

  it("describes a malformed id as malformed rather than naming a type", () => {
    expect(
      describeMistype({
        id: "nonsense",
        slot: "serviceJourney",
        actualType: null,
      }),
    ).toBe("malformed id in the serviceJourney slot");
  });
});
