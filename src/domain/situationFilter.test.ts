import { describe, expect, it } from "vitest";
import { makeSituation } from "../__fixtures__/makeSituation.ts";
import { SituationFlag } from "./situationFlags.ts";
import {
  EMPTY_SITUATION_FILTER,
  applySituationFilter,
  facetCounts,
  matchesCodespace,
  selectionWithin,
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
    expect(
      applySituationFilter([A, B], EMPTY_SITUATION_FILTER, FLAGS, null),
    ).toEqual([A, B]);
  });

  it("ORs within a facet", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, severities: ["severe", "normal"] },
      FLAGS,
      null,
    );
    expect(result).toEqual([A, B]);
  });

  it("ANDs across facets", () => {
    const result = applySituationFilter(
      [A, B],
      {
        ...EMPTY_SITUATION_FILTER,
        severities: ["severe"],
        reportTypes: ["GENERAL"],
      },
      FLAGS,
      null,
    );
    expect(result).toEqual([]);
  });

  it("narrows by flag", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, flags: ["staleOpenEnded"] },
      FLAGS,
      null,
    );
    expect(result.map((s) => s.situationNumber)).toEqual(["A"]);
  });

  it("requires every selected flag, not just one", () => {
    const result = applySituationFilter(
      [A, B],
      { ...EMPTY_SITUATION_FILTER, flags: ["staleOpenEnded", "notYetActive"] },
      FLAGS,
      null,
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
      null,
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
      null,
    );
    expect(result).toEqual([]);
  });

  it("matches a situation with an absent value when the '(none)' facet row is selected", () => {
    const noSeverity = makeSituation({
      situationNumber: "C",
      severity: null,
    });
    const result = applySituationFilter(
      [A, noSeverity],
      { ...EMPTY_SITUATION_FILTER, severities: [NONE] },
      new Map([
        ["A", []],
        ["C", []],
      ]),
      null,
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
      null,
    );
    expect(result.map((s) => s.situationNumber)).toEqual(["A", "C"]);
  });

  describe("the map's codespace filter", () => {
    it("keeps only situations belonging to the selected codespace", () => {
      const result = applySituationFilter(
        [A, B],
        EMPTY_SITUATION_FILTER,
        FLAGS,
        "NSB",
      );
      expect(result.map((s) => s.situationNumber)).toEqual(["A"]);
    });

    it("leaves the set untouched when no codespace is selected", () => {
      expect(
        applySituationFilter([A, B], EMPTY_SITUATION_FILTER, FLAGS, null),
      ).toEqual([A, B]);
    });

    it("treats the empty string as no codespace selected", () => {
      expect(
        applySituationFilter([A, B], EMPTY_SITUATION_FILTER, FLAGS, ""),
      ).toEqual([A, B]);
    });

    it("excludes situations whose codespace is absent, rather than treating them as unattributed matches", () => {
      const noCodespace = makeSituation({
        situationNumber: "C",
        codespace: null,
      });
      const result = applySituationFilter(
        [A, noCodespace],
        EMPTY_SITUATION_FILTER,
        new Map([
          ["A", []],
          ["C", []],
        ]),
        "NSB",
      );
      expect(result.map((s) => s.situationNumber)).toEqual(["A"]);
    });

    it("ANDs with the panel's facet filters", () => {
      const result = applySituationFilter(
        [A, B],
        { ...EMPTY_SITUATION_FILTER, severities: ["normal"] },
        FLAGS,
        "NSB",
      );
      expect(result).toEqual([]);
    });
  });
});

describe("facetCounts", () => {
  it("counts flags over the set it is given, including zero-count flags", () => {
    const counts = facetCounts([A, B], [A, B], FLAGS);
    expect(counts.flags).toEqual([
      { value: "noEndTime", count: 1 },
      { value: "staleOpenEnded", count: 1 },
    ]);
  });
});

