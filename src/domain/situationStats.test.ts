import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { affectsShape, countBy, situationStats } from "./situationStats.ts";

const EMPTY_AFFECTS = {
  vehicleModes: null,
  lines: null,
  stopPoints: null,
  stopPlaces: null,
  serviceJourneys: null,
  datedServiceJourneys: null,
  operators: null,
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
          affects: { ...EMPTY_AFFECTS, datedServiceJourneys: [{ id: "x" }] },
        }),
      ),
    ).toBe("datedServiceJourneys");
  });

  it("joins several populated kinds in a fixed order", () => {
    expect(
      affectsShape(
        makeSituation({
          affects: {
            ...EMPTY_AFFECTS,
            serviceJourneys: [{ id: "s", date: "2026-08-10" }],
            lines: [{ lineRef: "L:1", lineName: "One", publicCode: "1" }],
          },
        }),
      ),
    ).toBe("lines+serviceJourneys");
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
