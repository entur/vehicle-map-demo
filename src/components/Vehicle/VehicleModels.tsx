import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useControl, useMap } from "react-map-gl/maplibre";
import { MapLibreOverlay } from "@deck.gl/maplibre";
import { useColorScheme } from "@mui/material/styles";
import type { Layer } from "@deck.gl/core";
import { VehicleUpdate } from "../../types.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";
import { mapSchemeFor } from "../../domain/baseMapScheme.ts";
import { SCHEDULE_GHOST_OPACITY, VEHICLE_MODEL_MIN_ZOOM } from "../mapStyle.ts";
import {
  MODEL_BEFORE_LAYER,
  ModelLayerOptions,
  vehicleModelLayers,
} from "./vehicleModelLayers.ts";
import { withLayerAsStyleLoaded } from "../../utils/withLayerAsStyleLoaded.ts";
import { cappedViewBounds, viewCamera } from "../../utils/cappedViewBounds.ts";
import {
  ViewBounds,
  referenceReachMetres,
  vehiclesInView,
} from "../../domain/vehiclesInView.ts";
import {
  ChaseModelArea,
  chaseModelArea,
  vehiclesNear,
} from "../../domain/chaseCamera.ts";
import { VehicleStore } from "./chasedVehicleStore.ts";
import { VehicleGround, vehicleGround } from "../../domain/vehicleGround.ts";
import {
  dimensionsFor,
  normaliseBearing,
} from "../../domain/vehicleFootprint.ts";
import { LIGHT_POOL_REACH } from "../../domain/lightPool.ts";
import { StopPole, polesInView } from "../../domain/journeyStops.ts";
import type { MapSourceDataEvent } from "maplibre-gl";
import { stopPoleLayers } from "./stopPoleLayers.ts";
import { flagDesignFor, type Season } from "../../domain/season.ts";
import { useSeasonalDecorations } from "../Seasonal/useSeasonalDecorations.ts";
import { useSeasonalFlags } from "../Seasonal/useSeasonalFlags.ts";
import { useSeasonalFireworks } from "../Seasonal/useSeasonalFireworks.ts";
import { flagLayers, fliesFlags } from "../Seasonal/flagLayers.ts";
import { ANIMATION_TICK_MS } from "../Seasonal/animationClock.ts";

const NO_VEHICLES: VehicleUpdate[] = [];

const LEVEL: VehicleGround = {
  elevation: 0,
  pitch: 0,
  poolPitch: 0,
  complete: false,
};

/** The vehicles in `area`, or all of them before the chase has measured one. */
function vehiclesNearOf(
  vehicles: VehicleUpdate[],
  area: ChaseModelArea | null,
) {
  return area ? vehiclesNear(vehicles, area) : vehicles;
}

/** Fades the models in over the same half zoom level the icons fade out. */
function modelOpacity(zoom: number) {
  const t = (zoom - VEHICLE_MODEL_MIN_ZOOM) / 0.5;
  // Rounded so a zoom gesture re-renders at most twenty times across the fade.
  return Math.round(Math.min(1, Math.max(0, t)) * 20) / 20;
}

type Props = {
  /** The "Vehicles" switch. Off, no vehicle is drawn, but the stops still are. */
  showVehicles: boolean;
  data: VehicleUpdate[];
  viewDimension: ViewDimension;
  /** Cache key of the vehicle the chase camera draws itself, if any. */
  chasedVehicleKey: string | null;
  chasedVehicleStore: VehicleStore;
  /** The selected vehicle's schedule ghost, written by ScheduleGhost. */
  ghostStore: VehicleStore;
  /** The selected journey's stops, drawn as poles with name boards. */
  stopPoles: StopPole[];
  /** The season whose decorations stand near the stops or fly on the models, if any. */
  season: Season | null;
  /** New Year's fireworks over the map, drawn in 3D while the models are shown. */
  fireworks: boolean;
};

/**
 * True-scale 3D vehicle models, rendered by deck.gl interleaved with the
 * MapLibre style so buildings and terrain can hide them. Selection is not
 * handled here: clicks hit the invisible `vehicle-model-layer` footprints in
 * the style, which VehicleMarkers already listens to.
 *
 * A chased vehicle is left out of the ordinary layers and drawn from
 * `chasedVehicleStore` instead, at the position the chase camera interpolated
 * — otherwise its model would sit at the newest report, seconds ahead of the
 * camera. The schedule ghost is drawn the same way, from `ghostStore`, faded.
 *
 * The selected journey's stops are drawn here too, as poles, and the seasonal
 * decorations and flags: deck.gl keeps one interleaved overlay per map, so
 * everything 3D shares this one.
 */
