import { expression } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import {
  dimmedUnlessSelected,
  selectedSituationFilter,
} from "./situationSelection.ts";

/** Evaluates a style expression against a feature carrying `situationNumber`. */
function evaluate(expr: unknown, situationNumber: string): unknown {
  const parsed = expression.createExpression(expr);
  if (parsed.result !== "success") {
    throw new Error(parsed.value.map((e) => e.message).join("; "));
  }
  return parsed.value.evaluate(
    { zoom: 10 },
    { type: "Point", properties: { situationNumber } },
  );
}

describe("selectedSituationFilter", () => {
  it("matches only features of the selected situation", () => {
    const filter = selectedSituationFilter("A");
    expect(evaluate(filter, "A")).toBe(true);
    expect(evaluate(filter, "B")).toBe(false);
  });

  it("matches nothing when no situation is selected", () => {
    const filter = selectedSituationFilter(null);
    expect(evaluate(filter, "A")).toBe(false);
  });
});

describe("dimmedUnlessSelected", () => {
  it("keeps the full opacity for the selected situation and dims the rest", () => {
    const opacity = dimmedUnlessSelected("A", 0.85, 0.25);
    expect(evaluate(opacity, "A")).toBe(0.85);
    expect(evaluate(opacity, "B")).toBe(0.25);
  });

  it("keeps the full opacity for everything when nothing is selected", () => {
    const opacity = dimmedUnlessSelected(null, 0.85, 0.25);
    expect(evaluate(opacity, "A")).toBe(0.85);
    expect(evaluate(opacity, "B")).toBe(0.85);
  });
});
