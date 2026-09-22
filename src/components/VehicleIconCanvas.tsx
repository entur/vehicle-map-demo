import { useEffect, useRef } from "react";
import { VEHICLE_ICON_SIZE, drawVehicleIcon } from "./drawVehicleIcon.ts";

/**
 * A vehicle icon in a panel, drawn exactly as on the map — an <img> of the SVG
 * would show the file's white square corners on a dark panel.
 */
export function VehicleIconCanvas({
  url,
  size,
}: {
  /** The SVG; null draws the generic icon. */
  url: string | null;
  /** Displayed size in CSS pixels. */
  size: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    if (!url) {
      drawVehicleIcon(ctx, null);
      return;
    }
    let cancelled = false;
    const image = new Image(VEHICLE_ICON_SIZE, VEHICLE_ICON_SIZE);
    image.onload = () => {
      if (!cancelled) drawVehicleIcon(ctx, image);
    };
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <canvas
      ref={ref}
      width={VEHICLE_ICON_SIZE}
      height={VEHICLE_ICON_SIZE}
      style={{ width: size, height: size, marginRight: 8, flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}
