import { describe, expect, it } from "vitest";
import { seasonOn } from "./season.ts";

describe("seasonOn", () => {
  it("is halloween from 24 Oct to 1 Nov inclusive", () => {
    expect(seasonOn(new Date("2026-10-24T12:00:00+02:00"), "")).toBe(
      "halloween",
    );
    expect(seasonOn(new Date("2026-11-01T12:00:00+01:00"), "")).toBe(
      "halloween",
    );
    expect(seasonOn(new Date("2026-10-23T12:00:00+02:00"), "")).toBeNull();
    expect(seasonOn(new Date("2026-11-02T12:00:00+01:00"), "")).toBeNull();
  });

  it("judges the date in Oslo, not UTC", () => {
    // 23:30 UTC on 23 Oct is 01:30 on 24 Oct in Oslo.
    expect(seasonOn(new Date("2026-10-23T23:30:00Z"), "")).toBe("halloween");
    // 23:30 UTC on 1 Nov is 00:30 on 2 Nov in Oslo.
    expect(seasonOn(new Date("2026-11-01T23:30:00Z"), "")).toBeNull();
  });

  it("forces on with season=halloween", () => {
    expect(
      seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=halloween"),
    ).toBe("halloween");
  });

  it("forces off with season=none", () => {
    expect(
      seasonOn(new Date("2026-10-31T12:00:00Z"), "?season=none"),
    ).toBeNull();
  });

  it("ignores an unknown season value", () => {
    expect(seasonOn(new Date("2026-10-31T12:00:00Z"), "?season=easter")).toBe(
      "halloween",
    );
    expect(
      seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=easter"),
    ).toBeNull();
  });
});
