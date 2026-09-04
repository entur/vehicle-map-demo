import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import fixture from "../__fixtures__/situations.json";
import { AffectedVehicleJourney, NationalSituation } from "../types.ts";
import { buildSituationFeatures } from "./situationFeatures.ts";

const stop = (id: string, latitude: number, longitude: number) => ({
  id,
  name: id,
  location: { latitude, longitude },
});

describe("buildSituationFeatures", () => {
  it("builds one point per affected stop", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:2", 61, 11)],
          stopPlaces: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    const { pointFeatures, unmappable } = buildSituationFeatures(situations);

    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures[0].geometry.coordinates).toEqual([10, 60]);
    expect(pointFeatures[0].properties.situationNumber).toBe(
      "TST:SituationNumber:1",
    );
    expect(unmappable).toEqual([]);
  });

  it("deduplicates a repeated stop within one situation", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:1", 60, 10)],
          stopPlaces: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    expect(buildSituationFeatures(situations).pointFeatures).toHaveLength(1);
  });

  it("keeps coincident features from different situations", () => {
    const affects = {
      vehicleModes: null,
      stopPoints: [stop("NSR:Quay:1", 60, 10)],
      stopPlaces: null,
      operators: null,
      vehicleJourneys: null,
      affectedLines: null,
    };
    const situations = [
      makeSituation({ situationNumber: "A", affects }),
      makeSituation({ situationNumber: "B", affects }),
    ];

    const { pointFeatures } = buildSituationFeatures(situations);
    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures.map((f) => f.properties.situationNumber)).toEqual([
      "A",
      "B",
    ]);
  });

  it("skips a stop with no coordinates rather than inventing one", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          stopPoints: [{ id: "NSR:Quay:9", name: "Nowhere", location: null }],
          stopPlaces: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    const { pointFeatures, unmappable } = buildSituationFeatures(situations);
    expect(pointFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("reports a situation with no affects at all as unmappable", () => {
    const { unmappable } = buildSituationFeatures([
      makeSituation({ affects: null }),
    ]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("counts features per situation", () => {
    const situations = [
      makeSituation({
        situationNumber: "A",
        affects: {
          vehicleModes: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:2", 61, 11)],
          stopPlaces: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
      makeSituation({ situationNumber: "B", affects: null }),
    ];

    const { featureCountBySituation } = buildSituationFeatures(situations);
    expect(featureCountBySituation.get("A")).toBe(2);
    expect(featureCountBySituation.get("B")).toBe(0);
  });
});

describe("against the captured dev fixture", () => {
  const situations = (fixture as { situations: NationalSituation[] })
    .situations;

  it("captured a usable spread of situations", () => {
    expect(situations.length).toBeGreaterThan(5);
  });

  it("accounts for every situation as either mapped or unmappable", () => {
    const { featureCountBySituation, unmappable } =
      buildSituationFeatures(situations);

    for (const situation of situations) {
      const count = featureCountBySituation.get(situation.situationNumber) ?? 0;
      expect(count === 0).toBe(unmappable.includes(situation.situationNumber));
    }
  });

  it("never emits a feature with a non-finite coordinate", () => {
    const { pointFeatures, lineFeatures } = buildSituationFeatures(situations);
    const coordinates = [
      ...pointFeatures.map((f) => f.geometry.coordinates),
      ...lineFeatures.flatMap((f) => f.geometry.coordinates),
    ];
    for (const [longitude, latitude] of coordinates) {
      expect(Number.isFinite(longitude)).toBe(true);
      expect(Number.isFinite(latitude)).toBe(true);
    }
  });
});

const EMPTY = {
  vehicleModes: null,
  stopPoints: null,
  stopPlaces: null,
  operators: null,
  vehicleJourneys: null,
  affectedLines: null,
};

const affectedStop = (id: string, latitude: number, longitude: number) => ({
  stop: { id, name: id, location: { latitude, longitude } },
  stopConditions: [],
});

describe("stops carried by the new affects fields", () => {
  it("builds a point per located stop of an affected journey", () => {
    const { pointFeatures, unmappable } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [
            {
              serviceJourney: null,
              datedServiceJourney: { id: "VYG:DatedServiceJourney:1" },
              line: null,
              operator: null,
              stops: [
                affectedStop("NSR:Quay:1", 59.9, 10.7),
                affectedStop("NSR:Quay:2", 60.1, 10.8),
              ],
              affectedPointsOnLink: null,
            },
          ],
        },
      }),
    ]);

    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
    expect(pointFeatures[0].properties.entityId).toBe("NSR:Quay:1");
    expect(pointFeatures[0].geometry.coordinates).toEqual([10.7, 59.9]);
    expect(unmappable).toEqual([]);
  });

  it("builds a point per located stop of an affected line", () => {
    const { pointFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          affectedLines: [
            {
              line: {
                lineRef: "RUT:Line:81",
                lineName: "81",
                publicCode: "81",
              },
              stops: [affectedStop("NSR:Quay:7169", 59.91, 10.75)],
            },
          ],
        },
      }),
    ]);

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("lineStop");
    expect(pointFeatures[0].properties.entityId).toBe("NSR:Quay:7169");
  });

  it("collapses a stop repeated across many journeys of one situation", () => {
    const journey = (id: string) => ({
      serviceJourney: null,
      datedServiceJourney: { id },
      line: null,
      operator: null,
      stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
      affectedPointsOnLink: null,
    });

    const { pointFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [journey("A"), journey("B"), journey("C")],
        },
      }),
    ]);

    expect(pointFeatures).toHaveLength(1);
  });

  it("draws one dot for a stop reached as both a journey stop and a line stop", () => {
    const { pointFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [
            {
              serviceJourney: null,
              datedServiceJourney: { id: "A" },
              line: null,
              operator: null,
              stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
              affectedPointsOnLink: null,
            },
          ],
          affectedLines: [
            { line: null, stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)] },
          ],
        },
      }),
    ]);

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
  });

  it("still draws two coincident dots when two situations share a stop", () => {
    const one = (situationNumber: string) =>
      makeSituation({
        situationNumber,
        affects: {
          ...EMPTY,
          affectedLines: [
            { line: null, stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)] },
          ],
        },
      });

    const { pointFeatures } = buildSituationFeatures([
      one("TST:SituationNumber:1"),
      one("TST:SituationNumber:2"),
    ]);

    expect(pointFeatures).toHaveLength(2);
  });

  it("draws a stop that is unlocated in one source and located in another", () => {
    const { pointFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          affectedLines: [
            {
              line: null,
              stops: [
                {
                  stop: { id: "NSR:Quay:1", name: null, location: null },
                  stopConditions: [],
                },
              ],
            },
          ],
          vehicleJourneys: [
            {
              serviceJourney: null,
              datedServiceJourney: { id: "A" },
              line: null,
              operator: null,
              stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
              affectedPointsOnLink: null,
            },
          ],
        },
      }),
    ]);

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
  });

  it("skips a stop the API could not locate, and reports the situation unmappable", () => {
    const { pointFeatures, unmappable } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          affectedLines: [
            {
              line: null,
              stops: [
                {
                  stop: { id: "NSR:Quay:9", name: null, location: null },
                  stopConditions: [],
                },
              ],
            },
          ],
        },
      }),
    ]);

    expect(pointFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });
});

