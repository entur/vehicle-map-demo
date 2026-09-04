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
        lines { lineRef lineName publicCode }
        stopPoints { id name location { latitude longitude } }
        stopPlaces { id name location { latitude longitude } }
        serviceJourneys { id date }
        datedServiceJourneys { id }
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
        }
      }
    }
  }
`;

const KINDS = [
  "lines",
  "stopPoints",
  "stopPlaces",
  "serviceJourneys",
  "datedServiceJourneys",
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

writeFileSync(
  new URL("../src/__fixtures__/situations.json", import.meta.url),
  JSON.stringify({ situations: picked }, null, 2) + "\n",
);

console.log(
  `captured ${picked.length} of ${all.length} situations; shapes: ${[...perShape.keys()].join(", ")}`,
);
