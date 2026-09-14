/** The slice of a MapLibre map this helper needs, so it can be tested alone. */
export type StyleReadiness = {
  getLayer(id: string): unknown;
  on(event: "styledata", handler: () => void): unknown;
  off(event: "styledata", handler: () => void): unknown;
};

/**
 * Runs `run` as soon as `layerId` exists in the map's style, and returns a
 * function that cancels a run still pending.
 *
 * Changing a layer's visibility, a source's data or the terrain only needs the
 * style to be parsed. `map.isStyleLoaded()` asks for far more — every source
 * loaded — and so is false for as long as vehicle frames keep a GeoJSON source
 * busy; the `'idle'` event it used to be paired with can then stay away
 * indefinitely. Measured with vehicles streaming and deck.gl models drawn, it
 * was false in every sample and no idle arrived within 8 s, which silently
 * dropped 2D/3D toggles.
 */
export function whenLayerExists(
  map: StyleReadiness,
  layerId: string,
  run: () => void,
): () => void {
  if (map.getLayer(layerId)) {
    run();
    return () => {};
  }
  const onStyleData = () => {
    if (!map.getLayer(layerId)) return;
    map.off("styledata", onStyleData);
    run();
  };
  map.on("styledata", onStyleData);
  return () => {
    map.off("styledata", onStyleData);
  };
}
