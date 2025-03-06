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
    vehicleTraces: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
  },

  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": 0.3,
        "raster-contrast": 0.1,
      },
    },
    {
      id: "vehicle-trace-layer",
      type: "line",
      source: "vehicleTraces",
      layout: {
        "line-cap": "round",
        "line-join": "miter",
        visibility: "none",
      },
      paint: {
        "line-color": "#9353a1",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          // At zoom level 13, radius will be 10
          6,
          3,
          // At zoom level 15, radius will be 9
          12,
          7,
          17,
          20,
        ],
        "line-opacity": 0.6,
        "line-blur": 0.5,
      },
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
        ],
        "icon-allow-overlap": true,
        "text-field": ["get", "lineCode"],
        "text-size": 14,
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-anchor": "top-left",
        "text-offset": [0, -2.8],
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
          // At zoom level 13, radius will be 10
          13,
          9,
          // At zoom level 15, radius will be 9
          15,
          8,
          17,
          7,
        ],
        "circle-translate": [-20, -30],
        "circle-color": [
          "step",
          ["get", "delay"],
          "#00FF00",
          180,
          "#FFFF00",
          300,
          "#FF0000",
        ],
        "circle-stroke-color": "#000",
        "circle-stroke-width": 2,
      },
      layout: {
        visibility: "none", // Default visibility
      },
    },
    {
      id: "vehicle-update-interval-text-layer",
      type: "symbol",
      source: "vehicles",
      minzoom: 13,
      layout: {
        "text-field": [
          "concat",
          ["to-string", ["get", "updateInterval"]],
          "ms",
        ],
        "text-size": 12,
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#000000",
        "text-halo-color": "#FFF",
        "text-halo-width": 6,
      },
    },
    {
      id: "vehicle-update-interval-icon-layer",
      type: "symbol",
      source: "vehicles",
      layout: {
        "icon-image": [
          "case",
          ["<", ["get", "updateInterval"], 3000],
          "green-marker",
          ["<", ["get", "updateInterval"], 15000],
          "orange-marker",
          ["<", ["get", "updateInterval"], 30000],
          "red-marker",
          "",
        ],
        "icon-size": 0.2,
        "icon-allow-overlap": true,
        visibility: "none",
      },
    },
    {
      id: "vehicle-update-interval-skull-layer",
      type: "symbol",
      source: "vehicles",
      filter: [">=", ["get", "updateInterval"], 30000],
      layout: {
        "icon-image": "skull-marker",
        "icon-size": 0.2,
        "icon-allow-overlap": true,
        visibility: "none",
      },
    },
    {
      id: "vehicles-heatmap",
      type: "heatmap",
      source: "vehicles",
      maxzoom: 15,
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
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
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 15, 20],
        "heatmap-opacity": 0.8,
      },
      layout: {
        visibility: "none",
      },
    },
  ],
};
