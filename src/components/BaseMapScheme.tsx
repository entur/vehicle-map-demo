import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useColorScheme } from "@mui/material/styles";
import {
  SCHEME_PAINT,
  baseLayerVisibility,
  buildingColour,
  mapSchemeFor,
  skyFor,
  transitNetworkPaint,
} from "../domain/baseMapScheme.ts";
import { Weather } from "../domain/weather.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";
import { MapScheme } from "./basemap/basemap.ts";

/**
 * Shows the base map for the current colour scheme. Both base maps live in the
 * one style (see basemap.ts), so switching is a visibility change: no setStyle,
 * and nothing the app has put on the map — images, GeoJSON data, app layer
 * visibility, terrain — is touched.
 *
 * Sole owner of base-layer visibility, the building, hillshade and transit
 * network colours and the sky. 3D-layer visibility belongs to ViewDimensionLayers and app layers to
 * ModeLayers/MapLayers.
 *
 * `builtFor` is the scheme the style was built with. Until the scheme differs
 * from what the map already shows, there is nothing to write: the first run
 * would otherwise repeat every visibility check, the paint and the sky that
 * buildMapStyle has just baked in. A style built for the wrong scheme still
 * differs, and is corrected on mount.
 *
 * The sky is the scheme's own until `weather` says otherwise (`skyFor`), and
 * is written by its own effect, on the same rule: only when it differs from
 * the sky the map already has. MapLibre eases a sky change over the style's
 * transition, so a new nowcast does not snap.
 */
export function BaseMapScheme({
  builtFor,
  weather,
}: {
  builtFor: MapScheme;
  /** The weather to colour the sky by; null while there is none to show. */
  weather: Weather | null;
}) {
  const { current: mapRef } = useMap();
  const { colorScheme } = useColorScheme();
  const scheme = mapSchemeFor(colorScheme);
  const shown = useRef(builtFor);
  const shownSky = useRef(JSON.stringify(SCHEME_PAINT[builtFor].sky));

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const sky = skyFor(scheme, weather);
    const key = JSON.stringify(sky);
    if (key === shownSky.current) return;
    // See whenLayerExists for why this is not map.isStyleLoaded().
    return whenLayerExists(map, "buildings-3d-layer", () => {
      shownSky.current = key;
      map.setSky(sky);
    });
  }, [scheme, weather, mapRef]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || scheme === shown.current) return;

    const apply = () => {
      shown.current = scheme;
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        if (map.getLayoutProperty(id, "visibility") !== visibility) {
          map.setLayoutProperty(id, "visibility", visibility);
        }
      }
      const paint = SCHEME_PAINT[scheme];
      map.setPaintProperty(
        "buildings-3d-layer",
        "fill-extrusion-color",
        buildingColour(scheme),
      );
      map.setPaintProperty(
        "hillshade-layer",
        "hillshade-shadow-color",
        paint.hillshadeShadow,
      );
      map.setPaintProperty(
        "vehicle-dot-layer",
        "circle-stroke-color",
        paint.vehicleDotEdge,
      );
      map.setPaintProperty(
        "service-journey-stop-labels-layer",
        "text-color",
        paint.journeyStopText,
      );
      map.setPaintProperty(
        "service-journey-stop-labels-layer",
        "text-halo-color",
        paint.journeyStopTextHalo,
      );
      for (const [id, property, value] of transitNetworkPaint(scheme)) {
        map.setPaintProperty(id, property as "line-color", value);
      }
    };

    // See whenLayerExists for why this is not map.isStyleLoaded().
    return whenLayerExists(map, "buildings-3d-layer", apply);
  }, [scheme, mapRef]);

  return null;
}
