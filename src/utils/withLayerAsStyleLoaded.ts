/** The slice of a MapLibre map this helper needs, so it can be tested alone. */
export type StyleLoadedQuery = {
  isStyleLoaded(): boolean | void;
  getLayer(id: string): unknown;
};

/**
 * Runs `run` with `map.isStyleLoaded()` answering whether `layerId` exists,
 * and restores the map's own answer afterwards.
 *
 * deck.gl's MapLibreOverlay adds and removes its interleaved layer group only
 * when `isStyleLoaded()` is true at the moment its layers change — and ours
 * change with each vehicle frame, whose `setData` is exactly what keeps it
 * false (see `whenLayerExists`). Measured, the group was never added outside
 * a chase, so the models were drawn over the finished map instead of between
 * its layers. Adding a layer only needs the style parsed, which the layer the
 * group is placed before existing proves. The override is an own property, so
 * deleting it brings back MapLibre's method from the prototype; `setProps`
 * resolves the groups synchronously, so nothing else sees it.
 */
export function withLayerAsStyleLoaded(
  map: StyleLoadedQuery,
  layerId: string,
  run: () => void,
): void {
  map.isStyleLoaded = () => map.getLayer(layerId) !== undefined;
  try {
    run();
  } finally {
    delete (map as Partial<StyleLoadedQuery>).isStyleLoaded;
  }
}
