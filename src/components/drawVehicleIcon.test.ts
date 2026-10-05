import { describe, expect, it } from "vitest";
import { EDGE_INK, EDGE_WHITE } from "../domain/dataColours.ts";
import {
  BEARING_ARROW_SIZE,
  VEHICLE_ICON_PIXEL_RATIO,
  VEHICLE_ICON_SIZE,
  bearingArrowPoints,
  drawBearingArrow,
  drawVehicleIcon,
} from "./drawVehicleIcon.ts";

/** Records the calls and style assignments drawVehicleIcon makes. */
function recordingContext() {
  const calls: string[] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, key) => {
      if (typeof key === "symbol" || key === "then") return undefined;
      return (...args: unknown[]) => {
        calls.push(`${String(key)}(${args.map(String).join(",")})`);
      };
    },
    set: (_target, key, value) => {
      calls.push(`${String(key)}=${String(value)}`);
      return true;
    },
  };
  return {
    calls,
    ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D,
  };
}

describe("drawVehicleIcon", () => {
  it("clips to the circle before drawing the SVG, then rings it in white", () => {
    const { calls, ctx } = recordingContext();
    const image = { toString: () => "svg" } as unknown as CanvasImageSource;
    drawVehicleIcon(ctx, image);

    const clip = calls.indexOf("clip()");
    const draw = calls.findIndex((c) => c.startsWith("drawImage(svg"));
    const stroke = calls.lastIndexOf("stroke()");
    expect(clip).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThan(clip);
    expect(calls).toContain(
      `drawImage(svg,0,0,${VEHICLE_ICON_SIZE},${VEHICLE_ICON_SIZE})`,
    );
    expect(stroke).toBeGreaterThan(draw);
    expect(calls).toContain(`strokeStyle=${EDGE_WHITE}`);
    expect(calls).toContain("lineWidth=4");
  });

  it("draws the generic icon as a grey disc with a white dot when there is no image", () => {
    const { calls, ctx } = recordingContext();
    drawVehicleIcon(ctx, null);

    expect(calls.some((c) => c.startsWith("drawImage("))).toBe(false);
    expect(calls).toContain("fillStyle=#5b6272");
    const dot = calls.lastIndexOf("fillStyle=#ffffff");
    expect(dot).toBeGreaterThan(calls.indexOf("fillStyle=#5b6272"));
    expect(calls).toContain(
      `arc(${VEHICLE_ICON_SIZE / 2},${VEHICLE_ICON_SIZE / 2},12,0,${Math.PI * 2})`,
    );
    expect(calls).toContain(`strokeStyle=${EDGE_WHITE}`);
  });
});

describe("bearing arrow", () => {
  const centre = BEARING_ARROW_SIZE / 2;
  const radius = ([x, y]: [number, number]) =>
    Math.hypot(x - centre, y - centre);

  it("points north from the shared centre, entirely outside the icon's circle", () => {
    const points = bearingArrowPoints();
    const [tip] = points;
    expect(tip[0]).toBe(centre);
    expect(tip[1]).toBeLessThan(centre);
    // Same pixel ratio as the icons, so their radius is comparable directly.
    expect(VEHICLE_ICON_PIXEL_RATIO).toBe(2);
    for (const point of points) {
      expect(radius(point)).toBeGreaterThan(VEHICLE_ICON_SIZE / 2);
    }
  });

  it("stays inside its image, edge included", () => {
    for (const [x, y] of bearingArrowPoints()) {
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(4);
      expect(Math.max(x, y)).toBeLessThanOrEqual(BEARING_ARROW_SIZE - 4);
    }
  });

  it("is symmetric about its axis", () => {
    const [, right, notch, left] = bearingArrowPoints();
    expect(right[0] - centre).toBe(centre - left[0]);
    expect(right[1]).toBe(left[1]);
    expect(notch[0]).toBe(centre);
  });

  it("fills in ink over a white edge", () => {
    const { calls, ctx } = recordingContext();
    drawBearingArrow(ctx);
    expect(calls.indexOf(`strokeStyle=${EDGE_WHITE}`)).toBeLessThan(
      calls.indexOf(`fillStyle=${EDGE_INK}`),
    );
    expect(calls.indexOf("stroke()")).toBeLessThan(calls.indexOf("fill()"));
  });
});
