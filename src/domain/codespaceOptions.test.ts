import { describe, expect, it } from "vitest";
import { NONE } from "./situationStats.ts";
import { codespaceOptions } from "./codespaceOptions.ts";

const AVAILABLE = [
  { value: "RUT", count: 399 },
  { value: "ATB", count: 74 },
  { value: NONE, count: 12 },
];

describe("codespaceOptions", () => {
  it("drops the (none) bucket", () => {
    // `matchesCodespace` is a strict equality check against a real id, so a
    // "(none)" option would be selectable and match nothing.
    const options = codespaceOptions(AVAILABLE, null);
    expect(options.map((o) => o.value)).not.toContain(NONE);
  });

  it("keeps each codespace with its count", () => {
    const options = codespaceOptions(AVAILABLE, null);
    expect(options).toContainEqual({ value: "RUT", count: 399 });
  });

  it("orders alphabetically, not by count", () => {
    const options = codespaceOptions(AVAILABLE, null);
    expect(options.map((o) => o.value)).toEqual(["ATB", "RUT"]);
  });

  it("injects a selection the list does not offer", () => {
    // Codespace persists across a mode switch, so a situations-only codespace
    // can still be selected when the vehicles list is showing. Dropping it
    // would leave the Select holding a value with no matching item.
    const options = codespaceOptions(AVAILABLE, "NSB");
    expect(options.map((o) => o.value)).toEqual(["ATB", "NSB", "RUT"]);
  });

  it("gives an injected selection no count rather than a wrong one", () => {
    const options = codespaceOptions(AVAILABLE, "NSB");
    expect(options.find((o) => o.value === "NSB")).toEqual({
      value: "NSB",
      count: null,
    });
  });

  it("does not duplicate a selection the list already offers", () => {
    const options = codespaceOptions(AVAILABLE, "ATB");
    expect(options.filter((o) => o.value === "ATB")).toHaveLength(1);
    expect(options.find((o) => o.value === "ATB")?.count).toBe(74);
  });

  it("treats an empty selection as no selection", () => {
    expect(codespaceOptions(AVAILABLE, "").map((o) => o.value)).toEqual([
      "ATB",
      "RUT",
    ]);
  });

  it("never injects the (none) label even if it is somehow selected", () => {
    expect(codespaceOptions(AVAILABLE, NONE).map((o) => o.value)).toEqual([
      "ATB",
      "RUT",
    ]);
  });
});
