/**
 * The selection set behind the `Situation` type, split in two.
 *
 * `SituationFields` is what the timetable subscription selects at both the
 * trip and the call level; it must not grow without a matching change to
 * `Situation` in types.ts.
 *
 * `SituationQaFields` is the extra metadata only the national situations feed
 * needs. Both fragments target the same GraphQL type, so the situations
 * subscription spreads them side by side.
 */
export const SITUATION_FIELDS_FRAGMENT = `
  fragment SituationFields on Situation {
    situationNumber
    version
    severity
    reportType
    summary { value language }
    description { value language }
    advice { value language }
    validityPeriods { startTime endTime }
    infoLinks { uri labels { value language } }
  }
`;

export const SITUATION_QA_FIELDS_FRAGMENT = `
  fragment SituationQaFields on Situation {
    participantRef
    codespace { codespaceId }
    sourceType
    progress
    priority
    planned
    creationTime
    versionedAtTime
    lastUpdated
    expiration
    openEnded
    age
    affects {
      vehicleModes
      lines { lineRef lineName publicCode }
      stopPoints { id name location { latitude longitude } }
      stopPlaces { id name location { latitude longitude } }
      serviceJourneys { id date }
      datedServiceJourneys { id }
      operators { operatorRef name }
    }
  }
`;
