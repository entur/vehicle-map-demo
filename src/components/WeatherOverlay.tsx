import { useEffect, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useColorScheme, useMediaQuery } from "@mui/material";
import { useWeather } from "../hooks/useWeather.ts";
import { mapSchemeFor } from "../domain/baseMapScheme.ts";
import { MapScheme } from "./basemap/basemap.ts";
import { VEHICLE_MODEL_MIN_ZOOM } from "./mapStyle.ts";

type WeatherOverlayProps = {
  /** The Weather switch is on and the view is 3D. */
  enabled: boolean;
};

type Kind = "rain" | "snow";

/** Screen px² per particle at full intensity. */
const AREA_PER_PARTICLE: Record<Kind, number> = { rain: 1500, snow: 2300 };
/** Fall speed of the nearest particles, px/s. */
const FALL_SPEED: Record<Kind, number> = { rain: 1100, snow: 90 };
/** Sideways travel per px fallen at full slant; snow drifts further than rain. */
const MAX_DRIFT: Record<Kind, number> = { rain: 0.6, snow: 1.5 };
/** Length of the nearest rain streaks, px. */
const STREAK_LENGTH = 22;

/**
 * Particle colours as `r,g,b`. Not data colours: weather is scenery, so it
 * stays in the base map's own slate, light on Fiord and dark on Positron,
 * except snow, which is white with a slate rim to show on a pale map.
 */
const INK: Record<MapScheme, Record<Kind, string>> = {
  light: { rain: "70,85,105", snow: "255,255,255" },
  dark: { rain: "210,220,235", snow: "210,220,235" },
};
const SNOW_RIM_ON_LIGHT = "rgba(70,85,105,0.8)";

type Particle = {
  x: number;
  y: number;
  /** 0.3–1: nearer particles are larger, faster and more opaque. */
  depth: number;
};

/**
 * Rain or snow falling over the map when it is falling at the map's centre:
 * a canvas above the map and below every control and panel, which takes no
 * input. It is drawn in screen space, over the vehicles and their labels,
 * and always leans the same way on screen whatever the map's bearing.
 *
 * Only from the zoom where vehicles are 3D models: weather belongs to the
 * street-level scene, and further out it is rain on a map.
 *
 * Nothing is mounted, fetched or animated unless something is falling there,
 * and nothing at all for someone who has asked for reduced motion.
 */
export function WeatherOverlay({ enabled }: WeatherOverlayProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", {
    noSsr: true,
  });
  const atModelZoom = useAtModelZoom();
  const weather = useWeather(enabled && !reducedMotion && atModelZoom);
  const scheme = mapSchemeFor(useColorScheme().colorScheme);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const kind = weather && weather.kind !== "none" ? weather.kind : null;
  const intensity = weather?.intensity ?? 0;
  const slant = weather?.slant ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !kind) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const drift = slant * MAX_DRIFT[kind];
    // Particles enter along the top over a span widened by how far they
    // drift on the way down, so the downwind side does not thin out.
    const spawnX = () => Math.random() * (width + height * drift);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      const count = Math.round(
        ((width * height) / AREA_PER_PARTICLE[kind]) * intensity,
      );
      particles = Array.from({ length: count }, () => ({
        x: spawnX(),
        y: Math.random() * height,
        depth: 0.3 + Math.random() * 0.7,
      }));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const ink = INK[scheme][kind];
    let previous = performance.now();
    let frame = requestAnimationFrame(function draw(now) {
      // Capped, so a tab that was in the background does not come back with
      // every particle having fallen off the screen at once.
      const elapsed = Math.min(now - previous, 50) / 1000;
      previous = now;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        const fall = FALL_SPEED[kind] * particle.depth * elapsed;
        particle.y += fall;
        particle.x -= fall * drift;
        if (particle.y > height) {
          particle.y = -STREAK_LENGTH;
          particle.x = spawnX();
        }
        if (kind === "rain") {
          const length = STREAK_LENGTH * particle.depth;
          context.strokeStyle = `rgba(${ink},${0.25 + 0.35 * particle.depth})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x + length * drift, particle.y - length);
          context.stroke();
        } else {
          context.fillStyle = `rgba(${ink},${0.5 + 0.4 * particle.depth})`;
          context.beginPath();
          context.arc(
            particle.x,
            particle.y,
            1 + 1.5 * particle.depth,
            0,
            2 * Math.PI,
          );
          context.fill();
          if (scheme === "light") {
            context.strokeStyle = SNOW_RIM_ON_LIGHT;
            context.lineWidth = 1;
            context.stroke();
          }
        }
      }
      frame = requestAnimationFrame(draw);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [kind, intensity, slant, scheme]);

  if (!kind) return null;
  return (
    <canvas
      ref={canvasRef}
      data-testid="weather-overlay"
      data-weather={kind}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        // Above the map's canvas, below MapLibre's controls (2), the detail
        // panels (2), the right menu (3) and the chase HUD (4).
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}

/** Whether the map is zoomed in to where vehicles are drawn as 3D models. */
function useAtModelZoom(): boolean {
  const { current: mapRef } = useMap();
  const [atModelZoom, setAtModelZoom] = useState(
    () => (mapRef?.getZoom() ?? 0) >= VEHICLE_MODEL_MIN_ZOOM,
  );
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const update = () =>
      setAtModelZoom(map.getZoom() >= VEHICLE_MODEL_MIN_ZOOM);
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [mapRef]);
  return atModelZoom;
}
