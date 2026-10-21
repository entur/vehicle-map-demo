import { describe, expect, it } from "vitest";
import { firstAdventSunday, seasonOn } from "./season.ts";

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

describe("seasonOn, 17. mai", () => {
  it("is 17mai from 1 May to 17 May inclusive", () => {
    expect(seasonOn(new Date("2026-05-01T12:00:00+02:00"), "")).toBe("17mai");
    expect(seasonOn(new Date("2026-05-17T12:00:00+02:00"), "")).toBe("17mai");
    expect(seasonOn(new Date("2026-04-30T12:00:00+02:00"), "")).toBeNull();
    expect(seasonOn(new Date("2026-05-18T12:00:00+02:00"), "")).toBeNull();
  });

  it("judges the edges in Oslo, not UTC", () => {
    // 22:30 UTC on 17 May is 00:30 on 18 May in Oslo.
    expect(seasonOn(new Date("2026-05-17T22:30:00Z"), "")).toBeNull();
    // 22:30 UTC on 30 Apr is 00:30 on 1 May in Oslo.
    expect(seasonOn(new Date("2026-04-30T22:30:00Z"), "")).toBe("17mai");
  });

  it("is forced on and off by the query", () => {
    expect(seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=17mai")).toBe(
      "17mai",
    );
    expect(
      seasonOn(new Date("2026-05-17T10:00:00Z"), "?season=none"),
    ).toBeNull();
  });
});

describe("firstAdventSunday", () => {
  it.each([
    [2026, [11, 29]],
    [2027, [11, 28]],
    [2028, [12, 3]],
    [2029, [12, 2]],
    [2030, [12, 1]],
    [2033, [11, 27]],
  ])("%i", (year, expected) =>
    expect(firstAdventSunday(year)).toEqual(expected),
  );
});

describe("christmas", () => {
  const at = (iso: string) => seasonOn(new Date(iso), "");
  it("starts on the first Sunday of Advent", () => {
    expect(at("2026-11-29T12:00:00+01:00")).toBe("christmas");
    expect(at("2026-11-28T12:00:00+01:00")).toBeNull();
  });
  it("runs across the new year through 6 January", () => {
    expect(at("2026-12-31T12:00:00+01:00")).toBe("christmas");
    expect(at("2027-01-01T12:00:00+01:00")).toBe("christmas");
    expect(at("2027-01-06T12:00:00+01:00")).toBe("christmas");
    expect(at("2027-01-07T12:00:00+01:00")).toBeNull();
  });
  it("judges by the date in Oslo", () => {
    expect(at("2027-01-06T23:30:00Z")).toBeNull(); // 7 Jan in Oslo
    expect(at("2026-11-28T23:30:00Z")).toBe("christmas"); // 29 Nov in Oslo
  });
  it("starts on 3 December in 2028", () => {
    expect(at("2028-12-02T12:00:00+01:00")).toBeNull();
    expect(at("2028-12-03T12:00:00+01:00")).toBe("christmas");
  });
  it("is forced with season=christmas and off with season=none", () => {
    expect(
      seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=christmas"),
    ).toBe("christmas");
    expect(
      seasonOn(new Date("2026-12-24T12:00:00+01:00"), "?season=none"),
    ).toBeNull();
  });
});
