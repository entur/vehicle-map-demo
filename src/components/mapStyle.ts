import {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  EDGE_INK,
  EDGE_WHITE,
  ROUTE,
  SELECTION_HALO,
  SEVERITY_MUTED,
  SEVERITY_NOTABLE,
  SEVERITY_SEVERE,
  TRACE,
} from "../domain/dataColours.ts";
import {
  SCHEME_PAINT,
  baseLayerVisibility,
  transitNetworkPaint,
} from "../domain/baseMapScheme.ts";
import {
  FERRY_FILTER,
  FERRY_LABEL_LAYER,
  FERRY_LINE_LAYER,
  STATION_FILTER,
  STATION_LABEL_LAYER,
  STATION_LAYER,
  STOP_FILTER,
  STOP_LABEL_LAYER,
  STOP_LAYER,
  STOP_MIN_ZOOM,
  TRANSIT_LINE_FILTER,
  TRANSIT_LINE_LAYER,
} from "../domain/transitNetwork.ts";
import {
  BEARING_ARROW_ICON,
  FOLLOW_BADGE_ICON,
  VEHICLE_DOT_COLOUR_MATCH,
  VEHICLE_DOT_SORT_KEY,
  VEHICLE_ICON_MATCH,
} from "../domain/vehicleIcons.ts";
import {
  vehicleLabelAnchor,
  vehicleLabelOffset,
} from "../domain/vehicleLabelPlacement.ts";
import {
  BASE_MAP_GLYPHS,
  BASE_MAP_SOURCES,
  BASE_MAP_SPRITE,
  MAP_SCHEMES,
  MapScheme,
  baseMapLayers,
} from "./basemap/basemap.ts";

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

/**
 * How solid the schedule ghost is, icon and model alike: faint enough never
 * to be taken for a vehicle, solid enough to find.
 */
export const SCHEDULE_GHOST_OPACITY = 0.45;

/**
 * Zoom from which a vehicle's bearing is drawn as an arrow on its icon's edge.
 * The arrow fades out with the icon, since the 3D model shows heading itself.
 */
export const VEHICLE_BEARING_MIN_ZOOM = 13;

/**
 * Zoom from which `vehicle-layer` draws line-code labels. Below it the text
 * field is empty rather than merely transparent, so the national view does not
 * shape and place thousands of labels nobody can see on every vehicle frame.
 */
export const VEHICLE_LABEL_MIN_ZOOM = 13;

/**
 * Zoom below which vehicles are dots coloured by mode instead of icons, and
 * across whose last half level the two cross-fade. Zoomed out, thousands of
 * icons pile into one mass that shows neither how many vehicles there are nor
 * which modes; dots keep every vehicle where it is, unlike clustering, which
 * would hide the positions a look at the feed is for.
 */
export const VEHICLE_DOT_MAX_ZOOM = 10;

/**
 * Zoom from which the selected journey's stops are named. Further out a
 * journey's names overlap each other and the base map's place names.
 */
const JOURNEY_STOP_LABEL_MIN_ZOOM = 12;

/**
 * The journey stops' size as `[zoom, px]` stops. The white edge's radius is
 * derived from both, so the ring stays one width at every zoom.
 */
const JOURNEY_STOP_RADIUS: [number, number][] = [
  [8, 3.5],
  [13, 6],
  [17, 9],
];
const JOURNEY_STOP_STROKE: [number, number][] = [
  [8, 1.5],
  [13, 2],
  [17, 2],
];
/** The white outer ring's width beyond the ink stroke. */
const JOURNEY_STOP_EDGE = 1.5;

/**
 * Calls already made are faded, as the timetable fades them. The dots stay
 * at every zoom: from `VEHICLE_MODEL_MIN_ZOOM` they mark the quay at the foot
 * of each 3D stop pole (`stopPoleLayers`), which deck.gl draws over them.
 */
const JOURNEY_STOP_OPACITY: ExpressionSpecification = [
  "case",
  ["get", "passed"],
  0.55,
  1,
];

