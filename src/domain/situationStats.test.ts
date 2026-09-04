import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import {
  affectsShape,
  countBy,
  countByWithin,
  situationStats,
} from "./situationStats.ts";

const EMPTY_AFFECTS = {
  vehicleModes: null,
  stopPoints: null,
  stopPlaces: null,
  operators: null,
  vehicleJourneys: null,
  affectedLines: null,
};

describe("countBy", () => {
  it("sorts by descending count", () => {
    expect(countBy(["a", "b", "a", "c", "a", "b"], (v) => v)).toEqual([
      { value: "a", count: 3 },
      { value: "b", count: 2 },
      { value: "c", count: 1 },
    ]);
  });

  it("buckets null into an explicit (none), so the table reconciles with the total", () => {
    expect(countBy([1, 2], () => null)).toEqual([
      { value: "(none)", count: 2 },
    ]);
  });

  it("breaks count ties alphabetically so the order is stable", () => {
    expect(countBy(["b", "a"], (v) => v)).toEqual([
      { value: "a", count: 1 },
      { value: "b", count: 1 },
    ]);
  });
});

describe("affectsShape", () => {
  it("names the single populated kind", () => {
    expect(
      affectsShape(
        makeSituation({
          affects: {
            ...EMPTY_AFFECTS,
            vehicleJourneys: [
              {
                serviceJourney: null,
                datedServiceJourney: { id: "x" },
                line: null,
                operator: null,
                stops: null,
                affectedPointsOnLink: null,
              },
            ],
          },
        }),
      ),
    ).toBe("vehicleJourneys");
  });

  it("joins several populated kinds in a fixed order", () => {
    expect(
      affectsShape(
        makeSituation({
          affects: {
            ...EMPTY_AFFECTS,
            operators: [{ operatorRef: "RUT:Operator:1", name: "Ruter" }],
            affectedLines: [
              {
                line: { lineRef: "L:1", lineName: "One", publicCode: "1" },
                stops: null,
              },
            ],
          },
        }),
      ),
    ).toBe("affectedLines+operators");
  });

  it("calls a null affects (empty)", () => {
    expect(affectsShape(makeSituation({ affects: null }))).toBe("(empty)");
  });

  it("calls an affects with only empty arrays (empty)", () => {
    expect(affectsShape(makeSituation({ affects: { ...EMPTY_AFFECTS } }))).toBe(
      "(empty)",
    );
  });
});

describe("situationStats", () => {
  it("counts severity, report type, codespace and language tagging", () => {
    const stats = situationStats([
      makeSituation({
        situationNumber: "A",
        severity: "undefined",
        reportType: "INCIDENT",
        codespace: { codespaceId: "NSB" },
        summary: [{ value: "s", language: null }],
      }),
      makeSituation({
        situationNumber: "B",
        severity: "normal",
        reportType: "GENERAL",
        codespace: { codespaceId: "NSB" },
        summary: [
          { value: "s", language: "NO" },
          { value: "s", language: "EN" },
        ],
      }),
    ]);

    expect(stats.byCodespace).toEqual([{ value: "NSB", count: 2 }]);
    expect(stats.bySeverity).toEqual([
      { value: "normal", count: 1 },
      { value: "undefined", count: 1 },
    ]);
    expect(stats.byReportType).toEqual([
      { value: "GENERAL", count: 1 },
      { value: "INCIDENT", count: 1 },
    ]);
    expect(stats.summaryLanguages).toEqual([
      { value: "EN+NO", count: 1 },
      { value: "untagged", count: 1 },
    ]);
  });
});

describe("countByWithin", () => {
  const all = [
    { kind: "a" },
    { kind: "a" },
    { kind: "b" },
    { kind: "c" },
    { kind: null },
  ];

  it("counts over the subset, not the whole set", () => {
    const subset = [{ kind: "a" }, { kind: "b" }];
    const counts = countByWithin(all, subset, (item) => item.kind);
    expect(counts.find((entry) => entry.value === "a")?.count).toBe(1);
  });

  it("keeps a value the subset lacks, at zero", () => {
    // The absence is the signal: "this codespace publishes nothing severe" is
    // worth seeing, and a vanishing chip hides it.
    const subset = [{ kind: "a" }];
    const counts = countByWithin(all, subset, (item) => item.kind);
    expect(counts.find((entry) => entry.value === "c")).toEqual({
      value: "c",
      count: 0,
    });
  });

  it("offers exactly the values present in the whole set", () => {
    const subset = [{ kind: "a" }];
    const counts = countByWithin(all, subset, (item) => item.kind);
    expect(counts.map((entry) => entry.value).sort()).toEqual([
      "(none)",
      "a",
      "b",
      "c",
    ]);
  });

  it("never invents a value the whole set does not have", () => {
    const subset = [{ kind: "zzz" }];
    const counts = countByWithin(all, subset, (item) => item.kind);
    expect(counts.map((entry) => entry.value)).not.toContain("zzz");
  });

  it("puts (none) last", () => {
    const counts = countByWithin(all, all, (item) => item.kind);
    expect(counts[counts.length - 1].value).toBe("(none)");
  });

  it("orders by the supplied comparator, not by count", () => {
    const subset = all;
    const counts = countByWithin(
      all,
      subset,
      (item) => item.kind,
      (x, y) => y.localeCompare(x),
    );
    expect(counts.map((entry) => entry.value)).toEqual([
      "c",
      "b",
      "a",
      "(none)",
    ]);
  });
});
