import { describe, expect, it } from "vitest";
import type { VehicleUpdate } from "../../types.ts";
import { selectedVehicleFrom } from "./vehicleFeature.ts";

const vehicle: VehicleUpdate = {
  vehicleId: "ATB:Vehicle:1",
  codespace: { codespaceId: "ATB" },
  operator: { operatorRef: "ATB:Operator:1", name: "AtB" },
  mode: "BUS",
  line: {
    lineRef: "ATB:Line:3",
    lineName: "3",
    publicCode: "3",
    presentation: { colour: "76A300", textColour: "FFFFFF" },
  },
  delay: 120,
  location: { latitude: 63.43, longitude: 10.4 },
  serviceJourney: { id: "ATB:ServiceJourney:1", date: "2026-10-05" },
  lastUpdated: "2026-10-05T12:00:00Z",
  occupancyStatus: "noData",
  bearing: -90,
  destinationName: "Hallset",
};

describe("selectedVehicleFrom", () => {
  it("is the selection a click on the vehicle makes", () => {
    const selected = selectedVehicleFrom(vehicle);
    expect(selected.coordinates).toEqual([10.4, 63.43]);
    expect(selected.properties).toMatchObject({
      id: "ATB:Vehicle:1",
      mode: "BUS",
      lineCode: "3",
      codespaceId: "ATB",
      delay: 120,
      followed: false,
      serviceJourneyId: "ATB:ServiceJourney:1",
      date: "2026-10-05",
      bearing: 270,
    });
    expect(selected.properties.lineTextColour).not.toBeNull();
    expect(selected.properties.lineHaloColour).not.toBeNull();
  });
});
