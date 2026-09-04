import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import fixture from "../__fixtures__/situations.json";
import { NationalSituation } from "../types.ts";
import {
  buildSituationFeatures,
  collectDatedServiceJourneyRefs,
  collectLineRefs,
} from "./situationFeatures.ts";

const NO_GEOMETRY = new Map<string, number[][]>();

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
          lines: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:2", 61, 11)],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    const { pointFeatures, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );

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
          lines: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:1", 60, 10)],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    expect(
      buildSituationFeatures(situations, NO_GEOMETRY).pointFeatures,
    ).toHaveLength(1);
  });

  it("keeps coincident features from different situations", () => {
    const affects = {
      vehicleModes: null,
      lines: null,
      stopPoints: [stop("NSR:Quay:1", 60, 10)],
      stopPlaces: null,
      serviceJourneys: null,
      datedServiceJourneys: null,
      operators: null,
      vehicleJourneys: null,
      affectedLines: null,
    };
    const situations = [
      makeSituation({ situationNumber: "A", affects }),
      makeSituation({ situationNumber: "B", affects }),
    ];

    const { pointFeatures } = buildSituationFeatures(situations, NO_GEOMETRY);
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
          lines: null,
          stopPoints: [{ id: "NSR:Quay:9", name: "Nowhere", location: null }],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    const { pointFeatures, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    expect(pointFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("builds a line feature from cached geometry", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: [
            { lineRef: "SKY:Line:3", lineName: "Three", publicCode: "3" },
          ],
          stopPoints: null,
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];
    const geometry = new Map([
      [
        "SKY:Line:3",
        [
          [10, 60],
          [11, 61],
        ],
      ],
    ]);

    const { lineFeatures, unmappable } = buildSituationFeatures(
      situations,
      geometry,
    );

    expect(lineFeatures).toHaveLength(1);
    expect(lineFeatures[0].geometry.coordinates).toEqual([
      [10, 60],
      [11, 61],
    ]);
    expect(lineFeatures[0].properties.entityId).toBe("SKY:Line:3");
    expect(unmappable).toEqual([]);
  });

  it("reports a line with no cached geometry as unmappable", () => {
    const situations = [
      makeSituation({
        affects: {
          vehicleModes: null,
          lines: [
            { lineRef: "SKY:Line:3", lineName: "Three", publicCode: "3" },
          ],
          stopPoints: null,
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
    ];

    const { lineFeatures, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("reports a situation with no affects at all as unmappable", () => {
    const { unmappable } = buildSituationFeatures(
      [makeSituation({ affects: null })],
      NO_GEOMETRY,
    );
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });

  it("counts features per situation", () => {
    const situations = [
      makeSituation({
        situationNumber: "A",
        affects: {
          vehicleModes: null,
          lines: null,
          stopPoints: [stop("NSR:Quay:1", 60, 10), stop("NSR:Quay:2", 61, 11)],
          stopPlaces: null,
          serviceJourneys: null,
          datedServiceJourneys: null,
          operators: null,
          vehicleJourneys: null,
          affectedLines: null,
        },
      }),
      makeSituation({ situationNumber: "B", affects: null }),
    ];

    const { featureCountBySituation } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
    expect(featureCountBySituation.get("A")).toBe(2);
    expect(featureCountBySituation.get("B")).toBe(0);
  });
});

describe("collectLineRefs", () => {
  it("returns each affected line ref once", () => {
    const line = (lineRef: string) => ({
      lineRef,
      lineName: lineRef,
      publicCode: "x",
    });
    const affects = (lines: ReturnType<typeof line>[]) => ({
      vehicleModes: null,
      lines,
      stopPoints: null,
      stopPlaces: null,
      serviceJourneys: null,
      datedServiceJourneys: null,
      operators: null,
      vehicleJourneys: null,
      affectedLines: null,
    });

    const refs = collectLineRefs([
      makeSituation({
        situationNumber: "A",
        affects: affects([line("L:1"), line("L:2")]),
      }),
      makeSituation({ situationNumber: "B", affects: affects([line("L:2")]) }),
    ]);

    expect(refs).toEqual(["L:1", "L:2"]);
  });
});

describe("against the captured dev fixture", () => {
  const situations = (fixture as { situations: NationalSituation[] })
    .situations;

  it("captured a usable spread of situations", () => {
    expect(situations.length).toBeGreaterThan(5);
  });

  it("accounts for every situation as either mapped or unmappable", () => {
    const { featureCountBySituation, unmappable } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );

    for (const situation of situations) {
      const count = featureCountBySituation.get(situation.situationNumber) ?? 0;
      expect(count === 0).toBe(unmappable.includes(situation.situationNumber));
    }
  });

  it("never emits a feature with a non-finite coordinate", () => {
    const { pointFeatures, lineFeatures } = buildSituationFeatures(
      situations,
      NO_GEOMETRY,
    );
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

describe("collectDatedServiceJourneyRefs", () => {
  it("returns each affected dated service journey id once, in first-seen order", () => {
    const affects = (ids: string[]) => ({
      vehicleModes: null,
      lines: null,
      stopPoints: null,
      stopPlaces: null,
      serviceJourneys: null,
      datedServiceJourneys: ids.map((id) => ({ id })),
      operators: null,
      vehicleJourneys: null,
      affectedLines: null,
    });
    const refs = collectDatedServiceJourneyRefs([
      makeSituation({
        affects: affects(["VYG:DatedServiceJourney:1", "ATB:ServiceJourney:2"]),
      }),
      makeSituation({ affects: affects(["ATB:ServiceJourney:2"]) }),
      makeSituation({ affects: null }),
    ]);
    expect(refs).toEqual(["VYG:DatedServiceJourney:1", "ATB:ServiceJourney:2"]);
  });
});

const EMPTY = {
  vehicleModes: null,
  lines: null,
  stopPoints: null,
  stopPlaces: null,
  serviceJourneys: null,
  datedServiceJourneys: null,
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
    const { pointFeatures, unmappable } = buildSituationFeatures(
      [
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
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(2);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
    expect(pointFeatures[0].properties.entityId).toBe("NSR:Quay:1");
    expect(pointFeatures[0].geometry.coordinates).toEqual([10.7, 59.9]);
    expect(unmappable).toEqual([]);
  });

  it("builds a point per located stop of an affected line", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
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
      ],
      NO_GEOMETRY,
    );

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

    const { pointFeatures } = buildSituationFeatures(
      [
        makeSituation({
          affects: {
            ...EMPTY,
            vehicleJourneys: [journey("A"), journey("B"), journey("C")],
          },
        }),
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
  });

  it("draws one dot for a stop reached as both a journey stop and a line stop", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
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
      ],
      NO_GEOMETRY,
    );

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

    const { pointFeatures } = buildSituationFeatures(
      [one("TST:SituationNumber:1"), one("TST:SituationNumber:2")],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(2);
  });

  it("draws a stop that is unlocated in one source and located in another", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
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
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
  });

  it("draws a stop that is unlocated in one source and located in another", () => {
    const { pointFeatures } = buildSituationFeatures(
      [
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
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toHaveLength(1);
    expect(pointFeatures[0].properties.source).toBe("journeyStop");
  });

  it("skips a stop the API could not locate, and reports the situation unmappable", () => {
    const { pointFeatures, unmappable } = buildSituationFeatures(
      [
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
      ],
      NO_GEOMETRY,
    );

    expect(pointFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });
});

describe("dated service journey features", () => {
  const situation = makeSituation({
    affects: {
      vehicleModes: null,
      lines: null,
      stopPoints: null,
      stopPlaces: null,
      serviceJourneys: null,
      datedServiceJourneys: [
        { id: "ATB:ServiceJourney:311_7010" },
        { id: "ATB:ServiceJourney:311_7010" },
      ],
      operators: null,
      vehicleJourneys: null,
      affectedLines: null,
    },
  });

  it("builds one line feature from the journey's cached geometry", () => {
    const journeyGeometry = new Map([
      [
        "ATB:ServiceJourney:311_7010",
        [
          [10, 63],
          [10.5, 63.4],
        ],
      ],
    ]);

    const { lineFeatures, unmappable } = buildSituationFeatures(
      [situation],
      NO_GEOMETRY,
      journeyGeometry,
    );

    expect(lineFeatures).toHaveLength(1);
    expect(lineFeatures[0].properties.source).toBe("datedServiceJourney");
    expect(lineFeatures[0].properties.entityId).toBe(
      "ATB:ServiceJourney:311_7010",
    );
    expect(lineFeatures[0].geometry.coordinates).toEqual([
      [10, 63],
      [10.5, 63.4],
    ]);
    expect(unmappable).toEqual([]);
  });

  it("reports a journey with no cached geometry as unmappable", () => {
    const { lineFeatures, unmappable } = buildSituationFeatures(
      [situation],
      NO_GEOMETRY,
      NO_GEOMETRY,
    );
    expect(lineFeatures).toEqual([]);
    expect(unmappable).toEqual(["TST:SituationNumber:1"]);
  });
});
