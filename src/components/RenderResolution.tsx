import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import { WebGLDevice } from "@luma.gl/webgl";
import { pixelRatioFor } from "../domain/renderQuality.ts";
import { MODEL_BEFORE_LAYER } from "./Vehicle/vehicleModelLayers.ts";

/**
 * deck.gl's interleaved overlay draws into the map's own canvas, and attached
 * to a context it did not create it does not resize it: it learns the drawing
 * buffer's size when it attaches and on a CSS resize. A pixel ratio change
 * alters the buffer and not the CSS size, and deck.gl went on drawing at the
 * old size — measured, a bus model far from its own label.
 */
function syncDeckDrawingBuffer(map: MapLibreMap) {
  const canvas = map.getCanvas();
  deckDevice(map)?.canvasContext?.setDrawingBufferSize(
    canvas.width,
    canvas.height,
  );
}

function deckDevice(map: MapLibreMap) {
  return WebGLDevice.getDeviceFromContext(map.getCanvas().getContext("webgl2"));
}

/** deck.gl's layer group for the models, in the style while any is drawn. */
const DECK_MODEL_GROUP = `deck-maplibre-layer-group-before:${MODEL_BEFORE_LAYER}`;
/** Frames deck.gl's device gets to appear once its layers are in the style. */
const DECK_DEVICE_GRACE_FRAMES = 30;

/**
 * Draws the map at a pixel ratio that keeps the canvas within `maxPixels`
 * (`pixelRatioFor`), or at the device's own when there is no limit or it
 * fits. Re-checked whenever the map resizes. The only caller of
 * `setPixelRatio`.
 *
 * A change resizes the map, which stops any camera animation under way — a
 * kiosk flight included. It happens only when the quality or the window
 * changes.
 */
export function RenderResolution({ maxPixels }: { maxPixels: number | null }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const apply = () => {
      const container = map.getContainer();
      const ratio = pixelRatioFor(
        maxPixels,
        window.devicePixelRatio,
        container.clientWidth,
        container.clientHeight,
      );
      // setPixelRatio resizes the map, which fires `resize` and lands here
      // again; this is what ends that.
      const target = ratio ?? window.devicePixelRatio;
      if (Math.abs(map.getPixelRatio() - target) < 1e-6) return;
      // Null rather than the device's ratio, so the map goes on following a
      // later change of it; MapLibre accepts null, its type does not say so.
      map.setPixelRatio(ratio as number);
      syncDeckDrawingBuffer(map);
      map.triggerRepaint();
    };
    apply();
    map.on("resize", apply);
    return () => {
      map.off("resize", apply);
    };
  }, [mapRef, maxPixels]);

  // The sync above finds deck.gl's device through luma.gl, and a deck.gl or
  // luma.gl upgrade that moved it would make the sync do nothing: every
  // model drawn at the wrong size at Low and Medium. Dependency bumps merge
  // without the Playwright spec that catches it, so the first time deck.gl
  // draws models, check that its device can be found, and say so where
  // someone will see if it cannot. One lookup a frame until then.
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    let frames = 0;
    const check = () => {
      if (!map.getLayer(DECK_MODEL_GROUP)) return;
      if (deckDevice(map)) {
        map.off("render", check);
        return;
      }
      if (++frames < DECK_DEVICE_GRACE_FRAMES) return;
      map.off("render", check);
      console.warn(
        "RenderResolution: deck.gl's device cannot be found, so a lower render quality will draw 3D models at the wrong size. See tests/renderQuality.spec.ts.",
      );
    };
    map.on("render", check);
    return () => {
      map.off("render", check);
    };
  }, [mapRef]);

  return null;
}
