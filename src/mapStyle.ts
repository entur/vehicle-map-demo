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
      cluster: true,
      clusterMaxZoom: 14, // Max zoom to cluster points on
      clusterRadius: 5,
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
          "bus-icon",
          "FERRY",
          "ferry-icon",
          "RAIL",
          "train-icon",
          "TRAM",
          "tram-icon",
          /* default: */ "bus-red",
        ],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          0.12, // smaller at zoom 8
          12,
          0.2, // medium at zoom 12
          14,
          0.25,
          18,
          0.35, // bigger at zoom 18
        ], // Adjust size as needed
        "icon-allow-overlap": true,
        "text-field": ["get", "lineCode"], // read from feature.properties.lineCode
        "text-size": 12,
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-anchor": "top-left", // put text above the point
        "text-offset": [0, -2.9],
        // shift it a bit so it doesn’t overlap the icon
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#FFF",
        "text-halo-width": 5,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.01, 1],
      },
    },
    {
      id: "delay",
      type: "circle",
      source: "vehicles",
      minzoom: 15,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          // At zoom level 12, radius will be 6
          14,
          6,
          // At zoom level 16, radius will be 10
          16,
          10,
        ],
        "circle-translate": [-30, -30],
        "circle-color": [
          "step",
          ["get", "delay"],
          "#00FF00", // green
          180,
          "#FFFF00", // yellow
          300,
          "#FF0000", // red
        ],
      },
      layout: {
        // "visibility": "none" // Uncomment if you want hidden by default
      },
    },
  ],
};