function zoomInterpolation(stops: [number, number][]): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], ...stops.flat()];
}

/** `vehicle-layer`'s icon-size, shared so the arrow stays at the circle's edge. */
const VEHICLE_ICON_SIZE_EXPRESSION: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  0.42,
  12,
  0.62,
];

/** Every app text layer's font — the one OpenFreeMap's glyph server has. */
const APP_TEXT_FONT = ["Noto Sans Regular"];

/**
 * Resting opacities of the ordinary situation layers. SituationLayers reads
 * these when it dims everything but the selected situation, so the style and
 * the dimming expression cannot disagree about what "undimmed" is. A feature's
 * edge layers are listed too, so an edge dims with the fill it outlines.
 */
export const SITUATION_LAYER_OPACITY = {
  "situation-lines-outer-casing-layer": { "line-opacity": 0.9 },
  "situation-lines-casing-layer": { "line-opacity": 0.9 },
  "situation-lines-layer": { "line-opacity": 0.7 },
  "situation-points-edge-layer": { "circle-opacity": 1 },
  "situation-points-layer": {
    "circle-opacity": 0.85,
    "circle-stroke-opacity": 1,
  },
} as const;

/**
 * Both base maps, with `scheme`'s visible — see BaseMapScheme for later
 * switches. Split into the two groups the style interleaves the 3D base
 * layers between (see the layers array below): ordinary layers, then symbol
 * (label) layers. Each scheme keeps its own snapshot's relative order within
 * a group — light before dark in both, matching MAP_SCHEMES — so a Fiord
 * line layer that follows a symbol layer in its snapshot (a few boundary
 * lines do) moves below the labels along with the rest of its group. That is
 * accepted: label legibility wins, and only one scheme is visible at a time.
 */
function baseMapFor(scheme: MapScheme): {
  nonSymbol: LayerSpecification[];
  symbol: LayerSpecification[];
} {
  const visibility = new Map(baseLayerVisibility(scheme));
  const layers = MAP_SCHEMES.flatMap(baseMapLayers).map(
    (layer) =>
      ({
        ...layer,
        layout: {
          ...((layer as { layout?: object }).layout ?? {}),
          visibility: visibility.get(layer.id),
        },
      }) as LayerSpecification,
  );
  return {
    nonSymbol: layers.filter((layer) => layer.type !== "symbol"),
    symbol: layers.filter((layer) => layer.type === "symbol"),
  };
}

/** A tunnel is drawn faint: the line is there, but not on the surface. */
const TUNNEL_OPACITY: ExpressionSpecification = [
  "case",
  ["==", ["get", "brunnel"], "tunnel"],
  0.35,
  1,
];

/**
 * The transit network (src/domain/transitNetwork.ts), in the three groups the
 * style interleaves it into, with `scheme`'s colours from transitNetworkPaint.
 * Visible at mount; TransitNetworkLayers owns visibility from then on.
 */
