import { useEffect, useRef } from "react";
import { useColorScheme, useMediaQuery } from "@mui/material";
import { Weather } from "../domain/weather.ts";
import { mapSchemeFor } from "../domain/baseMapScheme.ts";
import { MapScheme } from "./basemap/basemap.ts";

type WeatherOverlayProps = {
  /** The weather at the map's centre, from `WeatherFeed`; null draws nothing. */
  weather: Weather | null;
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
 * except snow, which is white in a soft slate shade to show on a pale map.
 */
const INK: Record<MapScheme, Record<Kind, string>> = {
  light: { rain: "70,85,105", snow: "255,255,255" },
  dark: { rain: "210,220,235", snow: "210,220,235" },
};

/** The light map's flake sprite, in px; drawn smaller, so it stays sharp. */
const FLAKE_SPRITE_SIZE = 32;

/**
 * A snowflake for the light map: a white core fading into slate, with no
 * edge. A white disc vanishes on Positron, and one with a slate rim is how
 * the transit network draws a stop — flakes read as stops scattered over
 * the map. Drawn once and stamped, since a gradient per flake per frame is
 * not cheap.
 */
function lightFlakeSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = FLAKE_SPRITE_SIZE;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const half = FLAKE_SPRITE_SIZE / 2;
  const shade = context.createRadialGradient(half, half, 0, half, half, half);
  shade.addColorStop(0, "rgba(255,255,255,1)");
  shade.addColorStop(0.3, "rgba(255,255,255,1)");
  shade.addColorStop(0.5, `rgba(${INK.light.rain},0.5)`);
  shade.addColorStop(1, `rgba(${INK.light.rain},0)`);
  context.fillStyle = shade;
  context.fillRect(0, 0, FLAKE_SPRITE_SIZE, FLAKE_SPRITE_SIZE);
  return sprite;
}

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
 * Nothing is mounted or animated unless something is falling there, and
 * nothing at all for someone who has asked for reduced motion — the sky,
 * which `BaseMapScheme` colours from the same weather, is not motion and
 * still follows it.
 */
export function WeatherOverlay({ weather }: WeatherOverlayProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", {
    noSsr: true,
  });
  const scheme = mapSchemeFor(useColorScheme().colorScheme);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const kind =
    weather && weather.kind !== "none" && !reducedMotion ? weather.kind : null;
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
    const flakeSprite =
      kind === "snow" && scheme === "light" ? lightFlakeSprite() : null;
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
        } else if (flakeSprite) {
          // The core is the inner third of the sprite, so this is the same
          // flake as the dark map's with its shade around it.
          const size = 6 * (1 + 1.5 * particle.depth);
          context.globalAlpha = 0.5 + 0.5 * particle.depth;
          context.drawImage(
            flakeSprite,
            particle.x - size / 2,
            particle.y - size / 2,
            size,
            size,
          );
          context.globalAlpha = 1;
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
