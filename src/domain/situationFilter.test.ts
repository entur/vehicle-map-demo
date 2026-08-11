import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { SituationFlag } from "./situationFlags.ts";
import {
  EMPTY_SITUATION_FILTER,
  applySituationFilter,
  facetCounts,
} from "./situationFilter.ts";

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

  it("excludes a situation whose facet value is absent when that facet is constrained", () => {
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
