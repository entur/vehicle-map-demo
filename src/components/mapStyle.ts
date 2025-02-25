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
      cluster: false,
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
          4,
          0.08,
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
        "text-offset": [0, -3.1],
        // shift it a bit so it doesn’t overlap the icon
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#FFF",
        "text-halo-width": 6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.01, 1],
      },
    },
    {
      id: "delay",
      type: "circle",
      source: "vehicles",
      minzoom: 13,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          // At zoom level 12, radius will be 6
          13,
          10,
          // At zoom level 16, radius will be 10
          15,
          9,
          17,
          8,
        ],
        "circle-translate": [-20, -30],
        "circle-color": [
          "step",
          ["get", "delay"],
          "#00FF00", // green
          180,
          "#FFFF00", // yellow
          300,
          "#FF0000", // red
        ],
        "circle-stroke-color": "#000",
        "circle-stroke-width": 2,
      },
      layout: {
        // "visibility": "none" // Uncomment if you want hidden by default
      },
    },
    {
      id: "vehicle-delay-heatmap",
      type: "heatmap",
      source: "vehicles", // Same source name as in your style
      maxzoom: 19, // For instance
      paint: {
        // Weight each point by its "delay" property:
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "delay"],
          0,
          0, // If delay=0, weight=0
          180,
          0.5, // If delay=180, weight=0.5
          300,
          1, // If delay=300 or above, weight=1
        ],

        // Increase the heatmap intensity at higher zoom levels:
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],

        // Define a color ramp for the heatmap:
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"], // The computed "density" of points
          0,
          "rgba(33,102,172,0)",
          0.2,
          "rgb(103,169,207)",
          0.4,
          "rgb(209,229,240)",
          0.6,
          "rgb(253,219,199)",
          0.8,
          "rgb(239,138,98)",
          1,
          "rgb(178,24,43)",
        ],

        // Increase radius as zoom increases
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 14, 20],

        // Decrease heatmap opacity at high zoom levels
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 0.3],
      },
      layout: {
        visibility: "none",
      },
    },
  ],
};