describe("affected spans", () => {
  // Verified against src/utils/decodePolyline.ts: decodes to
  // [[10, 63.00000000000001], [10.5, 63.400000000000006]] as
  // [longitude, latitude]. Assert on length, not on exact coordinates —
  // the encoding round-trips through 1e5 integers and loses the last bit.
  const POLYLINE = "_uo_K_c`|@_cmA_t`B";

  const journeyWithSpan = (
    overrides: Partial<AffectedVehicleJourney> = {},
  ): AffectedVehicleJourney => ({
    serviceJourney: null,
    datedServiceJourney: {
      id: "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-02",
    },
    line: null,
    operator: null,
    stops: null,
    affectedPointsOnLink: { points: POLYLINE, length: 119 },
    ...overrides,
  });

  it("builds one line feature from the journey's own geometry", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures([
      makeSituation({
        affects: { ...EMPTY, vehicleJourneys: [journeyWithSpan()] },
      }),
    ]);

    expect(lineFeatures).toHaveLength(1);
    expect(lineFeatures[0].properties.source).toBe("affectedSpan");
    expect(lineFeatures[0].properties.entityId).toBe(
      "VYG:DatedServiceJourney:1013_ASR-HAG_26-09-02",
    );
    expect(lineFeatures[0].geometry.coordinates).toHaveLength(2);
    expect(unmappable).toEqual([]);
  });

  it("falls back to the service journey id when there is no dated id", () => {
    const { lineFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [
            journeyWithSpan({
              datedServiceJourney: null,
              serviceJourney: { id: "ATB:ServiceJourney:311_7010" },
            }),
          ],
        },
      }),
    ]);

    expect(lineFeatures[0].properties.entityId).toBe(
      "ATB:ServiceJourney:311_7010",
    );
  });

  it("names the span after its line when the feed supplies one", () => {
    const { lineFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [
            journeyWithSpan({
              line: {
                lineRef: "RUT:Line:81",
                lineName: "Grorud",
                publicCode: "81",
              },
            }),
          ],
        },
      }),
    ]);

    expect(lineFeatures[0].properties.name).toBe("Grorud");
  });

  it("emits one feature for a journey listed twice in one situation", () => {
    const { lineFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [journeyWithSpan(), journeyWithSpan()],
        },
      }),
    ]);

    expect(lineFeatures).toHaveLength(1);
  });

  it("emits no line for a journey the API gave no span", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [journeyWithSpan({ affectedPointsOnLink: null })],
        },
      }),
    ]);

    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("emits no line for a span that decodes to fewer than two points", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [
            journeyWithSpan({
              affectedPointsOnLink: { points: "_ic~Fdvca@", length: 0 },
            }),
          ],
        },
      }),
    ]);

    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("still emits the stops of a journey whose span is missing", () => {
    const { pointFeatures, lineFeatures } = buildSituationFeatures([
      makeSituation({
        affects: {
          ...EMPTY,
          vehicleJourneys: [
            journeyWithSpan({
              affectedPointsOnLink: null,
              stops: [affectedStop("NSR:Quay:1", 59.9, 10.7)],
            }),
          ],
        },
      }),
    ]);

    expect(lineFeatures).toEqual([]);
    expect(pointFeatures).toHaveLength(1);
  });
});
