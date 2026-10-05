import { describe, expect, it } from "vitest";
import { Edges, PaddableMap, setPaddingInPlace } from "./setPaddingInPlace.ts";

/** A flat 400×800 map whose screen points are their own coordinates. */
function fakeMap(padding: Edges) {
  const jumps: { center: [number, number]; padding: Edges }[] = [];
  const map: PaddableMap<[number, number]> = {
    getPadding: () => padding,
    getCanvas: () => ({ clientWidth: 400, clientHeight: 800 }),
    unproject: ([x, y]) => [x, y],
    jumpTo: (options) => jumps.push(options),
  };
  return { map, jumps };
}

const NONE = { top: 0, bottom: 0, left: 0, right: 0 };

describe("setPaddingInPlace", () => {
  it("centres on what is drawn at the new padded centre, so nothing moves", () => {
    const { map, jumps } = fakeMap({ ...NONE, top: 280 });
    setPaddingInPlace(map, { top: 0 });
    // Padded centre was (200, 540); with no padding it is (200, 400), and
    // the map is re-centred on whatever is drawn there now.
    expect(jumps).toEqual([{ center: [200, 400], padding: NONE }]);
  });

  it("combines the edges it is given with the ones it is not", () => {
    const { map, jumps } = fakeMap({ ...NONE, top: 100, bottom: 200 });
    setPaddingInPlace(map, { bottom: 0 });
    expect(jumps).toEqual([
      { center: [200, 450], padding: { ...NONE, top: 100 } },
    ]);
  });

  it("does nothing when the padding already matches", () => {
    const { map, jumps } = fakeMap({ ...NONE, top: 100 });
    setPaddingInPlace(map, { top: 100, bottom: 0 });
    expect(jumps).toEqual([]);
  });
});
