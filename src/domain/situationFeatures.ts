import type { Feature, LineString, Point } from "geojson";
import { NationalSituation, SeverityEnumeration, StopRef } from "../types.ts";
import { decodePolyline } from "../utils/decodePolyline.ts";

export type SituationFeatureProperties = {
  situationNumber: string;
  severity: SeverityEnumeration | null;
  reportType: string | null;
  codespaceId: string | null;
  /** Which affects member produced this feature. */
  source:
    | "stopPoint"
    | "stopPlace"
    | "journeyStop"
    | "lineStop"
    | "journeySpan"
    | "lineSpan";
  /**
   * The stop id for the four point sources, the journey id for a
   * `journeySpan`, or the line ref for a `lineSpan`.
   */
  entityId: string;
  name: string | null;
};

export type SituationPointFeature = Feature<Point, SituationFeatureProperties>;
export type SituationLineFeature = Feature<
  LineString,
  SituationFeatureProperties
>;

export type SituationFeatures = {
  pointFeatures: SituationPointFeature[];
  lineFeatures: SituationLineFeature[];
  featureCountBySituation: Map<string, number>;
  /** Situation numbers that produced no features at all, in input order. */
  unmappable: string[];
};

function propertiesFor(
  situation: NationalSituation,
  source: SituationFeatureProperties["source"],
  entityId: string,
  name: string | null,
): SituationFeatureProperties {
  return {
    situationNumber: situation.situationNumber,
    severity: situation.severity,
    reportType: situation.reportType,
    codespaceId: situation.codespace?.codespaceId ?? null,
    source,
    entityId,
    name,
  };
}

/**
 * Flattens each situation's `affects` into GeoJSON. Pure: every coordinate here
 * arrives with the feed, so no lookup, cache or network call is involved.
 *
 * Deduplication is **within** a situation only — points by stop id across all
 * four stop sources, journey spans by journey id, line spans by line ref. Two
 * situations affecting the same stop deliberately produce two coincident
 * features; that overlap is the point of a feed-debugging tool, and
 * collapsing it would hide exactly the duplication
 * worth seeing.
 *
 * Nothing is averaged, invented, or given a synthetic centroid: a situation that
 * flattens to no features is reported in `unmappable` instead.
 */
export function buildSituationFeatures(
  situations: NationalSituation[],
): SituationFeatures {
  const pointFeatures: SituationPointFeature[] = [];
  const lineFeatures: SituationLineFeature[] = [];
  const featureCountBySituation = new Map<string, number>();
  const unmappable: string[] = [];

  for (const situation of situations) {
    const before = pointFeatures.length + lineFeatures.length;
    const seen = new Set<string>();

    // Keyed on the stop id alone, not on source + id: the same stop reached as
    // a journey stop and as a line stop is one stop, and two coincident markers
    // for it would be noise. Measured on the dev feed, the four stop sources
    // overlap on zero stops today, so this only guards against future data.
    const addStop = (
      entry: StopRef,
      source: "stopPoint" | "stopPlace" | "journeyStop" | "lineStop",
    ) => {
      if (seen.has(entry.id)) return;

      const latitude = entry.location?.latitude;
      const longitude = entry.location?.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      // Marked seen only after the coordinate check, so a stop that arrives
      // unlocated from one source and located from another is still drawn.
      seen.add(entry.id);

      pointFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [longitude as number, latitude as number],
        },
        properties: propertiesFor(
          situation,
          source,
          entry.id,
          entry.name ?? null,
        ),
      });
    };

    for (const stop of situation.affects?.stopPoints ?? [])
      addStop(stop, "stopPoint");
    for (const stop of situation.affects?.stopPlaces ?? [])
      addStop(stop, "stopPlace");
    for (const journey of situation.affects?.vehicleJourneys ?? []) {
      for (const entry of journey.stops ?? [])
        addStop(entry.stop, "journeyStop");
    }
    for (const affectedLine of situation.affects?.affectedLines ?? []) {
      for (const entry of affectedLine.stops ?? [])
        addStop(entry.stop, "lineStop");
    }

    // The feed's own geometry: the span between the first and last affected
    // stop, or the whole route when the situation names no stops at all. The
    // API withholds it rather than guess — one affected stop is a point, not a
    // span — so a journey with no span here is not a gap to fill in.
    for (const journey of situation.affects?.vehicleJourneys ?? []) {
      const points = journey.affectedPointsOnLink?.points;
      if (!points) continue;

      const journeyId =
        journey.datedServiceJourney?.id ?? journey.serviceJourney?.id;
      if (!journeyId) continue;

      const key = `journeySpan:${journeyId}`;
      if (seen.has(key)) continue;

      const coordinates = decodePolyline(points);
      if (coordinates.length < 2) continue;

      // Marked seen only after the polyline is confirmed decodable, mirroring
      // addStop above: a journey listed twice whose first entry's polyline
      // doesn't decode must not block its second, valid entry.
      seen.add(key);

      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: propertiesFor(
          situation,
          "journeySpan",
          journeyId,
          journey.line?.lineName ?? null,
        ),
      });
    }

    // Lines carry geometry too, but with a caveat the journey span does not
    // have: it is one representative pattern, not the line. The API picks the
    // first pattern the affected stops locate on, or the longest when the line
    // is affected as a whole, and withholds it entirely rather than guess.
    for (const affectedLine of situation.affects?.affectedLines ?? []) {
      const points = affectedLine.affectedPointsOnLink?.points;
      if (!points) continue;

      const lineRef = affectedLine.line?.lineRef;
      if (!lineRef) continue;

      const key = `lineSpan:${lineRef}`;
      if (seen.has(key)) continue;

      const coordinates = decodePolyline(points);
      if (coordinates.length < 2) continue;

      // Marked seen only after the polyline is confirmed decodable, mirroring
      // addStop and the journey span loop above.
      seen.add(key);

      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: propertiesFor(
          situation,
          "lineSpan",
          lineRef,
          affectedLine.line?.lineName ?? null,
        ),
      });
    }

    const produced = pointFeatures.length + lineFeatures.length - before;
    featureCountBySituation.set(situation.situationNumber, produced);
    if (produced === 0) unmappable.push(situation.situationNumber);
  }

  return { pointFeatures, lineFeatures, featureCountBySituation, unmappable };
}
