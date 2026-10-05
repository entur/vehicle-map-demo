import { describe, expect, it } from "vitest";
import { nextColorSchemeMode } from "./colorSchemeMode.ts";

describe("nextColorSchemeMode", () => {
  it("cycles system, light, dark", () => {
    expect(nextColorSchemeMode("system")).toBe("light");
    expect(nextColorSchemeMode("light")).toBe("dark");
    expect(nextColorSchemeMode("dark")).toBe("system");
  });

  it("returns to where it started after three steps", () => {
    let mode = nextColorSchemeMode("system");
    mode = nextColorSchemeMode(mode);
    mode = nextColorSchemeMode(mode);
    expect(mode).toBe("system");
  });
});
