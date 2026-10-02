import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMap } from "react-map-gl/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Filter } from "../../types.ts";
import { VehicleData } from "../../hooks/useVehiclePositionsData.ts";
import {
  BEHIND,
  ChaseOrbit,
  ChaseSample,
  LngLat,
  addSample,
  approachOrbit,
  cameraBearing,
  chaseBoundingBox,
  chaseTopPadding,
  chaseTarget,
  distanceMetres,
  isBehind,
  orbitByDrag,
  orbitByKey,
  positionAt,
  smoothAngle,
  smoothingAlpha,
  zoomByPinch,
  zoomByWheel,
} from "../../domain/chaseCamera.ts";
import { ViewDimension, cameraFor } from "../../domain/viewDimension.ts";
import { ChasedVehicle, VehicleStore } from "./chasedVehicleStore.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "../mapStyle.ts";
import { setPaddingInPlace } from "../../utils/setPaddingInPlace.ts";

const CHASE_ZOOM = 17.5;
/**
 * Where the models finish fading in. The chased vehicle has no icon — the
 * markers leave it out — so below this it fades with the models, and at
 * `VEHICLE_MODEL_MIN_ZOOM` itself it is gone, leaving nothing to chase.
 */
const CHASE_MIN_ZOOM = VEHICLE_MODEL_MIN_ZOOM + 0.5;
const FLY_IN_MS = 1500;

/** Buffered playback is already continuous; this only absorbs a mode switch. */
const BUFFERED_TIME_CONSTANT_MS = 150;
/** A sparse vehicle glides to each new report over about this long. */
const LATEST_TIME_CONSTANT_MS = 1200;
const HEADING_TIME_CONSTANT_MS = 600;
/** An arrow key or the Behind button turns the camera over about this long. */
const ORBIT_TIME_CONSTANT_MS = 250;
/**
 * A press that moves less than this is a click, not a drag — MapLibre's own
 * click tolerance, so a click on another vehicle still opens its popup.
 */
const DRAG_THRESHOLD_PX = 3;
const HUD_REFRESH_MS = 250;
/** A wheel quiet this long has stopped; MapLibre's scroll zoom waits as long. */
const WHEEL_END_MS = 200;
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
  store: VehicleStore;
  setCurrentFilter: React.Dispatch<React.SetStateAction<Filter | null>>;
  onStop: () => void;
  /**
   * px of the map's bottom edge the phone's detail sheet hides, 0 when there
   * is none. The HUD sits above it — its Stop button is the only on-screen
   * way out of a chase.
   */
  bottomInset: number;
  /**
   * Told how many px of the map's bottom edge the HUD and whatever is below
   * it hide, so the map can be padded by it: the chased vehicle is centred in
   * what is left, and on a phone the HUD otherwise sits right over it.
   */
  onCoveredChange: (px: number) => void;
};

/** Gap between the HUD and the sheet below it, the same as between cards. */
const HUD_SHEET_GAP = 12;
/** Clear space kept between the HUD's top edge and the chased vehicle. */
const HUD_VEHICLE_GAP = 12;

