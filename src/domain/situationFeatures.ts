import type { Feature, LineString, Point } from "geojson";
import { NationalSituation, SeverityEnumeration, StopRef } from "../types.ts";

export type SituationFeatureProperties = {
  situationNumber: string;
  severity: SeverityEnumeration | null;
  reportType: string | null;
  codespaceId: string | null;
  /** Which affects member produced this feature. */
  source: "stopPoint" | "stopPlace" | "line" | "datedServiceJourney";
  /** The stop id or line ref the feature was built from. */
  entityId: string;
  name: string | null;
};

export type SituationPointFeature = Feature<Point, SituationFeatureProperties>;
export type SituationLineFeature = Feature<
  LineString,
  SituationFeatureProperties
>;

/** Line ref or journey id → decoded `[longitude, latitude]` pairs. An empty array means "looked up, none available". */
export type LineGeometryCache = ReadonlyMap<string, number[][]>;

const EMPTY_GEOMETRY: LineGeometryCache = new Map();

export type SituationFeatures = {
  pointFeatures: SituationPointFeature[];
  lineFeatures: SituationLineFeature[];
  featureCountBySituation: Map<string, number>;
  /** Situation numbers that produced no features at all, in input order. */
  unmappable: string[];
};

/** Every distinct dated service journey id mentioned by any of these situations, in first-seen order. */
export function collectDatedServiceJourneyRefs(
  situations: NationalSituation[],
): string[] {
  const refs = new Set<string>();
  for (const situation of situations) {
    for (const journey of situation.affects?.datedServiceJourneys ?? []) {
      if (journey.id) refs.add(journey.id);
    }
  }
  return [...refs];
}

/** Every distinct line ref mentioned by any of these situations, in first-seen order. */
export function collectLineRefs(situations: NationalSituation[]): string[] {
  const refs = new Set<string>();
  for (const situation of situations) {
    for (const line of situation.affects?.lines ?? []) {
      if (line.lineRef) refs.add(line.lineRef);
    }
  }
  return [...refs];
}

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
 * Flattens each situation's `affects` into GeoJSON.
 *
 * Deduplication is **within** a situation only, keyed by stop id and line ref.
 * Two situations affecting the same stop deliberately produce two coincident
 * features — that overlap is the point of a feed-debugging tool, and collapsing
 * it would hide exactly the duplication worth seeing.
 *
 * Nothing is averaged, invented, or given a synthetic centroid: a situation that
 * flattens to no features is reported in `unmappable` instead.
 */
export function buildSituationFeatures(
  situations: NationalSituation[],
  lineGeometry: LineGeometryCache,
  journeyGeometry: LineGeometryCache = EMPTY_GEOMETRY,
): SituationFeatures {
  const pointFeatures: SituationPointFeature[] = [];
  const lineFeatures: SituationLineFeature[] = [];
  const featureCountBySituation = new Map<string, number>();
  const unmappable: string[] = [];

  for (const situation of situations) {
    const before = pointFeatures.length + lineFeatures.length;
    const seen = new Set<string>();

    const addStops = (stops: StopRef[], source: "stopPoint" | "stopPlace") => {
      for (const stop of stops) {
        const key = `${source}:${stop.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const latitude = stop.location?.latitude;
        const longitude = stop.location?.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        pointFeatures.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [longitude as number, latitude as number],
          },
          properties: propertiesFor(
            situation,
            source,
            stop.id,
            stop.name ?? null,
          ),
        });
      }
    };

    addStops(situation.affects?.stopPoints ?? [], "stopPoint");
    addStops(situation.affects?.stopPlaces ?? [], "stopPlace");

    for (const line of situation.affects?.lines ?? []) {
      if (!line.lineRef) continue;
      const key = `line:${line.lineRef}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const coordinates = lineGeometry.get(line.lineRef);
      if (!coordinates || coordinates.length < 2) continue;

      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: propertiesFor(
          situation,
          "line",
          line.lineRef,
          line.lineName ?? null,
        ),
      });
    }

    for (const journey of situation.affects?.datedServiceJourneys ?? []) {
      if (!journey.id) continue;
      const key = `datedServiceJourney:${journey.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const coordinates = journeyGeometry.get(journey.id);
      if (!coordinates || coordinates.length < 2) continue;

      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: propertiesFor(
          situation,
          "datedServiceJourney",
          journey.id,
          null,
        ),
      });
    }

    const produced = pointFeatures.length + lineFeatures.length - before;
    featureCountBySituation.set(situation.situationNumber, produced);
    if (produced === 0) unmappable.push(situation.situationNumber);
  }

  return { pointFeatures, lineFeatures, featureCountBySituation, unmappable };
}