function transitNetworkFor(scheme: MapScheme): {
  lines: LayerSpecification[];
  points: LayerSpecification[];
  labels: LayerSpecification[];
} {
  const lines: LayerSpecification[] = [
    {
      id: TRANSIT_LINE_LAYER,
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 7,
      filter: TRANSIT_LINE_FILTER,
      layout: { "line-join": "round", visibility: "visible" },
      paint: {
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          0.6,
          12,
          1.4,
          16,
          2.5,
        ],
        "line-opacity": TUNNEL_OPACITY,
      },
    },
    {
      id: FERRY_LINE_LAYER,
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      filter: FERRY_FILTER,
      layout: { "line-join": "round", visibility: "visible" },
      paint: {
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 14, 2],
        "line-dasharray": [3, 2],
      },
    },
  ];
  const points: LayerSpecification[] = [
    {
      id: STOP_LAYER,
      type: "circle",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: STOP_MIN_ZOOM,
      filter: STOP_FILTER,
      layout: { visibility: "visible" },
      paint: {
        "circle-radius": 3,
        "circle-stroke-width": 1.5,
        "circle-pitch-alignment": "map",
      },
    },
    {
      id: STATION_LAYER,
      type: "circle",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 11,
      filter: STATION_FILTER,
      layout: { visibility: "visible" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 5.5],
        "circle-stroke-width": 1.5,
        "circle-pitch-alignment": "map",
      },
    },
  ];
  const labels: LayerSpecification[] = [
    {
      id: FERRY_LABEL_LAYER,
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 11,
      filter: FERRY_FILTER,
      layout: {
        visibility: "visible",
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": APP_TEXT_FONT,
        "text-size": 11,
      },
      paint: { "text-halo-width": 1.2 },
    },
    {
      id: STOP_LABEL_LAYER,
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: STOP_MIN_ZOOM,
      filter: STOP_FILTER,
      layout: {
        visibility: "visible",
        "text-field": ["get", "name"],
        "text-font": APP_TEXT_FONT,
        "text-size": 10.5,
        "text-anchor": "top",
        "text-offset": [0, 0.5],
        "text-max-width": 8,
      },
      paint: { "text-halo-width": 1.2 },
    },
    {
      id: STATION_LABEL_LAYER,
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 12,
      filter: STATION_FILTER,
      layout: {
        visibility: "visible",
        "text-field": ["get", "name"],
        "text-font": APP_TEXT_FONT,
        "text-size": 12,
        "text-anchor": "top",
        "text-offset": [0, 0.6],
        "text-max-width": 8,
      },
      paint: { "text-halo-width": 1.2 },
    },
  ];

  const byId = new Map(
    [...lines, ...points, ...labels].map((layer) => [layer.id, layer]),
  );
  for (const [id, property, value] of transitNetworkPaint(scheme)) {
    const layer = byId.get(id) as { paint: Record<string, unknown> };
    layer.paint[property] = value;
  }
  return { lines, points, labels };
}

/**
 * The app's one style, for the colour scheme in force when the map mounts.
 * Build it once per mount and never hand `<Map>` a new one: a changed style
 * object makes react-map-gl call setStyle, which resets GeoJSON data, layer
 * visibility and registered images. Later scheme changes go through
 * BaseMapScheme.
 */
