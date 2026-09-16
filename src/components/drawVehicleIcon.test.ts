import { describe, expect, it } from "vitest";
import { EDGE_WHITE } from "../domain/dataColours.ts";
import { VEHICLE_ICON_SIZE, drawVehicleIcon } from "./drawVehicleIcon.ts";

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