/**
 * A camera behind and above one vehicle, turned the way it travels. Dragging
 * the map, or the arrow keys, orbits the camera around the vehicle — the
 * angle is kept relative to its heading, so a view from the side stays one
 * through a turn — and the HUD's Behind button returns it. Vehicles
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
  bottomInset,
  onCoveredChange,
}: Props) {
  const { current: mapRef } = useMap();

  // A layout effect, so the padding is in place before the fly-in, which
  // starts on a later animation frame and reads it. Observed, because the HUD
  // text changes every HUD_REFRESH_MS and can wrap onto another line.
  const hudRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const hud = hudRef.current;
    if (!hud) return;
    const report = () =>
      onCoveredChange(
        Math.ceil(
          parseFloat(getComputedStyle(hud).bottom) +
            hud.offsetHeight +
            HUD_VEHICLE_GAP,
        ),
      );
    report();
    const observer = new ResizeObserver(report);
    observer.observe(hud);
    return () => observer.disconnect();
  }, [bottomInset, onCoveredChange]);

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

  // The orbit the user asked for; the camera eases to it frame by frame.
  // MapView remounts this component for each chase, so every chase starts
  // from behind.
  const orbitTarget = useRef<ChaseOrbit>(BEHIND);
  const [behind, setBehind] = useState(true);
  const setOrbit = useCallback((orbit: ChaseOrbit) => {
    orbitTarget.current = orbit;
    setBehind(isBehind(orbit));
  }, []);

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
    // The camera is placed every frame, and every placement resets MapLibre's
    // gesture handlers, so its panning and rotating could only fight it. A
    // drag orbits the camera instead, handled below. Zoom stays, about the
    // vehicle rather than the pointer, through our own listeners below. A
    // pinch, because the reset drops a pinch's first two touches, so
    // MapLibre's ignored every pinch begun while the vehicle moved. The wheel,
    // because MapLibre's scroll zoom moves the centre even `around: "center"`
    // — it finds the centre's screen point at sea level, not on the terrain —
    // and eases it away between the chase's frames while each frame puts it
    // back: the vehicle shook between two places for as long as the zoom ran.
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.touchZoomRotate.disable();
    map.touchPitch.disable();
    map.scrollZoom.disable();

    let phase: "waiting" | "flying" | "chasing" = "waiting";
    let camera: LngLat | null = null;
    let heading: number | null = null;
    /** What the orbit turns from while the vehicle has reported no heading. */
    let headingFallback = 0;
    /** The orbit the camera shows, easing towards `orbitTarget`. */
    let orbit = orbitTarget.current;
    /** Set when the orbit is moving; the view's reach is measured once it stops. */
    let reachStale = false;
    /** What the map and the model last showed, to skip frames that change nothing. */
    let shown: {
      lon: number;
      lat: number;
      heading: number | null;
      orbit: ChaseOrbit;
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
      // A pinch zooms on every move and the wheel on every event, and each is
      // measured once it ends.
      if (phase !== "chasing" || pinch || wheelEnd !== undefined) return;
      viewReach.current = viewReachMetres(map);
      keepBoxAroundVehicle();
    };
    map.on("zoomend", onZoomEnd);

    // A one-finger drag must reach us rather than scroll the page: with
    // dragPan off, MapLibre's CSS leaves touch-action at "pan-x pan-y".
    const container = map.getCanvasContainer();
    const canvas = map.getCanvas();
    const savedTouchAction = [
      container.style.touchAction,
      canvas.style.touchAction,
    ];
    container.style.touchAction = "none";
    canvas.style.touchAction = "none";

    /** Where each pointer that is down is, by pointer id. */
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: {
      ids: [number, number];
      startDistance: number;
      startZoom: number;
    } | null = null;
    /** Pending while the wheel turns; the zoom it ends at is measured then. */
    let wheelEnd: ReturnType<typeof setTimeout> | undefined;
    const spread = ([a, b]: [number, number]) => {
      const [p, q] = [pointers.get(a), pointers.get(b)];
      return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
    };
    let drag: {
      pointerId: number;
      x: number;
      y: number;
      moved: boolean;
    } | null = null;
    /**
     * Set when a mouse drag ends, to swallow the click the browser fires
     * after it. MapLibre tells a click from a drag by where the button went
     * down, and every camera placement resets that, so the click would reach
     * the map and clear the selected vehicle.
     */
    let swallowClick = false;
    const onPointerDown = (event: PointerEvent) => {
      swallowClick = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      // A second finger is a pinch, which zooms.
      if (pointers.size > 1) {
        drag = null;
        if (pointers.size === 2 && phase === "chasing") {
          const ids = [...pointers.keys()] as [number, number];
          pinch = { ids, startDistance: spread(ids), startZoom: map.getZoom() };
        }
        return;
      }
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch?.ids.includes(event.pointerId)) {
        map.jumpTo({
          zoom: zoomByPinch(
            pinch.startZoom,
            pinch.startDistance,
            spread(pinch.ids),
          ),
        });
        return;
      }
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      setOrbit(orbitByDrag(orbitTarget.current, dx, dy));
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pinch?.ids.includes(event.pointerId)) {
        pinch = null;
        onZoomEnd();
      }
      if (drag?.pointerId !== event.pointerId) return;
      swallowClick = drag.moved && event.type === "pointerup";
      drag = null;
    };
    // A jump that sets only the zoom leaves the centre on the vehicle.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (phase !== "chasing") return;
      clearTimeout(wheelEnd);
      wheelEnd = setTimeout(() => {
        wheelEnd = undefined;
        onZoomEnd();
      }, WHEEL_END_MS);
      map.jumpTo({
        zoom: zoomByWheel(map.getZoom(), event.deltaY, event.deltaMode),
      });
    };
    // Captured, so it runs before MapLibre's own listener on the container.
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
    };
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("click", onClick, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    // MapLibre's keyboard handler is off, so the arrows are free — but only
    // on the map, not in a list or a menu that has focus.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      const target = event.target as Node | null;
      if (target !== document.body && !container.contains(target)) return;
      const next = orbitByKey(orbitTarget.current, event.key);
      if (!next) return;
      event.preventDefault();
      setOrbit(next);
    };
    window.addEventListener("keydown", onKeyDown);

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
        headingFallback = heading ?? map.getBearing();
        phase = "flying";
        map.flyTo({
          center: [newest.lon, newest.lat],
          zoom: Math.max(map.getZoom(), CHASE_ZOOM),
          pitch: orbit.pitch,
          bearing: cameraBearing(headingFallback, orbit),
          // The bottom edge belongs to MapBottomPadding: on a phone it is
          // what the detail sheet hides.
          padding: {
            top: chaseTopPadding(
              map.getContainer().clientHeight,
              map.getPadding().bottom ?? 0,
            ),
            bottom: map.getPadding().bottom ?? 0,
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
        // A drag is followed as it happens; anything else eases.
        const next = approachOrbit(
          orbit,
          orbitTarget.current,
          drag?.moved ? 1 : smoothingAlpha(dt, ORBIT_TIME_CONSTANT_MS),
        );
        if (!sameOrbit(next, orbit)) reachStale = true;
        orbit = next;
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
            Math.abs(shown.heading - heading) < 0.01)) &&
        sameOrbit(shown.orbit, orbit);

      if (report && camera && !unchanged) {
        if (phase === "chasing") {
          // The top padding follows the bottom, which the sheet and the HUD
          // change mid-chase.
          map.jumpTo({
            center: [camera.lon, camera.lat],
            bearing: cameraBearing(heading ?? headingFallback, orbit),
            pitch: orbit.pitch,
            padding: {
              top: chaseTopPadding(
                map.getContainer().clientHeight,
                map.getPadding().bottom ?? 0,
              ),
            },
          });
        }
        store.set({
          ...report,
          location: { longitude: camera.lon, latitude: camera.lat },
          bearing: heading,
        });
        shown = { lon: camera.lon, lat: camera.lat, heading, orbit, report };
      }

      // The pitch sets how far the view reaches, and so the box it needs;
      // measured once the orbit settles rather than on every frame of it.
      if (
        phase === "chasing" &&
        reachStale &&
        !drag?.moved &&
        sameOrbit(orbit, orbitTarget.current)
      ) {
        reachStale = false;
        viewReach.current = viewReachMetres(map);
        keepBoxAroundVehicle();
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
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("wheel", onWheel);
      clearTimeout(wheelEnd);
      container.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      [container.style.touchAction, canvas.style.touchAction] =
        savedTouchAction;
      map.stop();
      store.set(null);

      map.setMinZoom(saved.minZoom);
      map.dragPan.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.touchZoomRotate.enable();
      map.touchPitch.enable();
      map.scrollZoom.enable();
      // The padding goes back at once, not as part of the ease below: when
      // the chase switched the map to 3D, stopping it switches back in the
      // same commit, and ViewDimensionLayers' own ease cancels this one
      // before it has moved — which used to strand the chase's top padding
      // and centre every later camera move too low. The bottom edge is
      // MapBottomPadding's and is left alone.
      setPaddingInPlace(map, {
        top: saved.padding.top ?? 0,
        left: saved.padding.left ?? 0,
        right: saved.padding.right ?? 0,
      });
      map.easeTo({ ...cameraFor(viewDimensionRef.current), duration: 800 });
    };
  }, [mapRef, store, key, keepBoxAroundVehicle, setOrbit]);

  return (
    <div
      ref={hudRef}
      className="chase-hud"
      role="status"
      style={
        bottomInset > 0 ? { bottom: bottomInset + HUD_SHEET_GAP } : undefined
      }
    >
      <strong>Chase camera</strong>
      <span>{hudText(hud)}</span>
      {!behind && (
        <button
          type="button"
          className="chase-hud-button"
          onClick={() => setOrbit(BEHIND)}
        >
          Behind
        </button>
      )}
      <button type="button" className="chase-hud-button" onClick={onStop}>
        Stop
      </button>
    </div>
  );
}

/** Equal to within what a frame could show: a hundredth of a degree. */
function sameOrbit(a: ChaseOrbit, b: ChaseOrbit) {
  const offset = Math.abs(a.bearingOffset - b.bearingOffset);
  return (
    Math.min(offset, 360 - offset) < 0.01 && Math.abs(a.pitch - b.pitch) < 0.01
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
