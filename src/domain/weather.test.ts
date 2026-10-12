import { describe, expect, it } from "vitest";
import { needsRefetch, nowcastUrl, weatherFromNowcast } from "./weather.ts";

/** A Nowcast body shaped as api.met.no delivered it on 2026-10-12, cut to its first step. */
function nowcast(
  details: Record<string, number>,
  symbolCode: string,
  radarCoverage = "ok",
) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [10.75, 59.91, 5] },
    properties: {
      meta: {
        updated_at: "2026-10-12T07:12:52Z",
        radar_coverage: radarCoverage,
      },
      timeseries: [
        {
          time: "2026-10-12T07:15:00Z",
          data: {
            instant: {
              details: {
                air_temperature: 3.5,
                precipitation_rate: 0.0,
                wind_from_direction: 37.3,
                wind_speed: 1.0,
                ...details,
              },
            },
            next_1_hours: {
              summary: { symbol_code: symbolCode },
              details: { precipitation_amount: 0.0 },
            },
          },
        },
      ],
    },
  };
}

describe("weatherFromNowcast", () => {
  it("is dry when nothing is falling now, whatever the next hour's symbol says", () => {
    expect(
      weatherFromNowcast(nowcast({ precipitation_rate: 0 }, "rain")),
    ).toEqual({ kind: "none", intensity: 0, slant: 0 });
  });

  it("is rain when something is falling and the symbol is not snow", () => {
    expect(
      weatherFromNowcast(nowcast({ precipitation_rate: 2 }, "lightrain"))?.kind,
    ).toBe("rain");
  });

  it.each(["snow", "heavysnow", "lightsnowshowers_night", "snowandthunder"])(
    "is snow for the symbol %s",
    (symbol) => {
      expect(
        weatherFromNowcast(nowcast({ precipitation_rate: 1 }, symbol))?.kind,
      ).toBe("snow");
    },
  );

  it("counts sleet as rain", () => {
    expect(
      weatherFromNowcast(nowcast({ precipitation_rate: 1 }, "sleet"))?.kind,
    ).toBe("rain");
  });

  it.each([
    [0.5, 0.25],
    [2, 0.5],
    [8, 1],
    [40, 1],
  ])("a rate of %d mm/h is intensity %d", (rate, intensity) => {
    expect(
      weatherFromNowcast(nowcast({ precipitation_rate: rate }, "rain"))
        ?.intensity,
    ).toBeCloseTo(intensity);
  });

  it.each([
    [0, 0],
    [7.5, 0.5],
    [15, 1],
    [30, 1],
  ])("a wind of %d m/s is slant %d", (wind, slant) => {
    expect(
      weatherFromNowcast(
        nowcast({ precipitation_rate: 1, wind_speed: wind }, "rain"),
      )?.slant,
    ).toBeCloseTo(slant);
  });

  it("falls straight down when no wind is published", () => {
    const body = nowcast({ precipitation_rate: 1 }, "rain");
    delete (
      body.properties.timeseries[0].data.instant.details as Record<
        string,
        number
      >
    ).wind_speed;
    expect(weatherFromNowcast(body)?.slant).toBe(0);
  });

  it("is unknown outside radar coverage, where the rate is not measured", () => {
    expect(
      weatherFromNowcast(
        nowcast({ precipitation_rate: 3 }, "rain", "no coverage"),
      ),
    ).toBeNull();
  });

  it.each([
    ["an empty body", {}],
    ["no time steps", { properties: { meta: {}, timeseries: [] } }],
    ["not an object", "Service Unavailable"],
    ["null", null],
  ])("is unknown for %s", (_, body) => {
    expect(weatherFromNowcast(body)).toBeNull();
  });

  it("is unknown when the rate is missing", () => {
    const body = nowcast({}, "rain");
    delete (
      body.properties.timeseries[0].data.instant.details as Record<
        string,
        number
      >
    ).precipitation_rate;
    expect(weatherFromNowcast(body)).toBeNull();
  });
});

describe("nowcastUrl", () => {
  it("cuts coordinates to the four decimals MET allows", () => {
    expect(
      nowcastUrl("https://api.met.no/weatherapi/nowcast/2.0/complete", {
        lat: 59.910912345,
        lon: 10.752245678,
      }),
    ).toBe(
      "https://api.met.no/weatherapi/nowcast/2.0/complete?lat=59.9109&lon=10.7522",
    );
  });
});

describe("needsRefetch", () => {
  const oslo = { lat: 59.9109, lon: 10.7522 };
  const last = { centre: oslo, at: 1_000_000 };

  it("fetches when nothing has been fetched", () => {
    expect(needsRefetch(null, oslo, 0)).toBe(true);
  });

  it("holds while the map stays put and the data is fresh", () => {
    expect(needsRefetch(last, oslo, last.at + 4 * 60_000)).toBe(false);
  });

  it("fetches again after five minutes", () => {
    expect(needsRefetch(last, oslo, last.at + 5 * 60_000)).toBe(true);
  });

  it("holds through a move of a few kilometres", () => {
    // 0.03° of latitude is about 3.3 km.
    expect(
      needsRefetch(last, { lat: 59.9409, lon: 10.7522 }, last.at + 1000),
    ).toBe(false);
  });

  it("fetches when the map has moved more than five kilometres", () => {
    // 0.06° of latitude is about 6.7 km.
    expect(
      needsRefetch(last, { lat: 59.9709, lon: 10.7522 }, last.at + 1000),
    ).toBe(true);
  });
});
