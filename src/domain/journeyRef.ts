import { AffectedVehicleJourney, NationalSituation } from "../types.ts";

/**
 * Which slot of an `AffectedVehicleJourney` a ref was published in. The two are
 * fed by different SIRI elements upstream, so the slot names the element the
 * publisher chose — see `mistypedJourneyRefs`.
 */
export type JourneyRefSlot = "datedServiceJourney" | "serviceJourney";

export type MistypedJourneyRef = {
  id: string;
  slot: JourneyRefSlot;
  /** The type the id actually declares, or null when it is not a NeTEx id at all. */
  actualType: string | null;
};

/** The NeTEx type each slot's ids must declare. */
const EXPECTED_TYPE: Record<JourneyRefSlot, string> = {
  datedServiceJourney: "DatedServiceJourney",
  serviceJourney: "ServiceJourney",
};

/**
 * The type segment of a NeTEx id (`<codespace>:<Type>:<value>`), or null when
 * the id does not have one.
 *
 * Split on the first two separators only: the value may itself contain colons,
 * and an id with four segments is still a well-formed id whose type is its
 * second.
 */
export function netexType(id: string): string | null {
  const parts = id.split(":");
  if (parts.length < 3) return null;
  return parts[1] === "" ? null : parts[1];
}

/**
 * Journey refs whose id declares a different NeTEx type than the slot it
 * arrived in — a publisher error, detectable from the id alone.
 *
 * Measured on the dev feed, the case that occurs is a `ServiceJourney` id in
 * the `datedServiceJourney` slot. That slot is fed by SIRI's standalone
 * `DatedVehicleJourneyRef` element, so such an id means the publisher put a
 * service journey id in an element reserved for dated ones. It is not the
 * ordinary SIRI framed-ref convention being misread: a `FramedVehicleJourneyRef`
 * is mapped to the `serviceJourney` slot upstream, date and all, and never
 * reaches this one.
 *
 * The consequence is not cosmetic. The API resolves the dated slot against
 * planned data, misses, and therefore publishes no `affectedPointsOnLink` — so
 * a situation whose journeys are all tagged this way has no geometry and
 * cannot be drawn, despite the id it carries being perfectly resolvable.
 *
 * Both directions are checked, though only one occurs today: a check that
 * looked one way could never report the other starting.
 *
 * Deduplicated per slot within a situation and returned in first-seen order, so
 * a situation naming one bad ref across twenty entries reports it once.
 */
export function mistypedJourneyRefs(
  situation: NationalSituation,
): MistypedJourneyRef[] {
  const refs: MistypedJourneyRef[] = [];
  const seen = new Set<string>();

  for (const journey of situation.affects?.vehicleJourneys ?? []) {
    for (const ref of mistypedRefsOf(journey)) {
      const key = `${ref.slot}:${ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
  }

  return refs;
}

/**
 * The same check for one journey entry, undeduplicated — what the detail drawer
 * needs to annotate the row it is already rendering.
 */
export function mistypedRefsOf(
  journey: AffectedVehicleJourney,
): MistypedJourneyRef[] {
  const refs: MistypedJourneyRef[] = [];

  for (const slot of ["datedServiceJourney", "serviceJourney"] as const) {
    const id = journey[slot]?.id;
    if (!id) continue;

    const actualType = netexType(id);
    if (actualType === EXPECTED_TYPE[slot]) continue;

    refs.push({ id, slot, actualType });
  }

  return refs;
}

/**
 * The defect in one line, phrased in terms of the GraphQL slot rather than the
 * SIRI element behind it. The slot is what the reader can see in the response
 * next to this text; which SIRI element fed it is a fact about the producer,
 * and belongs in the report that goes to them, not in a row of the drawer.
 */
export function describeMistype(ref: MistypedJourneyRef): string {
  const found = ref.actualType ? `${ref.actualType} id` : "malformed id";
  return `${found} in the ${ref.slot} slot`;
}
