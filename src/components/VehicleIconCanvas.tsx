import { useEffect, useRef } from "react";
import {
  FOLLOW_BADGE_SIZE,
  VEHICLE_ICON_SIZE,
  drawFollowBadge,
  drawVehicleIcon,
  loadVehicleIconImage,
} from "./drawVehicleIcon.ts";

/**
 * A vehicle icon in a panel, drawn exactly as on the map — an <img> of the SVG
 * would show the file's white square corners on a dark panel.
 */
export function VehicleIconCanvas({
  url,
  size,
  followed = false,
}: {
  /** The SVG; null draws the generic icon. */
  url: string | null;
  /** Displayed size of the icon in CSS pixels. */
  size: number;
  /**
   * Adds the follow badge on the icon's edge. The canvas then grows to the
   * badge image's size, around the same centre, as on the map.
   */
  followed?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const canvasSize = followed ? FOLLOW_BADGE_SIZE : VEHICLE_ICON_SIZE;

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const draw = (image: CanvasImageSource | null) => {
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      const inset = (canvasSize - VEHICLE_ICON_SIZE) / 2;
      ctx.save();
      ctx.translate(inset, inset);
      drawVehicleIcon(ctx, image);
      ctx.restore();
      if (followed) drawFollowBadge(ctx, canvasSize);
    };
    if (!url) {
      draw(null);
      return;
    }
    let cancelled = false;
    loadVehicleIconImage(url)
      .then((image) => {
        if (!cancelled) draw(image);
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [url, followed, canvasSize]);

  const displayed = (size * canvasSize) / VEHICLE_ICON_SIZE;
  return (
    <canvas
      ref={ref}
      width={canvasSize}
      height={canvasSize}
      style={{
        width: displayed,
        height: displayed,
        // The badge's margin of image hangs outside the icon's box, so the
        // icon lines up with the ones above and below it.
        margin: followed ? -(displayed - size) / 2 : 0,
        marginRight: 8 - (displayed - size) / 2,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
