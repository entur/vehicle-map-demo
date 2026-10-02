import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import {
  EstimatedTimetableUpdate,
  RoutePolyline,
  VehicleUpdate,
} from "../../types.ts";
import {
  locateCalls,
  measureRoute,
  pointAlong,
  scheduledDistance,
} from "../../domain/scheduleGhost.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "../mapStyle.ts";
import { SelectedVehicle } from "./VehicleMarkers.tsx";
import { VehicleStore } from "./chasedVehicleStore.ts";

/** How often the 2D ghost and its link are redrawn. The model moves every frame. */
const SOURCE_INTERVAL_MS = 250;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

type Props = {
  selectedVehicle: SelectedVehicle | null;
  /** The selected journey's route and timetable; null until each arrives. */
  route: RoutePolyline | null;
  timetable: EstimatedTimetableUpdate | null;
  data: VehicleUpdate[];
  chasedVehicleStore: VehicleStore;
  /** Written every frame while the models show, for VehicleModels to draw. */
  ghostStore: VehicleStore;
};

/**
 * Draws where the selected vehicle would be now if it ran exactly to its aimed
 * times (see `scheduleGhost.ts`), joined to the vehicle by a dashed link. No
 * ghost without a route, without a timetable, or for a cancelled trip.
 */
export function ScheduleGhost({
  selectedVehicle,
  route,
  timetable,
  data,
  chasedVehicleStore,
  ghostStore,
}: Props) {
  const { current: mapRef } = useMap();

  const schedule = useMemo(() => {
    if (!route || route.coordinates.length < 2) return null;
    if (!timetable || timetable.cancellation) return null;
    const measured = measureRoute(route.coordinates);
    const calls = locateCalls(measured, timetable.calls);
    return calls.length < 2 ? null : { route: measured, calls };
  }, [route, timetable]);

  const vehicleKey = selectedVehicle
    ? selectedVehicle.properties.id +
      "_" +
      selectedVehicle.properties.serviceJourneyId
    : null;
  const mode = selectedVehicle?.properties.mode ?? null;

  // The newest report of the selected vehicle, read by the frame loop without
  // restarting it on every vehicle frame. Null while it is outside the
  // subscription's bounding box — as it is when the map is zoomed in on the
  // ghost — and then there is no link to draw.
  const vehicle = useMemo(
    () =>
      data.find(
        (v) => v.vehicleId + "_" + v.serviceJourney.id === vehicleKey,
      ) ?? null,
    [data, vehicleKey],
  );
  const vehicleRef = useRef(vehicle);
  // The last report seen for this selection, kept when the vehicle leaves the
  // data: the ghost's model takes its look (mode, line colour, destination)
  // from it, and must not vanish just because the real one is out of view.
  const lookRef = useRef<{ key: string | null; vehicle: VehicleUpdate } | null>(
    null,
  );
  useEffect(() => {
    vehicleRef.current = vehicle;
    if (vehicle) lookRef.current = { key: vehicleKey, vehicle };
  }, [vehicle, vehicleKey]);

  useEffect(() => {
    const map = mapRef?.getMap();
    const source = map?.getSource("scheduleGhost") as GeoJSONSource | undefined;
    if (!map || !source || !schedule || !mode) return;

    let frame = 0;
    let lastWrite = -Infinity;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = Date.now();
      const distance = scheduledDistance(schedule.calls, now);
      if (distance === null) return;
      const ghost = pointAlong(schedule.route, distance);

      // During a chase the vehicle is drawn where the camera interpolated it,
      // seconds behind its newest report; link to that.
      const chased = chasedVehicleStore.get();
      const real =
        chased &&
        chased.vehicleId + "_" + chased.serviceJourney.id === vehicleKey
          ? chased
          : vehicleRef.current;

      const look =
        real ??
        (lookRef.current?.key === vehicleKey ? lookRef.current.vehicle : null);
      const modelsShown = map.getZoom() >= VEHICLE_MODEL_MIN_ZOOM;
      if (modelsShown && look) {
        ghostStore.set({
          ...look,
          location: {
            longitude: ghost.coordinates[0],
            latitude: ghost.coordinates[1],
          },
          bearing: ghost.bearing,
        });
      } else if (ghostStore.get() !== null) {
        ghostStore.set(null);
      }

      if (performance.now() - lastWrite < SOURCE_INTERVAL_MS) return;
      lastWrite = performance.now();
      const features: Feature[] = [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: ghost.coordinates },
          properties: { mode },
        },
      ];
      if (real) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              ghost.coordinates,
              [real.location.longitude, real.location.latitude],
            ],
          },
          properties: {},
        });
      }
      source.setData({ type: "FeatureCollection", features });
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      source.setData(EMPTY);
      ghostStore.set(null);
    };
  }, [mapRef, schedule, mode, vehicleKey, chasedVehicleStore, ghostStore]);

  return null;
}