export function VehicleModels({
  showVehicles,
  data,
  viewDimension,
  chasedVehicleKey,
  chasedVehicleStore,
  ghostStore,
  stopPoles,
  season,
  fireworks,
}: Props) {
  // StrictMode adds, removes and re-adds this control, so two Decks attach to
  // the map's one WebGL context. luma creates the device asynchronously, so
  // both pass its "already attached?" check and the second throws, leaving
  // no 3D at all. `_reuseDevices` hands the second the first's device — what
  // deck.gl itself passes when it creates a context, but not when it attaches
  // to one, and the interleaved overlay accepts no `device` of its own.
  // An underscore luma prop, but typed in DeviceProps; without it `npm run dev`
  // shows no 3D at all, while a production build (one mount) is unaffected.
  const overlay = useControl(
    () =>
      new MapLibreOverlay({
        interleaved: true,
        layers: [],
        deviceProps: { _reuseDevices: true },
      }),
  );
  const { current: mapRef } = useMap();
  const scheme = mapSchemeFor(useColorScheme().colorScheme);
  const [opacity, setOpacity] = useState(0);
  const baseLayers = useRef<Layer[]>([]);
  const chasedLayers = useRef<Layer[]>([]);
  const ghostLayers = useRef<Layer[]>([]);
  const stopLayers = useRef<Layer[]>([]);
  const seasonalLayers = useRef<Layer[]>([]);
  const flagLayersRef = useRef<Layer[]>([]);
  const fireworkLayersRef = useRef<Layer[]>([]);
  const options = useRef<Omit<ModelLayerOptions, "idPrefix"> | null>(null);

  // Every handover of layers goes through here, so that deck.gl can add its
  // layer group to the style while vehicle frames keep the map "loading".
  const handOver = useCallback(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    withLayerAsStyleLoaded(map, MODEL_BEFORE_LAYER, () =>
      overlay.setProps({
        layers: [
          ...baseLayers.current,
          ...chasedLayers.current,
          ...ghostLayers.current,
          ...stopLayers.current,
          ...seasonalLayers.current,
          ...flagLayersRef.current,
          ...fireworkLayersRef.current,
        ],
      }),
    );
  }, [mapRef, overlay]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const update = () => setOpacity(modelOpacity(map.getZoom()));
    update();
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [mapRef]);

  // The view the models are built for, read when a move ends. Not during a
  // chase: its camera moves every frame, and it keeps the data around the
  // vehicle itself.
  const chasing = chasedVehicleKey !== null;
  const [viewBounds, setViewBounds] = useState<ViewBounds | null>(null);
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || chasing) return;
    const update = () => setViewBounds(cappedViewBounds(map));
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [mapRef, chasing]);

  // During a chase, the circle around the vehicle that gets models. Its
  // centre is the map's: the chase's padding puts the vehicle there. Read on
  // every chase frame, but a new circle only every `CHASE_MODEL_STEP_M`.
  const [chaseArea, setChaseArea] = useState<ChaseModelArea | null>(null);
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !chasing) return;
    const update = () => {
      const camera = viewCamera(map);
      setChaseArea((area) =>
        chaseModelArea(
          area,
          { lon: camera.longitude, lat: camera.latitude },
          referenceReachMetres(camera),
        ),
      );
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
      setChaseArea(null);
    };
  }, [mapRef, chasing]);

  // Only vehicles in view get models. The data normally matches the view
  // already, but straight after a jump from the whole country to one street
  // it is still the country until the next frame: over a thousand layers,
  // which froze the page for seconds. During a chase only those near the
  // vehicle do: the chase's subscription box reaches kilometres.
  // With the Vehicles switch off it is the same empty list on every frame, so
  // the effect that builds the models does not run again for each one.
  const unchased = useMemo(
    () =>
      !showVehicles
        ? NO_VEHICLES
        : chasing
          ? vehiclesNearOf(
              data.filter(
                (vehicle) =>
                  vehicle.vehicleId + "_" + vehicle.serviceJourney.id !==
                  chasedVehicleKey,
              ),
              chaseArea,
            )
          : viewBounds
            ? vehiclesInView(data, viewBounds)
            : data,
    [showVehicles, data, chasing, chasedVehicleKey, viewBounds, chaseArea],
  );

  // The ground under each vehicle report — its height and slope. The vehicle
  // cache replaces a report's object only when a new one arrives, so a vehicle
  // that has not reported since the last frame is not looked up again — and
  // each report is looked up once, not once per model layer. Started afresh
  // when terrain comes or goes.
  const grounds = useMemo(
    () => ({
      viewDimension,
      byReport: new WeakMap<VehicleUpdate, VehicleGround>(),
    }),
    [viewDimension],
  );

  // How the models are drawn: one object until the zoom, scheme or terrain
  // changes, so the flags can be built with it as well.
  const modelOptions = useMemo((): Omit<
    ModelLayerOptions,
    "idPrefix"
  > | null => {
    const map = mapRef?.getMap();
    if (!map) return null;

    // The terrain under the vehicle, or level at sea level when there is no
    // terrain (2D) or its tiles have not loaded yet — the next vehicle frame
    // retries, since only a complete result is cached.
    const getGround = (vehicle: VehicleUpdate): VehicleGround => {
      const cached = grounds.byReport.get(vehicle);
      if (cached) return cached;
      const found = vehicleGround(
        (lngLat) => map.queryTerrainElevation(lngLat),
        [vehicle.location.longitude, vehicle.location.latitude],
        normaliseBearing(vehicle.bearing),
        dimensionsFor(vehicle.mode).length,
        LIGHT_POOL_REACH,
      );
      if (found?.complete) grounds.byReport.set(vehicle, found);
      return found ?? LEVEL;
    };
    return {
      visible: opacity > 0,
      opacity,
      scheme,
      getPosition: (vehicle) => [
        vehicle.location.longitude,
        vehicle.location.latitude,
        getGround(vehicle).elevation,
      ],
      getTilt: getGround,
      positionTrigger: viewDimension,
    };
  }, [mapRef, opacity, scheme, viewDimension, grounds]);

  useEffect(() => {
    if (!modelOptions) return;
    options.current = modelOptions;
    baseLayers.current = vehicleModelLayers(unchased, {
      ...modelOptions,
      idPrefix: "vehicle-models",
    });
    handOver();
  }, [handOver, unchased, modelOptions]);

  const onFlagLayers = useCallback(
    (layers: Layer[]) => {
      flagLayersRef.current = layers;
      handOver();
    },
    [handOver],
  );
  // Set by the chase's effect below; a flutter tick redraws the chased flags
  // through it unless a chase frame has just done so. `send` is false when
  // the tick hands over the other flags right after, which carries these.
  const publishChased = useRef<((send: boolean) => void) | null>(null);
  const chasedPublishedMs = useRef(0);
  const onChasedTick = useCallback((send: boolean) => {
    if (Date.now() - chasedPublishedMs.current < ANIMATION_TICK_MS) return;
    publishChased.current?.(send);
  }, []);
  // Asked of the vehicle the chase draws, not of `data`: the chase goes on
  // drawing its last report after the live cache has dropped the vehicle, and
  // its flags must not freeze then. A boolean, so a frame that changes
  // nothing about it renders nothing.
  const subscribeChased = useCallback(
    (listener: () => void) => chasedVehicleStore.subscribe(listener),
    [chasedVehicleStore],
  );
  const chasedDrawnFlagged = useSyncExternalStore(subscribeChased, () =>
    fliesFlags(chasedVehicleStore.get()),
  );
  const chasedFlagged =
    flagDesignFor(season) !== null && showVehicles && chasedDrawnFlagged;
  // Called here rather than in the effect above, which must not run on a
  // flutter tick: the flags tick on their own, from the same vehicles.
  const { flutterNow } = useSeasonalFlags({
    map: mapRef?.getMap(),
    season,
    vehicles: unchased,
    options: modelOptions,
    chasedFlagged,
    onLayers: onFlagLayers,
    onChasedTick,
  });

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    let shown: string | null = null;
    const build = () => {
      // Only the stops in view: each name board is a layer and a texture.
      const inView =
        opacity > 0 ? polesInView(stopPoles, cappedViewBounds(map)) : [];
      // Upright on the terrain's height at the stop, or at sea level in 2D.
      const elevations = inView.map(
        (pole) => map.queryTerrainElevation(pole.position) ?? 0,
      );
      const key = inView
        .map((pole, i) => `${pole.key}@${elevations[i]}`)
        .join(",");
      if (key === shown) return;
      shown = key;
      const elevationOf = new Map(
        inView.map((pole, i) => [pole, elevations[i]]),
      );
      stopLayers.current = stopPoleLayers(inView, {
        visible: opacity > 0,
        opacity,
        scheme,
        getPosition: (pole) => [...pole.position, elevationOf.get(pole) ?? 0],
        positionTrigger: key,
      });
      handOver();
    };
    build();
    if (opacity === 0 || stopPoles.length === 0) return;

    // Vehicles are placed again on every frame; the stops only when something
    // could have moved them: the camera (other stops in view, other terrain
    // under them), terrain coming or going — it is set after this effect when
    // 3D is chosen — and a terrain tile loading, since MapLibre answers 0, not
    // nothing, for a tile still loading. Nothing runs while nothing changes.
    const onSourceData = (event: MapSourceDataEvent) => {
      if (event.tile && event.sourceId === map.getTerrain()?.source) build();
    };
    map.on("moveend", build);
    map.on("terrain", build);
    map.on("sourcedata", onSourceData);
    return () => {
      map.off("moveend", build);
      map.off("terrain", build);
      map.off("sourcedata", onSourceData);
    };
  }, [handOver, mapRef, stopPoles, opacity, scheme]);

  useEffect(() => {
    const flagDesign = flagDesignFor(season);
    const publish = (send = true) => {
      chasedPublishedMs.current = Date.now();
      const vehicle = chasedVehicleStore.get();
      // A new object every frame, so the cache never hits; look the ground up
      // once here rather than once per model layer.
      const position = vehicle && options.current?.getPosition(vehicle);
      const tilt = vehicle && options.current?.getTilt(vehicle);
      if (!(vehicle && options.current && position && tilt && showVehicles)) {
        chasedLayers.current = [];
      } else {
        const chased = {
          ...options.current,
          getPosition: () => position,
          getTilt: () => tilt,
          // A new position every frame, so a new trigger every frame.
          positionTrigger: position,
        };
        chasedLayers.current = [
          ...vehicleModelLayers([vehicle], {
            ...chased,
            idPrefix: "vehicle-models-chased",
          }),
          // Rebuilt every frame with the rest, so the flags need no tick.
          ...(flagDesign
            ? flagLayers([vehicle], {
                ...chased,
                idPrefix: "vehicle-flags-chased",
                flutter: flutterNow(),
                design: flagDesign,
              })
            : []),
        ];
      }
      if (send) handOver();
    };
    publish();
    publishChased.current = publish;
    const unsubscribe = chasedVehicleStore.subscribe(() => publish());
    return () => {
      unsubscribe();
      publishChased.current = null;
      chasedLayers.current = [];
    };
  }, [handOver, chasedVehicleStore, showVehicles, season, flutterNow]);

  useEffect(() => {
    const publish = () => {
      const ghost = ghostStore.get();
      // Nothing to hand over while there was no ghost and still is none.
      if (!ghost && ghostLayers.current.length === 0) return;
      const position = ghost && options.current?.getPosition(ghost);
      const tilt = ghost && options.current?.getTilt(ghost);
      ghostLayers.current =
        ghost && options.current && position && tilt && showVehicles
          ? vehicleModelLayers([ghost], {
              ...options.current,
              idPrefix: "vehicle-models-ghost",
              opacity: options.current.opacity * SCHEDULE_GHOST_OPACITY,
              getPosition: () => position,
              getTilt: () => tilt,
              positionTrigger: position,
            })
          : [];
      handOver();
    };
    publish();
    const unsubscribe = ghostStore.subscribe(publish);
    return () => {
      unsubscribe();
      ghostLayers.current = [];
    };
  }, [handOver, ghostStore, showVehicles]);

  const onSeasonalLayers = useCallback(
    (layers: Layer[]) => {
      seasonalLayers.current = layers;
      handOver();
    },
    [handOver],
  );
  const { holdAwake } = useSeasonalDecorations({
    map: mapRef?.getMap(),
    season,
    opacity,
    scheme,
    chasing,
    onLayers: onSeasonalLayers,
  });

  const onFireworkLayers = useCallback(
    (layers: Layer[]) => {
      fireworkLayersRef.current = layers;
      handOver();
    },
    [handOver],
  );
  // A barrage keeps the Christmas lights awake under it.
  useSeasonalFireworks({
    map: mapRef?.getMap(),
    on: fireworks,
    shown: viewDimension === "3d" && opacity > 0,
    scheme,
    onLayers: onFireworkLayers,
    onBarrage: holdAwake,
  });

  return null;
}
