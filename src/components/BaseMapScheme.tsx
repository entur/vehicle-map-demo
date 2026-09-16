import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useColorScheme } from "@mui/material/styles";
import {
  SCHEME_PAINT,
  baseLayerVisibility,
  mapSchemeFor,
} from "../domain/baseMapScheme.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";

/**
 * Shows the base map for the current colour scheme. Both base maps live in the
 * one style (see basemap.ts), so switching is a visibility change: no setStyle,
 * and nothing the app has put on the map — images, GeoJSON data, app layer
 * visibility, terrain — is touched.
 *
 * Sole owner of base-layer visibility, the building and hillshade colours and
 * the sky. 3D-layer visibility belongs to ViewDimensionLayers and app layers to
 * ModeLayers/MapLayers.
 */
export function BaseMapScheme() {
  const { current: mapRef } = useMap();
  const { colorScheme } = useColorScheme();
  const scheme = mapSchemeFor(colorScheme);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const apply = () => {
      for (const [id, visibility] of baseLayerVisibility(scheme)) {
        if (map.getLayoutProperty(id, "visibility") !== visibility) {
          map.setLayoutProperty(id, "visibility", visibility);
        }
      }
      const paint = SCHEME_PAINT[scheme];
      map.setPaintProperty(
        "buildings-3d-layer",
        "fill-extrusion-color",
        paint.buildings,
      );
      map.setPaintProperty(
        "hillshade-layer",
        "hillshade-shadow-color",
        paint.hillshadeShadow,
      );
      map.setSky(paint.sky);
    };

    // See whenLayerExists for why this is not map.isStyleLoaded().
    return whenLayerExists(map, "buildings-3d-layer", apply);
  }, [scheme, mapRef]);

  return null;
}
