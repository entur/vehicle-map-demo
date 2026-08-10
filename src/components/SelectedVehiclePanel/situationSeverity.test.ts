import { describe, expect, test } from "vitest";
import { SeverityEnumeration } from "../../types.ts";
import { severityColour, worstSeverity } from "./situationSeverity.ts";

const RED = "#c0392b";
const ORANGE = "#e07a1f";
const GREY = "#999999";

function s(severity: SeverityEnumeration | null) {
  return { severity };
}

describe("severityColour", () => {
  test("uses red for severe and verySevere", () => {
    expect(severityColour("severe")).toBe(RED);
    expect(severityColour("verySevere")).toBe(RED);
  });

  test("uses orange for the ordinary severities", () => {
    expect(severityColour("normal")).toBe(ORANGE);
    expect(severityColour("slight")).toBe(ORANGE);
    expect(severityColour("verySlight")).toBe(ORANGE);
  });

  // "undefined" is the most common value in live data (276 of 376 sampled) and
  // those are real incident messages, so it must not be greyed out.
  test("uses orange, not grey, for undefined and unknown", () => {
    expect(severityColour("undefined")).toBe(ORANGE);
    expect(severityColour("unknown")).toBe(ORANGE);
    expect(severityColour(null)).toBe(ORANGE);
    expect(severityColour(undefined)).toBe(ORANGE);
  });

  test("greys out only noImpact", () => {
    expect(severityColour("noImpact")).toBe(GREY);
  });
});

describe("worstSeverity", () => {
  test("returns the most serious severity in the list", () => {
    expect(worstSeverity([s("normal"), s("severe"), s("noImpact")])).toBe(
      "severe",
    );
  });

  test("ranks verySevere above severe", () => {
    expect(worstSeverity([s("severe"), s("verySevere")])).toBe("verySevere");
  });

  test("ranks normal above an unrated entry", () => {
    expect(worstSeverity([s("undefined"), s("normal")])).toBe("normal");
  });

  test("ranks noImpact lowest", () => {
    expect(worstSeverity([s("noImpact"), s("undefined")])).toBe("undefined");
  });

  test("ranks an absent severity above noImpact", () => {
    expect(worstSeverity([s("noImpact"), s(null)])).toBeNull();
    expect(worstSeverity([s("noImpact")])).toBe("noImpact");
  });

  test("returns null for an empty list", () => {
    expect(worstSeverity([])).toBeNull();
  });
});
