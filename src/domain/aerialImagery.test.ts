import { describe, expect, it } from "vitest";
import {
  AERIAL_SOURCE_SPEC,
  nibTileUrl,
  parseNibTileUrl,
} from "./aerialImagery.ts";

describe("parseNibTileUrl", () => {
  it("reads the tile the source's own template names", () => {
    const url = AERIAL_SOURCE_SPEC.tiles![0].replace("{z}", "15")
      .replace("{x}", "17360")
      .replace("{y}", "9524");
    expect(parseNibTileUrl(url)).toEqual({ z: 15, x: 17360, y: 9524 });
  });

  it("rejects anything else", () => {
    expect(parseNibTileUrl("norgeibilder://15/17360")).toBeNull();
    expect(parseNibTileUrl("https://15/17360/9524")).toBeNull();
    expect(parseNibTileUrl("norgeibilder://15/a/9524")).toBeNull();
  });
});

describe("nibTileUrl", () => {
  it("puts the row before the column and escapes the token", () => {
    expect(nibTileUrl({ z: 15, x: 17360, y: 9524 }, "a+b/c")).toBe(
      "https://tilecache.norgeibilder.no/arcgis/rest/services/Nibcache_web_mercator_v2/MapServer/tile/15/9524/17360?token=a%2Bb%2Fc",
    );
  });
});
