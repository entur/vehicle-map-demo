/** South-west and north-east corners as [longitude, latitude], like the Filter's box. */
export type ViewBounds = [[number, number], [number, number]];

/**
 * Each side of the view is widened by this share of its span, so a vehicle
 * whose position is just off screen still gets the model that reaches into
 * it — at street zoom, a tenth of the view is tens of metres, more than half
 * the longest vehicle.
 */
const MARGIN = 0.1;

/**
 * The vehicles inside the view, widened by `MARGIN`, in their original order.
 *
 * Normally the subscription's bounding box already keeps the data to the
 * view, and this changes nothing. Straight after a jump from the whole
 * country to one street it does not: the data is the country until the new
 * subscription's first frame, and models built from it came to over a
 * thousand layers and froze the page for seconds.
 */
export function vehiclesInView<
  T extends { location: { longitude: number; latitude: number } },
>(vehicles: T[], [[west, south], [east, north]]: ViewBounds): T[] {
  const dLon = (east - west) * MARGIN;
  const dLat = (north - south) * MARGIN;
  return vehicles.filter(
    ({ location: { longitude, latitude } }) =>
      longitude >= west - dLon &&
      longitude <= east + dLon &&
      latitude >= south - dLat &&
      latitude <= north + dLat,
  );
}
