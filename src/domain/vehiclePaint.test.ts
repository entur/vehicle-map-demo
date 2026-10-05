import { describe, expect, it } from "vitest";
import { VehicleUpdate } from "../types.ts";
import { DEFAULT_SIGN_COLOUR, bodyColourFor } from "./vehicleMeshes.ts";
import {
  hexToRgb,
  labelColoursFor,
  paintFor,
  signColourFor,
} from "./vehiclePaint.ts";

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

describe("signColourFor", () => {
  it("lights a sign in the line's published text colour", () => {
    expect(
      signColourFor(vehicle("BUS", { colour: "000000", textColour: "FFFF00" })),
    ).toEqual([0xff, 0xff, 0x00]);
  });

  it("falls back to the default sign colour when the line has no text colour", () => {
    expect(signColourFor(vehicle("BUS", null))).toEqual(DEFAULT_SIGN_COLOUR);
    expect(
      signColourFor(vehicle("BUS", { colour: "000000", textColour: "yellow" })),
    ).toEqual(DEFAULT_SIGN_COLOUR);
  });
});

describe("labelColoursFor", () => {
  it("sets the line code in the text colour over the line colour", () => {
    expect(
      labelColoursFor(
        vehicle("BUS", { colour: "000000", textColour: "FFFF00" }).line,
      ),
    ).toEqual({ text: "#ffff00", halo: "#000000" });
  });

  it("normalises a leading # and letter case", () => {
    expect(
      labelColoursFor(
        vehicle("RAIL", { colour: "#DF2027", textColour: "#FFFFFF" }).line,
      ),
    ).toEqual({ text: "#ffffff", halo: "#df2027" });
  });

  // The two are published as a pair — text colour is only legible against its
  // own background — so half a pair would put, say, black text on a dark halo.
  it("uses neither colour unless both are usable", () => {
    for (const presentation of [
      null,
      undefined,
      { colour: "000000", textColour: null },
      { colour: null, textColour: "FFFF00" },
      { colour: "000000", textColour: "yellow" },
    ]) {
      expect(labelColoursFor(vehicle("BUS", presentation).line)).toBeNull();
    }
  });
});
