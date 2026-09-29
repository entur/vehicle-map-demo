import {
  ExpressionSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  SEVERITY_MUTED,
  SEVERITY_NOTABLE,
  SEVERITY_SEVERE,
} from "./SelectedVehiclePanel/situationSeverity.ts";

// Same mapping as severityColour(): only noImpact is greyed, and the literal
// string "undefined" — 48% of the live feed — stays in the notable colour
// because those are real incident messages.
const severityColourExpression: ExpressionSpecification = [
  "match",
  ["get", "severity"],
  ["severe", "verySevere"],
  SEVERITY_SEVERE,
  "noImpact",
  SEVERITY_MUTED,
  SEVERITY_NOTABLE,
];

/** Zoom at which vehicle icons start cross-fading into 3D models. */
export const VEHICLE_MODEL_MIN_ZOOM = 16;

/** Ring and casing colour for the selected situation's features. */
const SITUATION_SELECTION_HALO = "#2f6fed";

/**
 * Resting opacities of the ordinary situation layers. SituationLayers reads
 * these when it dims everything but the selected situation, so the style and
 * the dimming expression cannot disagree about what "undimmed" is.
 */
export const SITUATION_LAYER_OPACITY = {
  "situation-lines-casing-layer": { "line-opacity": 0.9 },
  "situation-lines-layer": { "line-opacity": 0.7 },
  "situation-points-layer": {
    "circle-opacity": 0.85,
    "circle-stroke-opacity": 1,
  },
} as const;

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  // Only visible once the camera is tilted far enough to see the horizon, so
  // it has no effect on the flat 2D view.
  sky: {
    "sky-color": "#b9d7ee",
    "horizon-color": "#eef3f6",
    "sky-horizon-blend": 0.6,
  },
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap Contributors",
      maxzoom: 19,
    },
    // 3D view only (see src/domain/viewDimension.ts). Both keyless. Terrain and
    // hillshade read the same tiles through two sources, because MapLibre
    // warns that one raster-dem source serving both degrades its tile cache.
    terrain: {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      encoding: "terrarium",
      tileSize: 512,
      maxzoom: 15,
    },
    hillshade: {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      encoding: "terrarium",
      tileSize: 512,
      maxzoom: 15,
    },
    // Vector tiles for building footprints and heights only; the base map
    // stays the OSM raster so the 2D view is unchanged.
    openfreemap: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a>',
    },
    vehicles: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: false,
      clusterMaxZoom: 14,
      clusterRadius: 5,
    },
    // Box-with-a-nose outlines, one per vehicle, extruded by
    // vehicle-model-layer. Written alongside `vehicles` by VehicleMarkers.
    vehicleModels: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    vehicleTraces: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    serviceJourneyRoute: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    situationLines: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    situationPoints: {
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
    // The two 3D-only base layers sit directly on the raster, beneath every
    // data layer, so buildings never cover a vehicle or a situation.
    {
      id: "hillshade-layer",
      type: "hillshade",
      source: "hillshade",
      layout: { visibility: "none" },
      paint: {
        "hillshade-exaggeration": 0.3,
        "hillshade-shadow-color": "#473b24",
      },
    },
    {
      id: "buildings-3d-layer",
      type: "fill-extrusion",
      source: "openfreemap",
      "source-layer": "building",
      minzoom: 14,
      filter: ["!=", ["get", "hide_3d"], true],
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": "#d6d0c8",
        // OpenMapTiles estimates render_height from levels when no height is
        // tagged; 8 m covers footprints with neither.
        "fill-extrusion-height": [
          "max",
          3,
          ["coalesce", ["get", "render_height"], 8],
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15,
          0.85,
        ],
        "fill-extrusion-vertical-gradient": true,
      },
    },
    {
      id: "service-journey-route-layer",
      type: "line",
      source: "serviceJourneyRoute",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#1fcac2",
        "line-width": 4,
        "line-opacity": 0.85,
      },
    },
    // Halo layers sit under the ordinary situation layers and are filtered to
    // the selected situation by SituationLayers, the way vehicle-follow-layer
    // is filtered to the followed vehicle. The colour is neither a severity
    // colour nor the INCIDENT stroke, so the feature on top still reads.
    {
      id: "situation-lines-halo-layer",
      type: "line",
      source: "situationLines",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": SITUATION_SELECTION_HALO,
        // Wide enough to ring the casing below the coloured line rather than
        // being swallowed by it.
        "line-width": 16,
        "line-opacity": 0.6,
      },
      filter: ["boolean", false],
    },
    {
      id: "situation-points-halo-layer",
      type: "circle",
      source: "situationPoints",
      paint: {
        "circle-radius": 13,
        "circle-color": SITUATION_SELECTION_HALO,
        "circle-opacity": 0.25,
        "circle-stroke-width": 3,
        "circle-stroke-color": SITUATION_SELECTION_HALO,
      },
      filter: ["boolean", false],
    },
    // A dark casing under the coloured line, the same figure/ground trick the
    // point layer gets from its circle-stroke. Without it a span is a 4px
    // stroke in the severity palette — #e07a1f orange, #c0392b red, #999999
    // grey — over an OSM raster that paints its secondary roads, motorways and
    // residential casings in those same three families, so in a city the line
    // reads as one more road. Unlike the points' stroke this carries no
    // meaning: reportType stays theirs alone, and this is only separation.
    {
      id: "situation-lines-casing-layer",
      type: "line",
      source: "situationLines",
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "none",
      },
      paint: {
        "line-color": "#2b2b2b",
        "line-width": 8,
        ...SITUATION_LAYER_OPACITY["situation-lines-casing-layer"],
      },
    },
    {
      id: "situation-lines-layer",
      type: "line",
      source: "situationLines",
      layout: {
        visibility: "none",
      },
      paint: {
        "line-color": severityColourExpression,
        "line-width": 4,
        ...SITUATION_LAYER_OPACITY["situation-lines-layer"],
      },
    },
    {
      id: "situation-points-layer",
      type: "circle",
      source: "situationPoints",
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": 7,
        "circle-color": severityColourExpression,
        ...SITUATION_LAYER_OPACITY["situation-points-layer"],
        // reportType is uppercase in this API. Stroke carries it so the fill
        // stays free for severity, avoiding an icon sprite pipeline.
        "circle-stroke-width": [
          "case",
          ["==", ["get", "reportType"], "INCIDENT"],
          2,
          1,
        ],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "reportType"], "INCIDENT"],
          "#2b2b2b",
          "#ffffff",
        ],
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
    // Click target for the 3D vehicle models, which deck.gl draws (see
    // VehicleModels). Never visible: at opacity 0 MapLibre skips drawing it but
    // still hit-tests the extruded footprint, so a click on a model selects the
    // vehicle through the same queryRenderedFeatures path as the icon.
    {
      id: "vehicle-model-layer",
      type: "fill-extrusion",
      source: "vehicleModels",
      minzoom: VEHICLE_MODEL_MIN_ZOOM,
      paint: {
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0,
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
          "ufo",
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
        "icon-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          VEHICLE_MODEL_MIN_ZOOM,
          1,
          VEHICLE_MODEL_MIN_ZOOM + 0.5,
          0,
        ],
        // The line's published text and line colour, as a pair or not at all
        // — see `labelColoursFor`.
        "text-color": ["coalesce", ["get", "lineTextColour"], "#000"],
        "text-halo-color": ["coalesce", ["get", "lineHaloColour"], "#FFF"],
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
