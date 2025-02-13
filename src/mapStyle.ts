import { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

export const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap Contributors",
      maxzoom: 19,
    },
    vehicles: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
  },

  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm", // This must match the source key above
    },
    {
      id: "vehicle-layer",
      type: "symbol",
      source: "vehicles",
      layout: {
        "icon-image": "bus-icon",
        "icon-size": 1, // Adjust size as needed
        "icon-allow-overlap": true,
      },
    },
  ],
};
