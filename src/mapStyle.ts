import { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
        "icon-image": [
          "match",
          ["get", "mode"],
          "BUS",
          "bus-green", // if vehicle.mode === "bus"
          "FERRY",
          "ferry-icon",
          "RAIL",
          "train-red", // if vehicle.mode === "tram"
          /* default: */ "bus-red",
        ],
        "icon-size": 0.075, // Adjust size as needed
        "icon-allow-overlap": true,
        "text-field": ["get", "lineCode"], // read from feature.properties.lineCode
        "text-size": 12,
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-anchor": "top-left", // put text above the point
        "text-offset": [0, -2.0], // shift it a bit so it doesn’t overlap the icon
      },
    },
  ],
};
