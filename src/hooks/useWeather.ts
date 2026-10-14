import { useEffect, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useConfig } from "../config/ConfigContext.ts";
import {
  Weather,
  WeatherFetch,
  needsRefetch,
  nowcastUrl,
  weatherFromNowcast,
} from "../domain/weather.ts";
import {
  WeatherDetails,
  weatherDetailsFromNowcast,
} from "../domain/weatherDetails.ts";

/** How often a map that is standing still asks whether its weather is due. */
const CHECK_INTERVAL_MS = 30_000;

/** MET answers this for a place outside the area the Nowcast covers. */
const OUTSIDE_AREA_STATUS = 422;

/**
 * One reading: `weather` is what is drawn, `details` the numbers behind it.
 * They are null separately — outside radar coverage nothing is drawn, but
 * temperature and wind are still published.
 */
export type WeatherReading = {
  weather: Weather | null;
  details: WeatherDetails | null;
};

export const NO_READING: WeatherReading = { weather: null, details: null };

/**
 * The weather at the map's centre from MET Norway's Nowcast, or nothing while
 * it is not known: not enabled, not fetched yet, or outside radar coverage.
 *
 * Fetched when enabled, then whenever `needsRefetch` says so — asked when a
 * move ends and on a slow timer, so a chase, which ends a move every frame,
 * costs a comparison rather than a request. A failed fetch keeps the weather
 * already shown and waits for the next one that is due — except a place
 * outside the Nowcast's area, which clears it: the reading on screen is for
 * somewhere the map has left.
 *
 * The request carries no headers of its own: MET identifies a web page by its
 * Origin and does not answer CORS preflights.
 */
export function useWeather(enabled: boolean): WeatherReading {
  const { current: mapRef } = useMap();
  const endpoint = useConfig()["weather-nowcast-endpoint"];
  const [reading, setReading] = useState<WeatherReading>(NO_READING);

  useEffect(() => {
    if (!enabled || !mapRef || !endpoint) return;
    const map = mapRef.getMap();
    const controller = new AbortController();
    let last: WeatherFetch | null = null;
    let latest = 0;

    const check = () => {
      const { lng, lat } = map.getCenter();
      const centre = { lon: lng, lat };
      const now = Date.now();
      if (!needsRefetch(last, centre, now)) return;
      last = { centre, at: now };
      const request = ++latest;
      fetch(nowcastUrl(endpoint, centre), { signal: controller.signal })
        .then((response) => {
          if (response.status === OUTSIDE_AREA_STATUS) return null;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((body: unknown) => {
          // A slower answer for a place the map has since left.
          if (request !== latest) return;
          const weather = weatherFromNowcast(body);
          const details = weatherDetailsFromNowcast(body, now);
          // Not for a place outside the area, nor for one outside radar
          // coverage that still has its temperature: both are answers.
          if (body !== null && !weather && !details) {
            console.warn("Weather: the nowcast has no reading for", centre);
          }
          setReading({ weather, details });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.warn("Weather: the nowcast request failed", error);
        });
    };

    check();
    map.on("moveend", check);
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      controller.abort();
      map.off("moveend", check);
      clearInterval(timer);
      setReading(NO_READING);
    };
  }, [enabled, mapRef, endpoint]);

  return reading;
}
