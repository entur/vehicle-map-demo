import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Filter } from "../../types.ts";
import { VehicleData } from "../../hooks/useVehiclePositionsData.ts";
import {
  ChaseSample,
  LngLat,
  addSample,
  chaseBoundingBox,
  chaseTarget,
  distanceMetres,
  positionAt,
  smoothAngle,
  smoothingAlpha,
} from "../../domain/chaseCamera.ts";
import { ViewDimension, cameraFor } from "../../domain/viewDimension.ts";
import { ChasedVehicle, ChasedVehicleStore } from "./chasedVehicleStore.ts";

const CHASE_ZOOM = 17.5;
/**
 * MapLibre's default maximum. Going steeper means raising `maxPitch` for the
 * chase and lowering it again after the exit animation — a second, delayed
 * restore that a new chase, or StrictMode's double mount, can land in the
 * middle of, capping or stranding the pitch.
 */
const CHASE_PITCH = 60;
/** Below this the models fade out, leaving nothing on screen to chase. */
const CHASE_MIN_ZOOM = 16;
/** Share of the map's height padded off the top, so the road ahead shows. */
const TOP_PADDING_SHARE = 0.35;
const FLY_IN_MS = 1500;

/** Buffered playback is already continuous; this only absorbs a mode switch. */
const BUFFERED_TIME_CONSTANT_MS = 150;
/** A sparse vehicle glides to each new report over about this long. */
const LATEST_TIME_CONSTANT_MS = 1200;
const HEADING_TIME_CONSTANT_MS = 600;
const HUD_REFRESH_MS = 250;
/**
 * The chase moves the camera at most this often. Every camera move is a full
 * map redraw with terrain, which dominates the chase's CPU cost, and
 * requestAnimationFrame follows the display: on a 120 Hz screen an uncapped
 * chase redraws twice as often for motion no smoother to the eye.
 */
const CHASE_FPS = 30;
/** Slack for frame timing jitter, so a frame due at the cap is not skipped. */
const FRAME_SLACK_MS = 2;

/**
 * How far the map shows from its centre, in metres: the farthest of the four
 * canvas corners. With the chase's top padding the centre is the vehicle.
 */
function viewReachMetres(map: MapLibreMap): number {
  const { lng, lat } = map.getCenter();
  const { clientWidth: w, clientHeight: h } = map.getCanvas();
  return Math.max(
    ...[
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ].map(([x, y]) => {
      const corner = map.unproject([x, y]);
      return distanceMetres(
        { lon: lng, lat },
        { lon: corner.lng, lat: corner.lat },
      );
    }),
  );
}

type Hud =
  | { phase: "waiting" }
  | {
      phase: "chasing";
      buffered: boolean;
      playbackDelayMs: number | null;
      medianIntervalMs: number | null;
      sinceReportMs: number;
    };

type Props = {
  chased: ChasedVehicle;
  data: VehicleData[];
  viewDimension: ViewDimension;
  store: ChasedVehicleStore;
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
  onStop: () => void;
};

/**
 * A camera behind and above one vehicle, turned the way it travels. Vehicles
 * reporting often enough are played back from a buffer a report or two behind
 * real time, so the camera moves continuously instead of jumping from report
 * to report; sparser ones glide to each new report as it arrives. See
 * `chaseTarget` for where the line between the two is drawn and why.
 *
 * Mounted only while chasing. It owns the camera, the vehicle subscription's
 * bounding box and the chased vehicle's model for as long as it is mounted,
 * and hands all three back when unmounted.
 */
