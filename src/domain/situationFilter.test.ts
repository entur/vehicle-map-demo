import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { SituationFlag } from "./situationFlags.ts";
import {
  EMPTY_SITUATION_FILTER,
  applySituationFilter,
  facetCounts,
} from "./situationFilter.ts";
import { NONE } from "./situationStats.ts";

const A = makeSituation({
  situationNumber: "A",
  severity: "severe",
  reportType: "INCIDENT",
  codespace: { codespaceId: "NSB" },
});
const B = makeSituation({
  situationNumber: "B",
  severity: "normal",
  reportType: "GENERAL",
  codespace: { codespaceId: "ATB" },
});

const FLAGS = new Map<string, SituationFlag[]>([
  ["A", ["noEndTime", "staleOpenEnded"]],
  ["B", []],
]);

describe("applySituationFilter", () => {
  it("returns everything when no facet is constrained", () => {
    expect(applySituationFilter([A, B], EMPTY_SITUATION_FILTER, FLAGS)).toEqual(
      [A, B],
    );
  });

  it("ORs within a facet", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, severities: ["severe", "normal"] },
      FLAGS,
    );
    expect(result).toEqual([A, B]);
  });

  it("ANDs across facets", () => {
    const result = applySituationFilter(
      [A, B],
      {
        ...EMPTY_SITUATION_FILTER,
        severities: ["severe"],
        codespaces: ["ATB"],
      },
      FLAGS,
    );
    expect(result).toEqual([]);
  });

  it("narrows by flag", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, flags: ["staleOpenEnded"] },
      FLAGS,
    );
    expect(result.map((s) => s.situationNumber)).toEqual(["A"]);
  });

  it("requires every selected flag, not just one", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, flags: ["staleOpenEnded", "notYetActive"] },
      FLAGS,
    );
    expect(result).toEqual([]);
  });

  it("excludes a situation whose codespace is absent when that facet is constrained to a real value", () => {
    const noCodespace = makeSituation({
      situationNumber: "C",
      codespace: null,
    });
    const result = applySituationFilter(
      [noCodespace],
      { ...EMPTY_SITUATION_FILTER, codespaces: ["NSB"] },
      new Map([["C", []]]),
    );
    expect(result).toEqual([]);
  });

  it("excludes a situation whose severity is absent when that facet is constrained to a real value", () => {
    const noSeverity = makeSituation({
      situationNumber: "C",
      severity: null,
    });
    const result = applySituationFilter(
      [noSeverity],
      { ...EMPTY_SITUATION_FILTER, severities: ["severe"] },
      new Map([["C", []]]),
    );
    expect(result).toEqual([]);
  });

  it("excludes a situation whose reportType is absent when that facet is constrained to a real value", () => {
    const noReportType = makeSituation({
      situationNumber: "C",
      reportType: null,
    });
    const result = applySituationFilter(
      [noReportType],
      { ...EMPTY_SITUATION_FILTER, reportTypes: ["INCIDENT"] },
      new Map([["C", []]]),
    );
    expect(result).toEqual([]);
  });

  it("matches a situation with an absent value when the '(none)' facet row is selected", () => {
    const noCodespace = makeSituation({
      situationNumber: "C",
      codespace: null,
    });
    const result = applySituationFilter(
      [A, noCodespace],
      { ...EMPTY_SITUATION_FILTER, codespaces: [NONE] },
      new Map([
        ["A", []],
        ["C", []],
      ]),
    );
    expect(result.map((s) => s.situationNumber)).toEqual(["C"]);
  });

  it("'(none)' and a real value OR together within the same facet", () => {
    const noSeverity = makeSituation({
      situationNumber: "C",
      severity: null,
    });
    const result = applySituationFilter(
      [A, B, noSeverity],
      { ...EMPTY_SITUATION_FILTER, severities: ["severe", NONE] },
      new Map([
        ["A", []],
        ["B", []],
        ["C", []],
      ]),
    );
    expect(result.map((s) => s.situationNumber)).toEqual(["A", "C"]);
  });
});

describe("facetCounts", () => {
  it("counts flags over the set it is given, including zero-count flags", () => {
    const counts = facetCounts([A, B], FLAGS);
    expect(counts.flags).toEqual([
      { value: "noEndTime", count: 1 },
      { value: "staleOpenEnded", count: 1 },
      { value: "notYetActive", count: 0 },
    ]);
    expect(counts.codespaces).toEqual([
      { value: "ATB", count: 1 },
      { value: "NSB", count: 1 },
    ]);
  });
});
