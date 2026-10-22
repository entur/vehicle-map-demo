import { describe, expect, it } from "vitest";
import {
  firstAdventSunday,
  fireworksOn,
  msUntilNextOsloDay,
  flagDesignFor,
  seasonOn,
} from "./season.ts";

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
      seasonOn(new Date("2026-08-01T12:00:00Z"), "?season=easter"),
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

describe("seasonOn, Pride", () => {
  it("is pride from 1 June to 30 June inclusive", () => {
    expect(seasonOn(new Date("2026-06-01T12:00:00+02:00"), "")).toBe("pride");
    expect(seasonOn(new Date("2026-06-30T12:00:00+02:00"), "")).toBe("pride");
    expect(seasonOn(new Date("2026-05-31T12:00:00+02:00"), "")).toBeNull();
    expect(seasonOn(new Date("2026-07-01T12:00:00+02:00"), "")).toBeNull();
  });

  it("judges the edges in Oslo, not UTC", () => {
    // 22:30 UTC on 31 May is 00:30 on 1 June in Oslo.
    expect(seasonOn(new Date("2026-05-31T22:30:00Z"), "")).toBe("pride");
    // 22:30 UTC on 30 June is 00:30 on 1 July in Oslo.
    expect(seasonOn(new Date("2026-06-30T22:30:00Z"), "")).toBeNull();
  });

  it("is forced on and off by the query", () => {
    expect(seasonOn(new Date("2026-08-01T12:00:00Z"), "?season=pride")).toBe(
      "pride",
    );
    expect(
      seasonOn(new Date("2026-06-15T10:00:00Z"), "?season=none"),
    ).toBeNull();
  });
});

describe("flagDesignFor", () => {
  it("flies the Norwegian flag for 17. mai and the rainbow for Pride", () => {
    expect(flagDesignFor("17mai")).toBe("norway");
    expect(flagDesignFor("pride")).toBe("rainbow");
  });

  it("flies none in the other seasons or none", () => {
    expect(flagDesignFor("halloween")).toBeNull();
    expect(flagDesignFor("christmas")).toBeNull();
    expect(flagDesignFor(null)).toBeNull();
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

describe("fireworksOn", () => {
  it("is on from 27 Dec to 1 Jan inclusive, Oslo dates", () => {
    expect(fireworksOn(new Date("2026-12-26T12:00:00+01:00"), "")).toBe(false);
    expect(fireworksOn(new Date("2026-12-27T00:30:00+01:00"), "")).toBe(true);
    expect(fireworksOn(new Date("2026-12-31T23:59:00+01:00"), "")).toBe(true);
    expect(fireworksOn(new Date("2027-01-01T23:59:00+01:00"), "")).toBe(true);
    expect(fireworksOn(new Date("2027-01-02T00:00:00+01:00"), "")).toBe(false);
  });
  it("judges the date in Oslo, not UTC", () => {
    // 23:30 UTC on 26 Dec is 00:30 on 27 Dec in Oslo.
    expect(fireworksOn(new Date("2026-12-26T23:30:00Z"), "")).toBe(true);
    // 23:30 UTC on 1 Jan is 00:30 on 2 Jan in Oslo.
    expect(fireworksOn(new Date("2027-01-01T23:30:00Z"), "")).toBe(false);
  });
  it("is forced on by season=newyear, off by any other forced season", () => {
    const june = new Date("2026-06-01T12:00:00Z");
    const dec28 = new Date("2026-12-28T12:00:00Z");
    expect(fireworksOn(june, "?season=newyear")).toBe(true);
    expect(fireworksOn(dec28, "?season=christmas")).toBe(false);
    expect(fireworksOn(dec28, "?season=none")).toBe(false);
    expect(fireworksOn(dec28, "?season=easter")).toBe(true);
  });
});

describe("msUntilNextOsloDay", () => {
  const until = (iso: string) => msUntilNextOsloDay(new Date(iso));
  const HOUR = 60 * 60 * 1000;

  it("counts to the next midnight in Oslo, not UTC", () => {
    expect(until("2026-12-26T23:30:00+01:00")).toBe(HOUR / 2);
    // 23:30 UTC on 26 Dec is already 00:30 on 27 Dec in Oslo.
    expect(until("2026-12-26T23:30:00Z")).toBe(23.5 * HOUR);
    expect(until("2026-05-16T12:00:00.250+02:00")).toBe(12 * HOUR - 250);
  });

  it("counts a full day from midnight itself", () => {
    expect(until("2026-10-24T00:00:00+02:00")).toBe(24 * HOUR);
  });

  it("follows the clocks going forward and back", () => {
    // 29 March 2026 is 23 hours long in Oslo, 25 October 25 hours.
    expect(until("2026-03-29T00:00:00+01:00")).toBe(23 * HOUR);
    expect(until("2026-03-28T23:00:00+01:00")).toBe(HOUR);
    expect(until("2026-10-25T00:00:00+02:00")).toBe(25 * HOUR);
    expect(until("2026-10-25T12:00:00+01:00")).toBe(12 * HOUR);
  });
});

it("keeps the trees up under the fireworks", () => {
  expect(seasonOn(new Date("2026-12-28T12:00:00Z"), "")).toBe("christmas");
  expect(seasonOn(new Date("2026-06-01T12:00:00Z"), "?season=newyear")).toBe(
    "christmas",
  );
});