export function ChaseCamera({
  chased,
  data,
  viewDimension,
  store,
  setCurrentFilter,
  onStop,
}: Props) {
  const { current: mapRef } = useMap();
  const key = chased.vehicleId + "_" + chased.serviceJourneyId;
  const samples = useRef<ChaseSample[]>([]);
  const latestReport = useRef<VehicleData["vehicleUpdate"] | null>(null);
  /**
   * How far the chase view reaches. Zero until the fly-in lands, so the box
   * starts at its minimum rather than sized for the unpitched view the chase
   * started from — which would re-open the subscription again on landing.
   */
  const viewReach = useRef(0);
  const [hud, setHud] = useState<Hud>({ phase: "waiting" });

  // Read by the long-lived effects below without restarting them.
  const viewDimensionRef = useRef(viewDimension);
  const onStopRef = useRef(onStop);
  useEffect(() => {
    viewDimensionRef.current = viewDimension;
    onStopRef.current = onStop;
  });

  const keepBoxAroundVehicle = useCallback(() => {
    const report = latestReport.current;
    if (!report) return;
    const { longitude, latitude } = report.location;
    setCurrentFilter((prev) => {
      const boundingBox = chaseBoundingBox(
        prev?.boundingBox,
        longitude,
        latitude,
        viewReach.current,
      );
      if (prev && boundingBox === prev.boundingBox) return prev;
      return { ...prev, boundingBox };
    });
  }, [setCurrentFilter]);

  // Record each new report, and keep the subscription box around the vehicle.
  useEffect(() => {
    const entry = data.find((vehicle) => vehicle.vehicleId === key);
    if (!entry) return;
    const report = entry.vehicleUpdate;
    const next = addSample(samples.current, {
      received: Date.now(),
      lastUpdated: report.lastUpdated,
      lon: report.location.longitude,
      lat: report.location.latitude,
      bearing: report.bearing,
    });
    if (next === samples.current) return;
    samples.current = next;
    latestReport.current = report;
    keepBoxAroundVehicle();
  }, [data, key, keepBoxAroundVehicle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onStopRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const saved = {
      minZoom: map.getMinZoom(),
      padding: map.getPadding(),
    };
    // The camera is placed every frame, so panning and rotating would only
    // fight it. Zoom stays, about the vehicle rather than the pointer.
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.scrollZoom.enable({ around: "center" });

    let phase: "waiting" | "flying" | "chasing" = "waiting";
    let camera: LngLat | null = null;
    let heading: number | null = null;
    /** What the map and the model last showed, to skip frames that change nothing. */
    let shown: {
      lon: number;
      lat: number;
      heading: number | null;
      report: VehicleData["vehicleUpdate"];
    } | null = null;
    let playbackTime: number | null = null;
    let lastFrame = performance.now();
    let lastHud = 0;
    let frame = 0;

    const onFlightEnd = () => {
      if (phase !== "flying") return;
      phase = "chasing";
      map.setMinZoom(CHASE_MIN_ZOOM);
      viewReach.current = viewReachMetres(map);
      keepBoxAroundVehicle();
    };

    // Zooming changes how far the view reaches, so the box may need to grow
    // (zooming out) or, well past the needed size, shrink.
    const onZoomEnd = () => {
      if (phase !== "chasing") return;
      viewReach.current = viewReachMetres(map);
      keepBoxAroundVehicle();
    };
    map.on("zoomend", onZoomEnd);

    const tick = (frameTime: number) => {
      if (frameTime - lastFrame < 1000 / CHASE_FPS - FRAME_SLACK_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const dt = frameTime - lastFrame;
      lastFrame = frameTime;
      const now = Date.now();
      const report = latestReport.current;

      if (phase === "waiting" && report) {
        const newest = positionAt(samples.current, Infinity)!;
        camera = { lon: newest.lon, lat: newest.lat };
        heading = newest.heading;
        phase = "flying";
        map.flyTo({
          center: [newest.lon, newest.lat],
          zoom: Math.max(map.getZoom(), CHASE_ZOOM),
          pitch: CHASE_PITCH,
          bearing: heading ?? map.getBearing(),
          padding: {
            top: map.getContainer().clientHeight * TOP_PADDING_SHARE,
            bottom: 0,
            left: 0,
            right: 0,
          },
          duration: FLY_IN_MS,
          essential: true,
        });
        map.once("moveend", onFlightEnd);
      }

      const target = chaseTarget(samples.current, now, {
        previous: playbackTime,
        dtMs: dt,
      });
      playbackTime = target?.playbackTime ?? null;
      if (phase === "chasing" && target && camera) {
        const alpha = smoothingAlpha(
          dt,
          target.buffered ? BUFFERED_TIME_CONSTANT_MS : LATEST_TIME_CONSTANT_MS,
        );
        camera = {
          lon: camera.lon + (target.lon - camera.lon) * alpha,
          lat: camera.lat + (target.lat - camera.lat) * alpha,
        };
        if (target.heading !== null) {
          heading =
            heading === null
              ? target.heading
              : smoothAngle(
                  heading,
                  target.heading,
                  smoothingAlpha(dt, HEADING_TIME_CONSTANT_MS),
                );
        }
      }

      // A vehicle standing at a stop leaves the camera where it is, and a camera
      // move is a full map redraw, so frames that would change nothing are
      // skipped. Smoothing only approaches its target, so "nothing" is a
      // millimetre and a hundredth of a degree.
      const unchanged =
        shown !== null &&
        camera !== null &&
        shown.report === report &&
        Math.abs(shown.lon - camera.lon) < 1e-8 &&
        Math.abs(shown.lat - camera.lat) < 1e-8 &&
        (shown.heading === heading ||
          (shown.heading !== null &&
            heading !== null &&
            Math.abs(shown.heading - heading) < 0.01));

      if (report && camera && !unchanged) {
        if (phase === "chasing") {
          map.jumpTo({
            center: [camera.lon, camera.lat],
            ...(heading !== null && { bearing: heading }),
          });
        }
        store.set({
          ...report,
          location: { longitude: camera.lon, latitude: camera.lat },
          bearing: heading,
        });
        shown = { lon: camera.lon, lat: camera.lat, heading, report };
      }

      if (frameTime - lastHud >= HUD_REFRESH_MS) {
        lastHud = frameTime;
        const newest = samples.current[samples.current.length - 1];
        setHud(
          phase === "waiting" || !target || !newest
            ? { phase: "waiting" }
            : {
                phase: "chasing",
                buffered: target.buffered,
                playbackDelayMs:
                  target.playbackTime === null
                    ? null
                    : now - target.playbackTime,
                medianIntervalMs: target.cadence?.medianIntervalMs ?? null,
                sinceReportMs: now - newest.received,
              },
        );
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      map.off("moveend", onFlightEnd);
      map.off("zoomend", onZoomEnd);
      map.stop();
      store.set(null);

      map.setMinZoom(saved.minZoom);
      map.dragPan.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.scrollZoom.enable();
      map.easeTo({
        ...cameraFor(viewDimensionRef.current),
        padding: saved.padding,
        duration: 800,
      });
    };
  }, [mapRef, store, key, keepBoxAroundVehicle]);

  return (
    <div className="chase-hud" role="status">
      <strong>Chase camera</strong>
      <span>{hudText(hud)}</span>
      <button type="button" className="chase-hud-stop" onClick={onStop}>
        Stop
      </button>
    </div>
  );
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

function hudText(hud: Hud) {
  if (hud.phase === "waiting") return "Waiting for a position report…";
  const stale =
    hud.sinceReportMs > 3 * Math.max(hud.medianIntervalMs ?? 0, 10_000);
  if (stale) return `No report for ${seconds(hud.sinceReportMs)}`;
  if (hud.medianIntervalMs === null) return "Measuring report interval…";
  if (hud.buffered) {
    return `Smooth playback, ${seconds(hud.playbackDelayMs!)} behind · reports every ${seconds(hud.medianIntervalMs)}`;
  }
  return `Reports every ${seconds(hud.medianIntervalMs)}, too sparse to buffer · gliding to each report`;
}
