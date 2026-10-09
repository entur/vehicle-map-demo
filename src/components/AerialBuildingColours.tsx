import { useEffect, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { MapSourceDataEvent } from "maplibre-gl";
import { ROOF_COLOUR_STATE } from "../domain/baseMapScheme.ts";
import {
  Bbox,
  PhotoSample,
  TILE_SIZE,
  bboxesIntersect,
  footprintsById,
  medianColour,
  samplePoints,
  sampleZoomFor,
} from "../domain/roofColour.ts";
import { BUILDINGS_3D_FILTER, BUILDINGS_3D_MIN_ZOOM } from "./mapStyle.ts";
import { whenLayerExists } from "../utils/whenLayerExists.ts";
import { throttle } from "../utils/throttle.ts";
import { limitConcurrency } from "../utils/limitConcurrency.ts";
import { fetchNibTile } from "../utils/norgeIBilder.ts";

const BUILDINGS = { source: "openmaptiles", sourceLayer: "building" };
const BUILDINGS_LAYER = "buildings-3d-layer";

/**
 * Decoded photo tiles kept at once, about 260 KB each, least recently used
 * dropped first. Sampling at about screen resolution (`sampleZoomFor`) needs
 * a few dozen for one screen.
 */
const MAX_CACHED_TILES = 96;

/** Photo tiles fetched and decoded at once; decoding happens on the main thread. */
const MAX_TILE_LOADS = 6;

/**
 * Roof colours kept, least recently seen dropped first: seven bytes and an id
 * each, so a long session across a city stays small. A dropped building is
 * simply sampled again if it comes back into view.
 */
const MAX_STORED_COLOURS = 50_000;

/** At most one sampling pass per this interval while the map moves. */
const PASS_INTERVAL_MS = 250;

type TilePixels = Promise<Uint8ClampedArray | null>;

async function loadTilePixels(z: number, x: number, y: number): TilePixels {
  try {
    const response = await fetchNibTile({ z, x, y });
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
    bitmap.close();
    return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
  } catch {
    return null;
  }
}

/**
 * Colours each 3D building with its roof's median colour in the aerial photo,
 * through feature-state that buildingColour() reads. While inactive the state
 * is removed, so the scheme's colour returns; colours already sampled are kept
 * and re-applied, as their buildings are loaded, on the next activation, so a
 * 2D/3D round trip fetches nothing.
 */
export function AerialBuildingColours({ active }: { active: boolean }) {
  const { current: mapRef } = useMap();
  const colours = useRef(new Map<string | number, string>());
  const tiles = useRef(new Map<string, TilePixels>());
  const [limitTileLoads] = useState(() => limitConcurrency(MAX_TILE_LOADS));

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    // The layer, not just the source: see whenLayerExists. Colouring that
    // started before the style had loaded used to give up for good.
    if (!active) {
      return whenLayerExists(map, BUILDINGS_LAYER, () =>
        map.removeFeatureState(BUILDINGS),
      );
    }

    let cancelled = false;
    const pending = new Set<string | number>();
    // Stored colours put back this activation. Only loaded buildings are
    // given theirs, as passes find them — not every building ever coloured.
    const applied = new Set<string | number>();
    const remember = (id: string | number, colour: string) => {
      // Most recently seen last, so eviction takes the stalest.
      colours.current.delete(id);
      colours.current.set(id, colour);
      if (colours.current.size > MAX_STORED_COLOURS) {
        colours.current.delete(colours.current.keys().next().value!);
      }
    };
    const apply = (id: string | number, colour: string) =>
      map.setFeatureState(
        { ...BUILDINGS, id },
        { [ROOF_COLOUR_STATE]: colour },
      );

    const tilePixels = (z: number, x: number, y: number): TilePixels => {
      const key = `${z}/${x}/${y}`;
      const cached = tiles.current.get(key);
      if (cached) {
        // Most recently used last, so eviction takes the stalest.
        tiles.current.delete(key);
        tiles.current.set(key, cached);
        return cached;
      }
      const loaded = limitTileLoads(() => loadTilePixels(z, x, y));
      tiles.current.set(key, loaded);
      if (tiles.current.size > MAX_CACHED_TILES) {
        tiles.current.delete(tiles.current.keys().next().value!);
      }
      // A failure is not remembered: a blip would otherwise leave every
      // building on this tile uncoloured for the session.
      void loaded.then((pixels) => {
        if (!pixels && tiles.current.get(key) === loaded) {
          tiles.current.delete(key);
        }
      });
      return loaded;
    };

    const colourBuilding = async (
      id: string | number,
      zoom: number,
      samples: PhotoSample[],
    ) => {
      const rgbs: [number, number, number][] = [];
      await Promise.all(
        samples.map(async (sample) => {
          const pixels = await tilePixels(zoom, sample.tileX, sample.tileY);
          if (!pixels) return;
          const i = (sample.py * TILE_SIZE + sample.px) * 4;
          rgbs.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }),
      );
      pending.delete(id);
      // Arrived after deactivation: not stored either, or the next
      // activation — which re-applies stored colours before sampling — would
      // skip this building as done without ever having applied it.
      if (cancelled) return;
      const colour = medianColour(rgbs);
      if (!colour) return;
      remember(id, colour);
      applied.add(id);
      apply(id, colour);
    };

    const colourVisible = () => {
      if (cancelled || map.getZoom() < BUILDINGS_3D_MIN_ZOOM) return;
      const bounds = map.getBounds();
      const view: Bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const zoom = sampleZoomFor(map.getZoom());
      const footprints = footprintsById(
        map.querySourceFeatures(BUILDINGS.source, {
          sourceLayer: BUILDINGS.sourceLayer,
          filter: BUILDINGS_3D_FILTER,
        }),
      );
      for (const [id, footprint] of footprints) {
        const stored = colours.current.get(id);
        if (stored) {
          if (!applied.has(id)) {
            applied.add(id);
            remember(id, stored);
            apply(id, stored);
          }
          continue;
        }
        // Any overlap with the view counts, so a large building whose first
        // corner happens to lie off-screen is not skipped.
        if (pending.has(id) || !bboxesIntersect(footprint.bbox, view)) continue;
        pending.add(id);
        void colourBuilding(id, zoom, samplePoints(footprint.geometry, zoom));
      }
    };

    // A throttle, not a debounce: the chase camera fires moveend every frame,
    // which kept a debounce from ever running for the length of a chase.
    const pass = throttle(colourVisible, PASS_INTERVAL_MS);
    const onSourceData = (event: MapSourceDataEvent) => {
      if (event.sourceId === BUILDINGS.source && event.tile) pass();
    };

    let listening = false;
    const cancelStart = whenLayerExists(map, BUILDINGS_LAYER, () => {
      map.on("moveend", pass);
      map.on("sourcedata", onSourceData);
      listening = true;
      pass();
    });

    return () => {
      cancelled = true;
      cancelStart();
      pass.cancel();
      if (listening) {
        map.off("moveend", pass);
        map.off("sourcedata", onSourceData);
      }
    };
  }, [active, mapRef, limitTileLoads]);

  return null;
}
