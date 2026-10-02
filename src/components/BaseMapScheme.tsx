import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useColorScheme } from "@mui/material/styles";
import {
  SCHEME_PAINT,
  baseLayerVisibility,
  buildingColour,
  mapSchemeFor,
  transitNetworkPaint,
} from "../domain/baseMapScheme.ts";
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
 */
export function BaseMapScheme({ builtFor }: { builtFor: MapScheme }) {
  const { current: mapRef } = useMap();
  const { colorScheme } = useColorScheme();
  const scheme = mapSchemeFor(colorScheme);
  const shown = useRef(builtFor);

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
      for (const [id, property, value] of transitNetworkPaint(scheme)) {
        map.setPaintProperty(id, property as "line-color", value);
      }
      map.setSky(paint.sky);
    };

    // See whenLayerExists for why this is not map.isStyleLoaded().
    return whenLayerExists(map, "buildings-3d-layer", apply);
  }, [scheme, mapRef]);

  return null;
}
