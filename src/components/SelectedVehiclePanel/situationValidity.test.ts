import { describe, expect, test } from "vitest";
import { Situation, ValidityPeriod } from "../../types.ts";
import { formatValidity } from "./situationValidity.ts";

function situation(validityPeriods: ValidityPeriod[]): Situation {
  return {
    situationNumber: "TEST:1",
    version: null,
    severity: null,
    reportType: null,
    summary: [],
    description: [],
    advice: [],
    validityPeriods,
    infoLinks: [],
  };
}

function period(overrides: Partial<ValidityPeriod>): ValidityPeriod {
  return { startTime: null, endTime: null, ...overrides };
}

describe("formatValidity", () => {
  test("returns null when there are no validity periods at all", () => {
    expect(
      formatValidity({ ...situation([]), validityPeriods: [] }),
    ).toBeNull();
  });

  test("returns null for an empty validityPeriods array", () => {
    expect(formatValidity(situation([]))).toBeNull();
  });

  test("skips a period with no startTime", () => {
    expect(
      formatValidity(
        situation([
          period({ startTime: null, endTime: "2026-08-06T10:00:00+02:00" }),
        ]),
      ),
    ).toBeNull();
  });

  // toLocaleString output depends on the machine's locale/timezone, so these
  // assertions check structure (wording, separator, verbatim passthrough of
  // unparseable input) rather than a hardcoded formatted string that would
  // only match on the machine that wrote it.
  test("renders an open-ended period when only startTime is set", () => {
    const [line] = formatValidity(
      situation([
        period({ startTime: "2026-08-06T10:00:00+02:00", endTime: null }),
      ]),
    )!;
    expect(line).toContain("open ended");
    expect(line).toContain("–");
  });

  test("renders a start–end period when both are set", () => {
    const [line] = formatValidity(
      situation([
        period({
          startTime: "2026-08-06T10:00:00+02:00",
          endTime: "2026-08-06T12:00:00+02:00",
        }),
      ]),
    )!;
    expect(line).not.toContain("open ended");
    expect(line.split("–")).toHaveLength(2);
  });

  test("passes an unparseable startTime through verbatim rather than 'Invalid Date'", () => {
    const [line] = formatValidity(
      situation([period({ startTime: "not-a-date", endTime: null })]),
    )!;
    expect(line).toContain("not-a-date");
    expect(line).not.toContain("Invalid Date");
  });

  test("renders one line per validity period, in order", () => {
    const lines = formatValidity(
      situation([
        period({
          startTime: "2026-08-06T10:00:00+02:00",
          endTime: "2026-08-06T12:00:00+02:00",
        }),
        period({ startTime: "2026-08-07T08:00:00+02:00", endTime: null }),
      ]),
    )!;
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toContain("open ended");
    expect(lines[1]).toContain("open ended");
  });

  test("skips periods with no startTime while keeping the ones that have it", () => {
    const lines = formatValidity(
      situation([
        period({ startTime: null, endTime: "2026-08-06T12:00:00+02:00" }),
        period({ startTime: "2026-08-07T08:00:00+02:00", endTime: null }),
      ]),
    )!;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("open ended");
  });
});
