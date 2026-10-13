import { NowcastBody, baseSymbol } from "./weather.ts";

/**
 * The numbers in one MET Norway Nowcast reading, as delivered: nothing here
 * is derived, so what the weather card shows is what MET published. A value
 * the reading does not carry is null and is left out, never filled in.
 */
export type WeatherDetails = {
  /** When the reading was fetched, ms since the epoch. */
  retrievedAt: number;
  /** °C. */
  airTemperature: number | null;
  /** mm/h; null outside radar coverage, where it is not measured. */
  precipitationRate: number | null;
  /** m/s. */
  windSpeed: number | null;
  /** Degrees the wind blows from, clockwise from north. */
  windFromDirection: number | null;
  /** m/s. */
  windGust: number | null;
  /** MET's symbol code for the coming hour: a forecast, unlike the rest. */
  nextHourSymbol: string | null;
};

/**
 * The details in a Nowcast response fetched at `retrievedAt`, or null when it
 * carries none. Unlike `weatherFromNowcast` this still answers outside radar
 * coverage: temperature and wind are published there, only the rate is not.
 */
export function weatherDetailsFromNowcast(
  body: unknown,
  retrievedAt: number,
): WeatherDetails | null {
  const properties = (body as NowcastBody | null)?.properties;
  const now = properties?.timeseries?.[0]?.data;
  const instant = now?.instant?.details;
  if (!instant) return null;
  const value = (key: keyof typeof instant) => {
    const v: unknown = instant[key];
    return typeof v === "number" ? v : null;
  };
  const symbol = now?.next_1_hours?.summary?.symbol_code;
  const details: WeatherDetails = {
    retrievedAt,
    airTemperature: value("air_temperature"),
    precipitationRate:
      properties?.meta?.radar_coverage === "ok"
        ? value("precipitation_rate")
        : null,
    windSpeed: value("wind_speed"),
    windFromDirection: value("wind_from_direction"),
    windGust: value("wind_speed_of_gust"),
    nextHourSymbol: typeof symbol === "string" ? symbol : null,
  };
  const empty =
    details.airTemperature === null &&
    details.precipitationRate === null &&
    details.windSpeed === null;
  return empty ? null : details;
}

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

/** The nearest of the sixteen compass points to a direction in degrees. */
export function compassPoint(degrees: number): string {
  const step = 360 / COMPASS_POINTS.length;
  const index = Math.round((((degrees % 360) + 360) % 360) / step);
  return COMPASS_POINTS[index % COMPASS_POINTS.length];
}

/** A Map, since a plain object would also answer for `constructor`. */
const SKY_LABELS = new Map([
  ["clearsky", "Clear sky"],
  ["fair", "Fair"],
  ["partlycloudy", "Partly cloudy"],
  ["cloudy", "Cloudy"],
  ["fog", "Fog"],
]);

/**
 * MET's precipitation symbols are built from parts: an optional strength,
 * what falls, and optionally showers and thunder. Two of their codes carry a
 * stray s after "light" (`lightssleetshowersandthunder`), hence the `s?`.
 */
const PRECIPITATION_SYMBOL =
  /^(light|heavy)?s?(rain|sleet|snow)(showers)?(andthunder)?$/;

/**
 * A MET symbol code in words, or null for one this does not know — the card
 * then says nothing rather than show a code or guess.
 */
export function symbolLabel(symbolCode: string): string | null {
  const symbol = baseSymbol(symbolCode);
  const sky = SKY_LABELS.get(symbol);
  if (sky) return sky;
  const parts = PRECIPITATION_SYMBOL.exec(symbol);
  if (!parts) return null;
  const [, strength, falls, showers, thunder] = parts;
  const words = [
    strength,
    falls,
    showers && "showers",
    thunder && "and thunder",
  ]
    .filter(Boolean)
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One decimal, as MET publishes, with a true minus sign. */
function oneDecimal(value: number): string {
  return value.toFixed(1).replace("-", "−");
}

export function formatSpeed(metresPerSecond: number): string {
  return `${oneDecimal(metresPerSecond)} m/s`;
}

export function formatTemperature(celsius: number): string {
  return `${oneDecimal(celsius)} °C`;
}

export function formatPrecipitation(rate: number): string {
  return `${oneDecimal(rate)} mm/h`;
}

/** The wind's speed and, when published, the compass point it blows from. */
export function formatWind(
  speed: number,
  fromDirection: number | null,
): string {
  const text = formatSpeed(speed);
  return fromDirection === null
    ? text
    : `${text} from ${compassPoint(fromDirection)}`;
}
