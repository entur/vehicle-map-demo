/**
 * Decode a Google-encoded polyline string into a GeoJSON-compatible coordinate
 * array. Each output coordinate is `[longitude, latitude]` (note: the encoded
 * format puts latitude first; we swap so it can drop into a GeoJSON
 * `LineString` directly).
 *
 * Reference test (eyeball only, no test runner in repo):
 *   decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
 *   ≈ [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]
 */
export function decodePolyline(encoded: string): number[][] {
  if (!encoded) return [];

  const coordinates: number[][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const length = encoded.length;

  while (index < length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng * 1e-5, lat * 1e-5]);
  }

  return coordinates;
}
