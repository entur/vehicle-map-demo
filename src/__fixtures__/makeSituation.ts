import { NationalSituation } from "../types.ts";

const BASE: NationalSituation = {
  situationNumber: "TST:SituationNumber:1",
  version: 1,
  severity: "normal",
  reportType: "INCIDENT",
  summary: [{ value: "Summary", language: "NO" }],
  description: [],
  advice: [],
  validityPeriods: [
    { startTime: "2026-08-01T00:00:00Z", endTime: "2026-09-01T00:00:00Z" },
  ],
  infoLinks: [],
  participantRef: "TST",
  codespace: { codespaceId: "TST" },
  sourceType: "DIRECT_REPORT",
  progress: "open",
  priority: 5,
  planned: null,
  creationTime: "2026-08-01T00:00:00Z",
  versionedAtTime: null,
  lastUpdated: "2026-08-01T00:00:00Z",
  expiration: null,
  openEnded: false,
  age: "PT24H",
  affects: null,
};

/** A situation with sensible defaults, so each test states only what it cares about. */
export function makeSituation(
  overrides: Partial<NationalSituation> = {},
): NationalSituation {
  return { ...BASE, ...overrides };
}
