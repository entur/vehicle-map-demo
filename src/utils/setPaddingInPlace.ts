export type Edges = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * The slice of a MapLibre map this helper needs, so it can be tested alone.
 * `C` is whatever `unproject` returns and `jumpTo` takes back as a centre.
 */
export type PaddableMap<C> = {
  /** Typed partial by MapLibre, but it always returns all four edges. */
  getPadding(): Partial<Edges>;
  getCanvas(): { clientWidth: number; clientHeight: number };
  unproject(point: [number, number]): C;
  jumpTo(options: { center: C; padding: Edges }): unknown;
};

/**
 * Changes some of the map's padding without moving what is on screen.
 *
 * MapLibre keeps the centre coordinate when the padding changes and moves
 * where it is drawn, so padding alone slides the whole map by half the
 * change. Instead the map is re-centred on whatever is drawn at the new padded
 * centre right now, which leaves every feature where it was.
 *
 * Done at once rather than eased, so no later camera move in the same commit
 * can cancel it half way: an eased padding change is lost to any easeTo that
 * starts before it finishes.
 */
export function setPaddingInPlace<C>(
  map: PaddableMap<C>,
  padding: Partial<Edges>,
): void {
  const current = map.getPadding();
  const from: Edges = {
    top: current.top ?? 0,
    bottom: current.bottom ?? 0,
    left: current.left ?? 0,
    right: current.right ?? 0,
  };
  const to: Edges = { ...from, ...padding };
  if (
    to.top === from.top &&
    to.bottom === from.bottom &&
    to.left === from.left &&
    to.right === from.right
  ) {
    return;
  }
  const { clientWidth: w, clientHeight: h } = map.getCanvas();
  const center = map.unproject([
    to.left + (w - to.left - to.right) / 2,
    to.top + (h - to.top - to.bottom) / 2,
  ]);
  map.jumpTo({ center, padding: to });
}
