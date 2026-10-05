import { describe, expect, it } from "vitest";
import { signGroups, signTextFor } from "./destinationSign.ts";
import { DEFAULT_SIGN_COLOUR } from "./vehicleMeshes.ts";

const vehicle = (destinationName: string | null, textColour?: string) => ({
  destinationName,
  line: {
    lineRef: "RUT:Line:1",
    lineName: "",
    publicCode: "1",
    presentation: textColour ? { colour: "000000", textColour } : undefined,
  },
});

describe("signTextFor", () => {
  it("shows the destination as published, only trimmed", () => {
    expect(signTextFor(vehicle("  Jernbanetorget "))).toBe("Jernbanetorget");
  });

  it("leaves the sign blank when there is no destination", () => {
    expect(signTextFor(vehicle(null))).toBe("");
  });
});

describe("signGroups", () => {
  it("groups vehicles by text and sign colour, in order of first appearance", () => {
    const a = vehicle("Ullevål");
    const b = vehicle("Kolsås");
    const c = vehicle("Ullevål");
    const d = vehicle("Ullevål", "FFFF00");
    const groups = signGroups([a, b, c, d]);
    expect(groups.map((g) => [g.text, g.colour, g.vehicles])).toEqual([
      ["Ullevål", DEFAULT_SIGN_COLOUR, [a, c]],
      ["Kolsås", DEFAULT_SIGN_COLOUR, [b]],
      ["Ullevål", [255, 255, 0], [d]],
    ]);
  });

  it("gives each group a distinct key that is stable from frame to frame", () => {
    const first = signGroups([
      vehicle("A"),
      vehicle("B"),
      vehicle("A", "FFFF00"),
    ]);
    const again = signGroups([
      vehicle("A"),
      vehicle("B"),
      vehicle("A", "FFFF00"),
    ]);
    const keys = first.map((g) => g.key);
    expect(new Set(keys).size).toBe(3);
    expect(again.map((g) => g.key)).toEqual(keys);
  });
});
