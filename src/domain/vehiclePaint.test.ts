import { describe, expect, it } from "vitest";
import { VehicleUpdate } from "../types.ts";
import { bodyColourFor } from "./vehicleMeshes.ts";
import { hexToRgb, paintFor } from "./vehiclePaint.ts";

function vehicle(
  mode: VehicleUpdate["mode"],
  presentation?: VehicleUpdate["line"]["presentation"],
): Pick<VehicleUpdate, "mode" | "line"> {
  return {
    mode,
    line: { lineRef: "X:Line:1", lineName: "1", publicCode: "1", presentation },
  };
}

describe("hexToRgb", () => {
  it("reads six hex digits, as the API publishes them", () => {
    expect(hexToRgb("76A300")).toEqual([0x76, 0xa3, 0x00]);
    expect(hexToRgb("df2027")).toEqual([0xdf, 0x20, 0x27]);
  });

  it("tolerates a leading #", () => {
    expect(hexToRgb("#00685E")).toEqual([0x00, 0x68, 0x5e]);
  });

  it("rejects anything that is not a six-digit colour", () => {
    for (const value of ["", "FFF", "GGGGGG", "76A3000", null, undefined]) {
      expect(hexToRgb(value)).toBeNull();
    }
  });
});

describe("paintFor", () => {
  it("paints a vehicle in its line's colour when the line publishes one", () => {
    expect(
      paintFor(vehicle("RAIL", { colour: "DF2027", textColour: "FFFFFF" })),
    ).toEqual([0xdf, 0x20, 0x27]);
  });

  // Shown as delivered, like everything else in this tool: AKT's black is
  // what the feed says, so it is what the model shows.
  it("uses a published black as-is rather than treating it as missing", () => {
    expect(
      paintFor(vehicle("BUS", { colour: "000000", textColour: "FFFF00" })),
    ).toEqual([0, 0, 0]);
  });

  it("falls back to the mode colour when the line has no colour", () => {
    expect(paintFor(vehicle("BUS", null))).toEqual(bodyColourFor("BUS"));
    expect(paintFor(vehicle("BUS"))).toEqual(bodyColourFor("BUS"));
    expect(
      paintFor(vehicle("TRAM", { colour: null, textColour: null })),
    ).toEqual(bodyColourFor("TRAM"));
  });

  it("falls back to the mode colour when the published colour is malformed", () => {
    expect(
      paintFor(vehicle("FERRY", { colour: "blue", textColour: null })),
    ).toEqual(bodyColourFor("FERRY"));
  });
});
