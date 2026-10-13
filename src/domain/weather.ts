import { LngLat, distanceMetres } from "./chaseCamera.ts";

/** How much of the sky is cloud; `fog` is cloud on the ground. */
export type CloudCover = "clear" | "partly" | "cloudy" | "fog";

/**
 * What is falling at one place now, and the sky it falls from. `intensity`
 * and `slant` are 0–1: how dense the precipitation is drawn and how far the
 * wind leans it over.
 */
export type Weather = {
  kind: "rain" | "snow" | "none";
  intensity: number;
  slant: number;
  cover: CloudCover;
};

/** The rate, in mm/h, drawn at full density. */
const FULL_INTENSITY_RATE = 8;
/** The wind, in m/s, that leans precipitation over as far as it goes. */
const FULL_SLANT_WIND = 15;

/** MET publishes a new nowcast every five minutes. */
const REFETCH_INTERVAL_MS = 5 * 60_000;
/** Further than this from the last fetch, the weather may be another. */
const REFETCH_DISTANCE_METRES = 5000;

/**
 * The cloud cover a Nowcast symbol stands for. The Nowcast measures no cloud,
 * so this is read from its symbol for the coming hour — a forecast, where the
 * precipitation rate is a measurement. Precipitation on its way means cloud
 * already, and showers come with gaps between them. A symbol this does not
 * know leaves the sky clear, which is the sky the map has without weather.
 */
function cloudCoverFor(symbolCode: string): CloudCover {
  const symbol = baseSymbol(symbolCode);
  if (symbol === "fog") return "fog";
  if (symbol === "cloudy") return "cloudy";
  if (symbol === "partlycloudy") return "partly";
  if (symbol.includes("showers")) return "partly";
  if (/rain|snow|sleet/.test(symbol)) return "cloudy";
  return "clear";
}

/**
 * A MET symbol code without its time-of-day variant: `rainshowers_night` is
 * `rainshowers`. The one place the variants are named, so the sky and the
 * weather card cannot read the same symbol differently.
 */
export function baseSymbol(symbolCode: string): string {
  return symbolCode.replace(/_(day|night|polartwilight)$/, "");
}

/** The parts of a Nowcast response the app reads. Nothing in it is trusted. */
export type NowcastBody = {
  properties?: {
    meta?: { radar_coverage?: string };
    timeseries?: {
      data?: {
        instant?: {
          details?: {
            air_temperature?: number;
            precipitation_rate?: number;
            wind_from_direction?: number;
            wind_speed?: number;
            wind_speed_of_gust?: number;
          };
        };
        next_1_hours?: { summary?: { symbol_code?: string } };
      };
    }[];
  };
};

/**
 * The weather in a MET Norway Nowcast response, or null when it does not say:
 * a body that is not a nowcast, or a place outside radar coverage, where the
 * precipitation rate is not measured.
 *
 * The rate decides whether anything falls; the symbol, which describes the
 * coming hour, only whether it is snow and, while nothing falls, how cloudy
 * the sky is. Whatever falls, falls from an overcast sky. Sleet is drawn as
 * rain. Density follows the square root of the rate, so drizzle is still
 * visible.
 */
export function weatherFromNowcast(body: unknown): Weather | null {
  const properties = (body as NowcastBody | null)?.properties;
  if (properties?.meta?.radar_coverage !== "ok") return null;
  const now = properties.timeseries?.[0]?.data;
  const rate = now?.instant?.details?.precipitation_rate;
  if (typeof rate !== "number") return null;
  const symbol = now?.next_1_hours?.summary?.symbol_code ?? "";
  if (rate <= 0) {
    return {
      kind: "none",
      intensity: 0,
      slant: 0,
      cover: cloudCoverFor(symbol),
    };
  }

  const wind = now?.instant?.details?.wind_speed ?? 0;
  return {
    kind: symbol.includes("snow") ? "snow" : "rain",
    intensity: Math.min(1, Math.sqrt(rate / FULL_INTENSITY_RATE)),
    slant: Math.min(1, wind / FULL_SLANT_WIND),
    cover: "cloudy",
  };
}

/**
 * The Nowcast request for a place. MET's terms allow at most four decimals,
 * and refuse more on newer products.
 */
export function nowcastUrl(endpoint: string, centre: LngLat): string {
  return `${endpoint}?lat=${centre.lat.toFixed(4)}&lon=${centre.lon.toFixed(4)}`;
}

/** Where and when the weather was last fetched. */
export type WeatherFetch = { centre: LngLat; at: number };

/** Whether the weather at `centre` should be fetched again at `now`. */
export function needsRefetch(
  last: WeatherFetch | null,
  centre: LngLat,
  now: number,
): boolean {
  return (
    last === null ||
    now - last.at >= REFETCH_INTERVAL_MS ||
    distanceMetres(last.centre, centre) > REFETCH_DISTANCE_METRES
  );
}
