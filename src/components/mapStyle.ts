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
      clusterMaxZoom: 14,
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
          6,
          3,
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
          "bus-red",
        ],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.08,
          8,
          0.12,
          12,
          0.2,
          14,
          0.25,
          18,
          0.35,
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
      id: "vehicle-follow-layer",
      type: "symbol",
      source: "vehicles",
      layout: {
        "icon-image": "green-marker-icon",
        "icon-size": 0.25,
        "icon-anchor": "bottom",
        "icon-offset": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["literal", [0, -30]], // At zoom 4, offset is [0, -30]
          18,
          ["literal", [0, -180]], // At zoom 18, offset is [0, -80]
        ],
        "icon-allow-overlap": true,
      },
      filter: ["==", ["get", "followed"], true],
    },
    {
      id: "delay",
      type: "symbol",
      source: "vehicles",
      minzoom: 13,
      layout: {
        "icon-image": [
          "step",
          ["get", "delay"],
          "green-light",
          120,
          "orange-light",
          300,
          "red-light", //
        ],
        "icon-size": 0.18,
        "icon-offset": [-100, -180],
        "icon-allow-overlap": true,
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
        visibility: "none",
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
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          0.25,
          15,
          0.2,
          17,
          0.17,
        ],
        "icon-allow-overlap": true,
        visibility: "none",
        "icon-offset": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["literal", [-50, 0]],
          12,
          ["literal", [-150, 0]],
          18,
          ["literal", [-400, 0]],
        ],
      },
    },
    {
      id: "vehicle-update-interval-skull-layer",
      type: "symbol",
      source: "vehicles",
      filter: [">=", ["get", "updateInterval"], 30000],
      layout: {
        "icon-image": [
          "case",
          [">", ["get", "updateInterval"], 3600000],
          "red-skull-marker",
          "skull-marker",
        ],
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
    {
      id: "occupancy-layer",
      type: "symbol",
      source: "vehicles",
      layout: {
        "icon-image": [
          "match",
          ["get", "occupancyStatus"],
          "empty",
          "occupancy0",
          "manySeatsAvailable",
          "occupancy1",
          "fewSeatsAvailable",
          "occupancy2",
          "standingRoomOnly",
          "occupancy3",
          "crushedStandingRoomOnly",
          "occupancy4",
          "full",
          "occupancy5",
          "notAcceptingPassengers",
          "occupancy6",
          "",
        ],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.14,
          8,
          0.16,
          12,
          0.2,
          14,
          0.25,
          18,
          0.25,
        ],
        "icon-offset": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["literal", [0, 60]],
          8,
          ["literal", [0, 90]],
          12,
          ["literal", [0, 120]],
          14,
          ["literal", [0, 130]],
          18,
          ["literal", [0, 140]],
        ],
        "icon-allow-overlap": true,
        visibility: "none",
      },
    },
  ],
};
