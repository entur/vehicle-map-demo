import { describe, expect, it } from "vitest";
import {
  compassPoint,
  formatPrecipitation,
  formatSpeed,
  formatTemperature,
  formatWind,
  symbolLabel,
  weatherDetailsFromNowcast,
} from "./weatherDetails.ts";

/** A Nowcast body shaped as api.met.no delivered it on 2026-10-13, cut to its first step. */
function nowcast(
  details: Record<string, number>,
  symbolCode: string | null = "lightrain",
  radarCoverage = "ok",
) {
  return {
    properties: {
      meta: {
        updated_at: "2026-10-13T08:24:08Z",
        radar_coverage: radarCoverage,
      },
      timeseries: [
        {
          time: "2026-10-13T08:25:00Z",
          data: {
            instant: { details },
            ...(symbolCode !== null && {
              next_1_hours: { summary: { symbol_code: symbolCode } },
            }),
          },
        },
      ],
    },
  };
}

const FULL = {
  air_temperature: 6.4,
  precipitation_rate: 0.3,
  wind_from_direction: 163.5,
  wind_speed: 2.9,
  wind_speed_of_gust: 5.0,
};

const RETRIEVED = Date.UTC(2026, 9, 13, 8, 26);

describe("weatherDetailsFromNowcast", () => {
  it("reads the values of the first time step as delivered", () => {
    expect(weatherDetailsFromNowcast(nowcast(FULL), RETRIEVED)).toEqual({
      retrievedAt: RETRIEVED,
      airTemperature: 6.4,
      precipitationRate: 0.3,
      windSpeed: 2.9,
      windFromDirection: 163.5,
      windGust: 5.0,
      nextHourSymbol: "lightrain",
    });
  });

  // The rate there is not a measurement, so it is not shown as one.
  it("keeps temperature and wind but no rate outside radar coverage", () => {
    const details = weatherDetailsFromNowcast(
      nowcast(FULL, "cloudy", "no coverage"),
      RETRIEVED,
    );
    expect(details?.precipitationRate).toBeNull();
    expect(details?.airTemperature).toBe(6.4);
    expect(details?.windSpeed).toBe(2.9);
  });

  it("leaves out what the step does not publish", () => {
    expect(
      weatherDetailsFromNowcast(
        nowcast({ precipitation_rate: 0 }, null),
        RETRIEVED,
      ),
    ).toEqual({
      retrievedAt: RETRIEVED,
      airTemperature: null,
      precipitationRate: 0,
      windSpeed: null,
      windFromDirection: null,
      windGust: null,
      nextHourSymbol: null,
    });
  });

  it.each([
    ["an empty body", {}],
    ["no time steps", { properties: { meta: {}, timeseries: [] } }],
    ["a step with no values", nowcast({}, null)],
    ["not an object", "Service Unavailable"],
    ["null", null],
  ])("is null for %s", (_, body) => {
    expect(weatherDetailsFromNowcast(body, RETRIEVED)).toBeNull();
  });
});

describe("compassPoint", () => {
  it.each([
    [0, "N"],
    [11.2, "N"],
    [11.3, "NNE"],
    [45, "NE"],
    [90, "E"],
    [163.5, "SSE"],
    [180, "S"],
    [270, "W"],
    [348.8, "N"],
    [360, "N"],
  ])("%d° is %s", (degrees, point) => {
    expect(compassPoint(degrees)).toBe(point);
  });
});

describe("symbolLabel", () => {
  it.each([
    ["clearsky_day", "Clear sky"],
    ["fair_night", "Fair"],
    ["partlycloudy_polartwilight", "Partly cloudy"],
    ["cloudy", "Cloudy"],
    ["fog", "Fog"],
    ["lightrain", "Light rain"],
    ["rain", "Rain"],
    ["heavysleet", "Heavy sleet"],
    ["snowshowers_day", "Snow showers"],
    ["heavyrainshowersandthunder_night", "Heavy rain showers and thunder"],
    ["rainandthunder", "Rain and thunder"],
    // MET's own codes carry the extra s.
    ["lightssleetshowersandthunder_day", "Light sleet showers and thunder"],
    ["lightssnowshowersandthunder_night", "Light snow showers and thunder"],
  ])("%s reads %s", (symbol, label) => {
    expect(symbolLabel(symbol)).toBe(label);
  });

  // A plain object lookup would answer these with Object's own members.
  it.each(["", "somethingnew", "rainbows", "constructor", "toString"])(
    "has no label for the unknown symbol '%s'",
    (symbol) => {
      expect(symbolLabel(symbol)).toBeNull();
    },
  );
});

describe("formatting", () => {
  it("shows values to the one decimal MET publishes", () => {
    expect(formatTemperature(6.4)).toBe("6.4 °C");
    expect(formatTemperature(-3)).toBe("−3.0 °C");
    expect(formatPrecipitation(0)).toBe("0.0 mm/h");
    expect(formatPrecipitation(12.34)).toBe("12.3 mm/h");
    expect(formatSpeed(7.5)).toBe("7.5 m/s");
  });

  it("names where the wind comes from", () => {
    expect(formatWind(2.9, 163.5)).toBe("2.9 m/s from SSE");
  });

  it("gives the speed alone when no direction is published", () => {
    expect(formatWind(2.9, null)).toBe("2.9 m/s");
  });
});
