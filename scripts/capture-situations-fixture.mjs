// Refreshes src/__fixtures__/situations.json from the dev API.
// Run with: npm run capture-fixtures
import { writeFileSync } from "node:fs";

const ENDPOINT = "https://api.dev.entur.io/realtime/v2/vehicles/graphql";
const CLIENT_NAME = "entur-vehicle-map-demo-dev";
const PER_SHAPE = 3;

const QUERY = `
  {
    situations {
      situationNumber version severity reportType
      summary { value language }
      description { value language }
      advice { value language }
      validityPeriods { startTime endTime }
      infoLinks { uri labels { value language } }
      participantRef codespace { codespaceId } sourceType progress priority
      planned creationTime versionedAtTime lastUpdated expiration openEnded age
      affects {
        vehicleModes
        stopPoints { id name location { latitude longitude } }
        stopPlaces { id name location { latitude longitude } }
        operators { operatorRef name }
        vehicleJourneys {
          serviceJourney { id }
          datedServiceJourney { id }
          line { lineRef lineName publicCode }
          operator { operatorRef name }
          stops { stop { id name location { latitude longitude } } stopConditions }
          affectedPointsOnLink { points length }
        }
        affectedLines {
          line { lineRef lineName publicCode }
          stops { stop { id name location { latitude longitude } } stopConditions }
          affectedPointsOnLink { points length }
        }
      }
    }
  }
`;

const KINDS = [
  "affectedLines",
  "vehicleJourneys",
  "stopPoints",
  "stopPlaces",
  "operators",
];

const shapeOf = (situation) => {
  const affects = situation.affects ?? {};
  const present = KINDS.filter((kind) => (affects[kind] ?? []).length > 0);
  return present.length ? present.join("+") : "(empty)";
};

const fanOutOf = (situation) => {
  const affects = situation.affects ?? {};
  return KINDS.reduce((total, kind) => total + (affects[kind] ?? []).length, 0);
};

// `shapeOf` counts affects *kinds*, not whether a journey or line carries a
// span, so sampling by shape alone can drop every situation with a span at
// random. Always keep at least one of each, the same way `widest` is always
// kept — a journey-span carrier does not guarantee a line-span carrier, or
// vice versa, so both are picked independently.
const hasJourneySpan = (situation) =>
  (situation.affects?.vehicleJourneys ?? []).some(
    (journey) => (journey.affectedPointsOnLink?.points ?? "").length > 0,
  );

const hasLineSpan = (situation) =>
  (situation.affects?.affectedLines ?? []).some(
    (line) => (line.affectedPointsOnLink?.points ?? "").length > 0,
  );

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "ET-Client-Name": CLIENT_NAME,
  },
  body: JSON.stringify({ query: QUERY }),
});

const body = await response.json();
if (body.errors) {
  console.error(JSON.stringify(body.errors, null, 2));
  process.exit(1);
}

const all = body.data.situations;
const perShape = new Map();
for (const situation of all) {
  const shape = shapeOf(situation);
  const bucket = perShape.get(shape) ?? [];
  if (bucket.length < PER_SHAPE) bucket.push(situation);
  perShape.set(shape, bucket);
}

const picked = [...perShape.values()].flat();
const widest = all.reduce((a, b) => (fanOutOf(a) >= fanOutOf(b) ? a : b));
if (!picked.some((s) => s.situationNumber === widest.situationNumber)) {
  picked.push(widest);
}

const journeySpanCarrier = all.find(hasJourneySpan);
if (
  journeySpanCarrier &&
  !picked.some((s) => s.situationNumber === journeySpanCarrier.situationNumber)
) {
  picked.push(journeySpanCarrier);
}

const lineSpanCarrier = all.find(hasLineSpan);
if (
  lineSpanCarrier &&
  !picked.some((s) => s.situationNumber === lineSpanCarrier.situationNumber)
) {
  picked.push(lineSpanCarrier);
}

writeFileSync(
  new URL("../src/__fixtures__/situations.json", import.meta.url),
  JSON.stringify({ situations: picked }, null, 2) + "\n",
);

console.log(
  `captured ${picked.length} of ${all.length} situations; shapes: ${[...perShape.keys()].join(", ")}`,
);