describe("facetCounts — filterable flags", () => {
  it("does not offer notYetActive as a facet", () => {
    // A situation that has not started yet is still relevant, so the panel
    // should not invite you to slice the list by it. The flag stays on rows
    // and in the detail view as a badge; it just is not a filter.
    const facets = facetCounts([A, B], [A, B], FLAGS);
    expect(facets.flags.map((entry) => entry.value)).not.toContain(
      "notYetActive",
    );
  });

  it("still offers the two quality flags, in order", () => {
    const facets = facetCounts([A, B], [A, B], FLAGS);
    expect(facets.flags.map((entry) => entry.value)).toEqual([
      "noEndTime",
      "staleOpenEnded",
    ]);
  });
});

describe("matchesCodespace", () => {
  it("matches on strict equality", () => {
    expect(matchesCodespace(A, "NSB")).toBe(true);
    expect(matchesCodespace(A, "ATB")).toBe(false);
  });

  it("treats null and the empty string as no codespace selected", () => {
    expect(matchesCodespace(A, null)).toBe(true);
    expect(matchesCodespace(A, "")).toBe(true);
  });

  it("excludes a situation carrying no codespace when one is selected", () => {
    const unattributed = makeSituation({ codespace: null });
    expect(matchesCodespace(unattributed, "NSB")).toBe(false);
    expect(matchesCodespace(unattributed, null)).toBe(true);
  });
});

describe("facetCounts — scoped to a codespace", () => {
  const NSB_ONLY = [A];

  it("counts only the situations in the selected codespace", () => {
    const facets = facetCounts([A, B], NSB_ONLY, FLAGS);
    expect(facets.severities.find((e) => e.value === "severe")?.count).toBe(1);
    expect(facets.severities.find((e) => e.value === "normal")?.count).toBe(0);
  });

  it("keeps a severity the codespace lacks, at zero", () => {
    const facets = facetCounts([A, B], NSB_ONLY, FLAGS);
    expect(facets.severities.map((e) => e.value)).toContain("normal");
  });

  it("scopes the flag counts too", () => {
    const facets = facetCounts([A, B], NSB_ONLY, FLAGS);
    expect(facets.flags).toEqual([
      { value: "noEndTime", count: 1 },
      { value: "staleOpenEnded", count: 1 },
    ]);
  });
});

describe("facetCounts — ordering", () => {
  it("orders severities least to most severe, regardless of count", () => {
    const many = [
      makeSituation({ situationNumber: "1", severity: "severe" }),
      makeSituation({ situationNumber: "2", severity: "normal" }),
      makeSituation({ situationNumber: "3", severity: "normal" }),
      makeSituation({ situationNumber: "4", severity: "normal" }),
      makeSituation({ situationNumber: "5", severity: "noImpact" }),
      makeSituation({ situationNumber: "6", severity: "slight" }),
    ];
    const facets = facetCounts(many, many, new Map());
    expect(facets.severities.map((e) => e.value)).toEqual([
      "noImpact",
      "slight",
      "normal",
      "severe",
    ]);
  });

  it("puts a severity-less situation's (none) bucket last", () => {
    const many = [
      makeSituation({ situationNumber: "1", severity: "severe" }),
      makeSituation({ situationNumber: "2", severity: null }),
    ];
    const facets = facetCounts(many, many, new Map());
    expect(facets.severities.map((e) => e.value)).toEqual(["severe", NONE]);
  });

  it("orders report types alphabetically, regardless of count", () => {
    const many = [
      makeSituation({ situationNumber: "1", reportType: "INCIDENT" }),
      makeSituation({ situationNumber: "2", reportType: "INCIDENT" }),
      makeSituation({ situationNumber: "3", reportType: "GENERAL" }),
    ];
    const facets = facetCounts(many, many, new Map());
    expect(facets.reportTypes.map((e) => e.value)).toEqual([
      "GENERAL",
      "INCIDENT",
    ]);
  });
});

describe("selectionWithin", () => {
  it("keeps a selection that is still in the filtered set", () => {
    expect(selectionWithin("A", [A, B])).toBe("A");
  });

  it("drops a selection the filter no longer includes", () => {
    expect(selectionWithin("A", [B])).toBe(null);
  });

  it("passes through no selection", () => {
    expect(selectionWithin(null, [A, B])).toBe(null);
  });
});
