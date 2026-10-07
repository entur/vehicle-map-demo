import { expression } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { selectedVehicleFilter } from "./vehicleSelection.ts";

/** Evaluates a style expression against a vehicle feature's two keys. */
function evaluate(
  expr: unknown,
  id: string,
  serviceJourneyId: string,
): unknown {
  const parsed = expression.createExpression(expr, "test");
  if (parsed.result !== "success") {
    throw new Error(parsed.value.map((e) => e.message).join("; "));
  }
  return parsed.value.evaluate(
    { zoom: 14 },
    { type: "Point", properties: { id, serviceJourneyId } },
  );
}

describe("selectedVehicleFilter", () => {
  it("matches only the selected vehicle on the selected journey", () => {
    const filter = selectedVehicleFilter({
      vehicleId: "V1",
      serviceJourneyId: "J1",
    });
    expect(evaluate(filter, "V1", "J1")).toBe(true);
    expect(evaluate(filter, "V2", "J1")).toBe(false);
  });

  it("does not match the same vehicle on another journey", () => {
    const filter = selectedVehicleFilter({
      vehicleId: "V1",
      serviceJourneyId: "J1",
    });
    expect(evaluate(filter, "V1", "J2")).toBe(false);
  });

  it("matches nothing when no vehicle is selected", () => {
    expect(evaluate(selectedVehicleFilter(null), "V1", "J1")).toBe(false);
  });
});