export function buildMapStyle(scheme: MapScheme): StyleSpecification {
  const paint = SCHEME_PAINT[scheme];
  const base = baseMapFor(scheme);
  const transit = transitNetworkFor(scheme);
  return {
    version: 8,
    glyphs: BASE_MAP_GLYPHS,
    sprite: BASE_MAP_SPRITE,
    // Only visible once the camera is tilted far enough to see the horizon, so
    // it has no effect on the flat 2D view.
    sky: paint.sky,
    sources: {
      // openmaptiles also feeds buildings-3d-layer.
      ...BASE_MAP_SOURCES,
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
      // The same outlines a metre larger, ringing the selected model. Written
      // alongside `vehicles` by VehicleMarkers; filtered by SelectedVehicleHalo.
      vehicleOutlines: {
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
      // The stops the selected journey calls at. Written by RouteLayer.
      serviceJourneyStops: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      // The selected vehicle's schedule ghost and the link from it to the
      // vehicle. Written by ScheduleGhost.
      scheduleGhost: {
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
      ...base.nonSymbol,
      ...transit.lines,
      // The two 3D-only base layers sit between the base map's ordinary
      // layers and its symbol (label) layers: below every data layer, so
      // buildings never cover a vehicle or a situation, and below every
      // base-map label, so hillshading and building extrusions never shade
      // or cover street and place names.
      {
        id: "hillshade-layer",
        type: "hillshade",
        source: "hillshade",
        layout: { visibility: "none" },
        paint: {
          "hillshade-exaggeration": 0.3,
          "hillshade-shadow-color": paint.hillshadeShadow,
        },
      },
      // Beneath buildings-3d-layer, so in 3D a building hides the stops
      // behind it, as it hides the street they are on. Above hillshade, so the
      // circles are never shaded.
      ...transit.points,
      {
        id: "buildings-3d-layer",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        filter: ["!=", ["get", "hide_3d"], true],
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": paint.buildings,
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
      ...base.symbol,
      ...transit.labels,
      // Two-tone edge (dataColours.ts): ink separates the route on the light
      // base map, white on the dark one. Solid even when the route is dashed
      // for a cancelled trip, so the dashes read against a continuous band.
      {
        id: "service-journey-route-outer-casing-layer",
        type: "line",
        source: "serviceJourneyRoute",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": EDGE_WHITE,
          "line-width": 10,
          "line-opacity": 1,
        },
      },
      {
        id: "service-journey-route-casing-layer",
        type: "line",
        source: "serviceJourneyRoute",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": EDGE_INK,
          "line-width": 7,
          "line-opacity": 1,
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
          "line-color": ROUTE,
          "line-width": 4,
          "line-opacity": 1,
        },
      },
      // The selected journey's stops, drawn as the route is: ROUTE inside an
      // ink ring, inside a white one (the edge layer below), so they read as
      // part of the route on either base map rather than as the transit
      // network's neutral stops. Calls already made are faded, as in the
      // timetable; a cancelled call is filled in the cancellation colour the
      // timetable strikes its name through with.
      {
        id: "service-journey-stops-edge-layer",
        type: "circle",
        source: "serviceJourneyStops",
        paint: {
          "circle-radius": zoomInterpolation(
            JOURNEY_STOP_RADIUS.map(([zoom, radius], i) => [
              zoom,
              radius + JOURNEY_STOP_STROKE[i][1] + JOURNEY_STOP_EDGE,
            ]),
          ),
          "circle-color": EDGE_WHITE,
          "circle-opacity": JOURNEY_STOP_OPACITY,
          "circle-pitch-alignment": "map",
        },
      },
      {
        id: "service-journey-stops-layer",
        type: "circle",
        source: "serviceJourneyStops",
        paint: {
          "circle-radius": zoomInterpolation(JOURNEY_STOP_RADIUS),
          "circle-color": [
            "case",
            ["get", "cancelled"],
            SEVERITY_SEVERE,
            ROUTE,
          ],
          "circle-stroke-color": EDGE_INK,
          "circle-stroke-width": zoomInterpolation(JOURNEY_STOP_STROKE),
          "circle-opacity": JOURNEY_STOP_OPACITY,
          "circle-stroke-opacity": JOURNEY_STOP_OPACITY,
          "circle-pitch-alignment": "map",
        },
      },
      {
        id: "service-journey-stop-labels-layer",
        type: "symbol",
        source: "serviceJourneyStops",
        minzoom: JOURNEY_STOP_LABEL_MIN_ZOOM,
        layout: {
          "text-field": ["get", "name"],
          "text-font": APP_TEXT_FONT,
          "text-size": 12,
          "text-anchor": "left",
          // Clear of the dot's white edge, which grows with the zoom.
          "text-offset": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            ["literal", [1.05, 0]],
            17,
            ["literal", [1.35, 0]],
          ],
          "text-max-width": 10,
          // Earlier calls win a collision, so a stop visited twice is named
          // once and the names along the route are placed in order.
          "symbol-sort-key": ["get", "order"],
        },
        paint: {
          "text-color": paint.journeyStopText,
          "text-halo-color": paint.journeyStopTextHalo,
          "text-halo-width": 1.5,
          "text-opacity": JOURNEY_STOP_OPACITY,
        },
      },
      // Halo layers sit under the ordinary situation layers and are filtered to
      // the selected situation by SituationLayers, the way vehicle-follow-layer
      // is filtered to the followed vehicle. The colour is neither a severity
      // colour nor an edge colour, so the feature on top still reads.
      {
        id: "situation-lines-halo-layer",
        type: "line",
        source: "situationLines",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": SELECTION_HALO,
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
          "circle-color": SELECTION_HALO,
          "circle-opacity": 0.25,
          "circle-stroke-width": 3,
          "circle-stroke-color": SELECTION_HALO,
        },
        filter: ["boolean", false],
      },
      // Two-tone edge under the coloured line (dataColours.ts): the white outer
      // casing separates it on the dark base map, the ink casing on the light
      // one. Separation only — it carries no meaning.
      {
        id: "situation-lines-outer-casing-layer",
        type: "line",
        source: "situationLines",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: {
          "line-color": EDGE_WHITE,
          "line-width": 11,
          ...SITUATION_LAYER_OPACITY["situation-lines-outer-casing-layer"],
        },
      },
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
          "line-color": EDGE_INK,
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
      // White ring under the point's ink stroke: the two-tone edge.
      {
        id: "situation-points-edge-layer",
        type: "circle",
        source: "situationPoints",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 11,
          "circle-color": EDGE_WHITE,
          ...SITUATION_LAYER_OPACITY["situation-points-edge-layer"],
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
          "circle-stroke-width": 2,
          "circle-stroke-color": EDGE_INK,
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
          "line-color": TRACE,
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
      // The schedule ghost, under the vehicles so the real one is always on
      // top. The link is a two-tone edge (dataColours.ts): white under ink
      // dashes, legible on both base maps without a colour of its own.
      {
        id: "schedule-ghost-link-casing-layer",
        type: "line",
        source: "scheduleGhost",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round" },
        paint: { "line-color": EDGE_WHITE, "line-width": 4 },
      },
      {
        id: "schedule-ghost-link-layer",
        type: "line",
        source: "scheduleGhost",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": EDGE_INK,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      },
      // The vehicle's own icon, faded, and gone where the models take over —
      // VehicleModels draws the ghost's model from there.
      {
        id: "schedule-ghost-layer",
        type: "symbol",
        source: "scheduleGhost",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "icon-image": VEHICLE_ICON_MATCH,
          "icon-size": VEHICLE_ICON_SIZE_EXPRESSION,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_MODEL_MIN_ZOOM,
            SCHEDULE_GHOST_OPACITY,
            VEHICLE_MODEL_MIN_ZOOM + 0.5,
            0,
          ],
        },
      },
      // The selection on a model: its footprint a metre larger, flat on the
      // ground under it, turning with it and true to scale, where the screen-
      // sized circle of vehicle-selected-halo-layer no longer fits. Fades in as
      // that circle and the icons fade out. Filtered to the selection by
      // SelectedVehicleHalo; declared before the models' beforeId, so it is
      // drawn under them.
      {
        id: "vehicle-selected-outline-fill-layer",
        type: "fill",
        source: "vehicleOutlines",
        minzoom: VEHICLE_MODEL_MIN_ZOOM,
        paint: {
          "fill-color": SELECTION_HALO,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_MODEL_MIN_ZOOM,
            0,
            VEHICLE_MODEL_MIN_ZOOM + 0.5,
            0.25,
          ],
        },
        filter: ["boolean", false],
      },
      {
        id: "vehicle-selected-outline-layer",
        type: "line",
        source: "vehicleOutlines",
        minzoom: VEHICLE_MODEL_MIN_ZOOM,
        layout: { "line-join": "round" },
        paint: {
          "line-color": SELECTION_HALO,
          "line-width": 3,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_MODEL_MIN_ZOOM,
            0,
            VEHICLE_MODEL_MIN_ZOOM + 0.5,
            1,
          ],
        },
        filter: ["boolean", false],
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
        id: "vehicle-dot-layer",
        type: "circle",
        source: "vehicles",
        maxzoom: VEHICLE_DOT_MAX_ZOOM,
        layout: { "circle-sort-key": VEHICLE_DOT_SORT_KEY },
        paint: {
          "circle-color": VEHICLE_DOT_COLOUR_MATCH,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            3.5,
            VEHICLE_DOT_MAX_ZOOM,
            5.5,
          ],
          "circle-stroke-color": paint.vehicleDotEdge,
          "circle-stroke-width": 1,
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_DOT_MAX_ZOOM - 0.5,
            1,
            VEHICLE_DOT_MAX_ZOOM,
            0,
          ],
          "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_DOT_MAX_ZOOM - 0.5,
            1,
            VEHICLE_DOT_MAX_ZOOM,
            0,
          ],
        },
      },
      // Rings the selected vehicle's dot or icon. Above the dots, so a selection in a dense
      // cluster is not buried under its neighbours, and below the icons, the
      // arrows and the line-code labels, which the ring's radius — a few
      // pixels outside the dot, then the icon — keeps clear of. Filtered to the
      // selection by SelectedVehicleHalo.
      {
        id: "vehicle-selected-halo-layer",
        type: "circle",
        source: "vehicles",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            9,
            VEHICLE_DOT_MAX_ZOOM - 0.5,
            11,
            VEHICLE_DOT_MAX_ZOOM,
            20,
            12,
            22,
          ],
          "circle-color": SELECTION_HALO,
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_MODEL_MIN_ZOOM,
            0.2,
            VEHICLE_MODEL_MIN_ZOOM + 0.5,
            0,
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": SELECTION_HALO,
          // Hands over to the footprint outline as the models take over.
          "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_MODEL_MIN_ZOOM,
            1,
            VEHICLE_MODEL_MIN_ZOOM + 0.5,
            0,
          ],
          "circle-pitch-alignment": "viewport",
        },
        filter: ["boolean", false],
      },
      // Below vehicle-layer and centred on the same point at the same size, so
      // the arrowhead sits just outside the icon's circle. Vehicles without a
      // usable bearing (a null property, set by VehicleMarkers) get no arrow.
      {
        id: "vehicle-bearing-layer",
        type: "symbol",
        source: "vehicles",
        minzoom: VEHICLE_BEARING_MIN_ZOOM - 0.5,
        filter: ["==", ["typeof", ["get", "bearing"]], "number"],
        layout: {
          "icon-image": BEARING_ARROW_ICON,
          "icon-size": VEHICLE_ICON_SIZE_EXPRESSION,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          // Upright like the icon it rings, even when the map is pitched.
          "icon-pitch-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_BEARING_MIN_ZOOM - 0.5,
            0,
            VEHICLE_BEARING_MIN_ZOOM,
            1,
            VEHICLE_MODEL_MIN_ZOOM,
            1,
            VEHICLE_MODEL_MIN_ZOOM + 0.5,
            0,
          ],
        },
      },
      {
        id: "vehicle-layer",
        type: "symbol",
        source: "vehicles",
        minzoom: VEHICLE_DOT_MAX_ZOOM - 0.5,
        layout: {
          "icon-image": VEHICLE_ICON_MATCH,
          // Icons are 52 logical px across at size 1 (drawVehicleIcon.ts):
          // ≈22px at zoom 4 growing to ≈32px from zoom 12.
          "icon-size": VEHICLE_ICON_SIZE_EXPRESSION,
          "icon-allow-overlap": true,
          "text-field": [
            "step",
            ["zoom"],
            "",
            VEHICLE_LABEL_MIN_ZOOM,
            ["get", "lineCode"],
          ],
          "text-size": 14,
          "text-font": APP_TEXT_FONT,
          // Behind the vehicle, clear of the bearing arrow. Built for a
          // north-up map; VehicleLabelPlacement rebuilds both as the map turns.
          "text-anchor": vehicleLabelAnchor(0),
          "text-offset": vehicleLabelOffset(0),
          "text-allow-overlap": true,
        },
        paint: {
          "icon-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            VEHICLE_DOT_MAX_ZOOM - 0.5,
            0,
            VEHICLE_DOT_MAX_ZOOM,
            1,
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
        },
      },
      {
        id: "vehicle-follow-layer",
        type: "symbol",
        source: "vehicles",
        // Same size and centre as vehicle-layer's icon, so the badge stays on
        // its edge (drawFollowBadge) at every zoom.
        layout: {
          "icon-image": FOLLOW_BADGE_ICON,
          "icon-size": VEHICLE_ICON_SIZE_EXPRESSION,
          "icon-pitch-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
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
          "icon-size": 0.16,
          "icon-offset": [-60, -110],
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
          "text-font": APP_TEXT_FONT,
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
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            15,
            3,
          ],
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
}
