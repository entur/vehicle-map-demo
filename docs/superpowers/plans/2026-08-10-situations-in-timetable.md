# Deviation messages (situations) in timetable data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the vehicle-positions API's new `Situation` deviation messages in the selected-vehicle panel, at both trip level and per-stop level.

**Architecture:** Two pure helper modules (`situationText.ts`, `situationSeverity.ts`) hold all the fiddly selection and colour logic and carry the unit tests. One presentational component (`SituationList.tsx`) renders an expandable list and is reused verbatim at both levels — trip-level under the panel header, stop-level inline under a timetable row. The subscription query gains a GraphQL fragment spread at both levels so the two selection sets cannot drift.

**Tech Stack:** React 19, TypeScript, MUI v9, `graphql-ws`, Vitest (node environment, `src/**/*.test.ts` only).

Design spec: `docs/superpowers/specs/2026-08-07-situations-in-timetable-design.md`

## Global Constraints

- **Deploy ordering.** The `situations` field currently exists **only on dev**. Staging and prod reject it with `Validation error (FieldUndefined@[timetables/situations])`, which kills the _entire_ timetable subscription, not just the new data. The API must be deployed to staging and prod before this branch is pushed. Do not add a config flag or schema probe — this was explicitly decided against.
- **No filtering.** Render every situation the feed delivers: all severities, all duplicates, no deduplication by `situationNumber` or by text. This is a feed-debugging tool. Surface `version` in the UI rather than discarding version regressions.
- **Norwegian first.** Situation _content_ prefers `NO`, then `EN`, then untagged. App chrome/labels stay English.
- **`undefined` severity is not grey.** It is 276 of 376 live records and they are real incidents. Only `noImpact` is greyed.
- ESM only; local imports carry explicit `.ts`/`.tsx` extensions.
- ESLint `react-refresh/only-export-components`: a `.tsx` component file must not export non-component values. Helper functions belong in `.ts` modules.
- Vitest is configured with `environment: "node"` and `include: ["src/**/*.test.ts"]` — **`.tsx` files are not collected**. Only pure `.ts` logic is unit-tested here; components are verified by `tsc -b`, ESLint, and the manual checklist.
- Every task ends with `npx prettier --write` on touched files (the Husky pre-commit hook runs it anyway; running it first keeps the commit clean).

---

### Task 1: Situation types and subscription fields

Adds the types and pulls the data over the wire. Nothing renders yet, but after this task the payload is visible in devtools.

**Files:**

- Modify: `src/types.ts` (add types after `Stop`/`CallType`; extend `Call` at `:145-158` and `EstimatedTimetableUpdate` at `:160-168`)
- Modify: `src/hooks/useTimetableSubscription.ts:10-49` (the `subscriptionQuery`)
- Modify: `src/components/SelectedVehiclePanel/callTimes.test.ts:5-27` (test fixture must satisfy the widened `Call`)

**Interfaces:**

- Consumes: nothing.
- Produces: `Situation`, `TranslatedString`, `ValidityPeriod`, `InfoLink`, `SeverityEnumeration` exported from `src/types.ts`; `Call.situations` and `EstimatedTimetableUpdate.situations`, both typed `Situation[] | null`.

- [ ] **Step 1: Add the situation types to `src/types.ts`**

Insert immediately above the existing `export type Call = {` block (currently line 145):

```ts
export type SeverityEnumeration =
  | "unknown"
  | "verySlight"
  | "slight"
  | "normal"
  | "severe"
  | "verySevere"
  | "noImpact"
  | "undefined";

export type TranslatedString = {
  value: string | null;
  language: string | null;
};

export type ValidityPeriod = {
  startTime: string | null;
  endTime: string | null;
};

export type InfoLink = {
  uri: string | null;
  labels: TranslatedString[];
};

/**
 * A deviation message from the realtime feed (SIRI situation exchange).
 *
 * Only the fields the panel renders are modelled. The API also returns
 * affects/detail/keywords/priority/progress/creationTime/openEnded/age — add
 * them here and to the query when something actually displays them.
 */
export type Situation = {
  situationNumber: string;
  version: number | null;
  severity: SeverityEnumeration | null;
  reportType: string | null;
  summary: TranslatedString[];
  description: TranslatedString[];
  advice: TranslatedString[];
  validityPeriods: ValidityPeriod[];
  infoLinks: InfoLink[];
};
```

- [ ] **Step 2: Extend `Call` and `EstimatedTimetableUpdate`**

In `src/types.ts`, add one line to each existing type. In `Call`, after `occupancyStatus`:

```ts
  occupancyStatus: OccupancyStatus | null;
  situations: Situation[] | null;
};
```

In `EstimatedTimetableUpdate`, after `calls`:

```ts
  calls: Call[];
  situations: Situation[] | null;
};
```

- [ ] **Step 3: Run the type-check to see the fixture break**

Run: `npm run build`

Expected: FAIL. `src/components/SelectedVehiclePanel/callTimes.test.ts` builds a literal `Call` and now misses a required property — something like `Property 'situations' is missing in type '{ stopPoint: ...; }' but required in type 'Call'`.

This failure is the point: `situations` is deliberately required-but-nullable rather than optional, so every construction site has to state whether situations exist.

- [ ] **Step 4: Fix the test fixture**

In `src/components/SelectedVehiclePanel/callTimes.test.ts`, add one line to the `call()` helper's defaults, after `occupancyStatus: null,`:

```ts
    occupancyStatus: null,
    situations: null,
    ...overrides,
```

- [ ] **Step 5: Verify the build and existing tests pass**

Run: `npm run build && npm test`

Expected: build succeeds; `callTimes.test.ts` passes unchanged in behaviour.

- [ ] **Step 6: Add the GraphQL fragment to the subscription**

In `src/hooks/useTimetableSubscription.ts`, define the fragment above `subscriptionQuery` (currently line 10):

```ts
const situationFieldsFragment = `
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
```

Then interpolate it into `subscriptionQuery` and spread it at both levels. The template literal becomes:

```ts
const subscriptionQuery = `
  ${situationFieldsFragment}

  subscription($serviceJourneyId: String!, $date: String!) {
    timetables(serviceJourneyIdAndDates: [{ id: $serviceJourneyId, date: $date }]) {
      serviceJourney {
        id
        date
      }
      line {
        lineRef
        lineName
        publicCode
      }
      mode
      originName
      destinationName
      cancellation
      situations {
        ...SituationFields
      }
      calls {
        stopPoint {
          id
          name
          location {
            latitude
            longitude
          }
        }
        order
        aimedArrivalTime
        aimedDepartureTime
        expectedArrivalTime
        expectedDepartureTime
        actualArrivalTime
        actualDepartureTime
        callType
        cancellation
        forBoarding
        occupancyStatus
        situations {
          ...SituationFields
        }
      }
    }
  }
`;
```

Note both spreads: one on `timetables` (trip level), one inside `calls` (stop level). A fragment is used rather than two copies specifically so they cannot drift apart.

- [ ] **Step 7: Verify the data arrives from dev**

Confirm `public/bootstrap.json` points at `api.dev.entur.io` (it does as of writing — the CLAUDE.md claim that it points at `localhost:8080` is stale).

Run: `npm run dev`

In the browser, open devtools → Network → WS → the `subscriptions` socket → Messages. Click a vehicle on the map, preferably a **SKY** (Bergen area) one — that codespace had the highest situation rate in sampling. Confirm incoming `next` frames contain a `situations` array on the timetable object, and that no `errors` array appears.

Expected: at least some frames carry non-empty `situations`. Roughly 40% did when sampled; if the first few vehicles show empty arrays that is normal, try several.

If instead every frame carries `"errors":[{"message":"Validation error (FieldUndefined@[timetables/situations])"...}]`, the endpoint in `bootstrap.json` is not the dev one — fix that before continuing, and do **not** work around it by removing the field.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/types.ts src/hooks/useTimetableSubscription.ts src/components/SelectedVehiclePanel/callTimes.test.ts
git add src/types.ts src/hooks/useTimetableSubscription.ts src/components/SelectedVehiclePanel/callTimes.test.ts
git commit -m "Add Situation types and fetch situations in the timetable subscription"
```

---

### Task 2: Translation-selection helpers

**Files:**

- Create: `src/components/SelectedVehiclePanel/situationText.ts`
- Test: `src/components/SelectedVehiclePanel/situationText.test.ts`

**Interfaces:**

- Consumes: `TranslatedString` from `src/types.ts` (Task 1).
- Produces:
  - `pickTranslation(strings: TranslatedString[] | null | undefined): string | null`
  - `isRedundant(text: string | null, summary: string | null): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/components/SelectedVehiclePanel/situationText.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { TranslatedString } from "../../types.ts";
import { isRedundant, pickTranslation } from "./situationText.ts";

function t(value: string | null, language: string | null): TranslatedString {
  return { value, language };
}

describe("pickTranslation", () => {
  test("prefers Norwegian over English", () => {
    expect(
      pickTranslation([
        t("Take the next train", "EN"),
        t("Ta neste tog", "NO"),
      ]),
    ).toBe("Ta neste tog");
  });

  test("falls back to English when there is no Norwegian", () => {
    expect(pickTranslation([t("Take the next train", "EN")])).toBe(
      "Take the next train",
    );
  });

  // Roughly a quarter of live records publish text with no language tag.
  test("falls back to an untagged entry when no tagged one is usable", () => {
    expect(pickTranslation([t("Endra trasé pga. vegarbeid", null)])).toBe(
      "Endra trasé pga. vegarbeid",
    );
  });

  test("matches the language tag case-insensitively", () => {
    expect(pickTranslation([t("engelsk", "en"), t("norsk", "no")])).toBe(
      "norsk",
    );
  });

  test("skips entries whose value is null or blank", () => {
    expect(
      pickTranslation([t(null, "NO"), t("   ", "EN"), t("brukbar", null)]),
    ).toBe("brukbar");
  });

  test("trims surrounding whitespace", () => {
    expect(pickTranslation([t("  Ta neste tog  ", "NO")])).toBe("Ta neste tog");
  });

  test("returns null for an empty, null or all-blank list", () => {
    expect(pickTranslation([])).toBeNull();
    expect(pickTranslation(null)).toBeNull();
    expect(pickTranslation([t(null, "NO"), t("", "EN")])).toBeNull();
  });
});

describe("isRedundant", () => {
  test("is true when the text repeats the summary", () => {
    expect(isRedundant("Ta neste tog", "Ta neste tog")).toBe(true);
  });

  test("ignores whitespace differences", () => {
    expect(isRedundant("  Ta neste tog ", "Ta neste tog")).toBe(true);
  });

  test("is false when the text adds something", () => {
    expect(
      isRedundant("Ta neste tog mellom Skøyen og Høn.", "Ta neste tog"),
    ).toBe(false);
  });

  test("is true when there is no text at all", () => {
    expect(isRedundant(null, "Ta neste tog")).toBe(true);
  });

  test("is false when there is text but no summary to repeat", () => {
    expect(isRedundant("Ta neste tog", null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- situationText`

Expected: FAIL — `Failed to resolve import "./situationText.ts"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/SelectedVehiclePanel/situationText.ts`:

```ts
import { TranslatedString } from "../../types.ts";

const LANGUAGE_PREFERENCE = ["NO", "EN"];

function usable(entry: TranslatedString | undefined): string | null {
  const value = entry?.value?.trim();
  return value ? value : null;
}

/**
 * Picks the best display string out of a list of translations.
 *
 * Norwegian wins over English because the feed frequently publishes an EN entry
 * that is really just the Norwegian text copied across. Untagged entries are
 * common enough (roughly a quarter of live records carry `language: null`) that
 * the last resort is simply the first entry holding any text.
 */
export function pickTranslation(
  strings: TranslatedString[] | null | undefined,
): string | null {
  if (!strings) return null;

  for (const language of LANGUAGE_PREFERENCE) {
    const match = strings.find(
      (entry) => entry.language?.toUpperCase() === language && usable(entry),
    );
    if (match) return usable(match);
  }

  return usable(strings.find((entry) => usable(entry)));
}

/**
 * True when `text` adds nothing beyond `summary`, so the expanded view can skip
 * it. The feed routinely publishes a description identical to the summary.
 */
export function isRedundant(
  text: string | null,
  summary: string | null,
): boolean {
  if (!text) return true;
  if (!summary) return false;
  return text.trim() === summary.trim();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- situationText`

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/components/SelectedVehiclePanel/situationText.ts src/components/SelectedVehiclePanel/situationText.test.ts
git add src/components/SelectedVehiclePanel/situationText.ts src/components/SelectedVehiclePanel/situationText.test.ts
git commit -m "Add translation-selection helpers for situation text"
```

---

### Task 3: Severity colour scale

Mirrors how `delayThresholds.ts` isolates the delay colour scale, so future tuning is one edit in one file.

**Files:**

- Create: `src/components/SelectedVehiclePanel/situationSeverity.ts`
- Test: `src/components/SelectedVehiclePanel/situationSeverity.test.ts`

**Interfaces:**

- Consumes: `SeverityEnumeration` from `src/types.ts` (Task 1).
- Produces:
  - `severityColour(severity: SeverityEnumeration | null | undefined): string`
  - `worstSeverity(situations: { severity: SeverityEnumeration | null }[]): SeverityEnumeration | null`

`worstSeverity` exists so a stop row carrying several situations shows the colour of the most serious one rather than of whichever happened to arrive first.

- [ ] **Step 1: Write the failing tests**

Create `src/components/SelectedVehiclePanel/situationSeverity.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { SeverityEnumeration } from "../../types.ts";
import { severityColour, worstSeverity } from "./situationSeverity.ts";

const RED = "#c0392b";
const ORANGE = "#e07a1f";
const GREY = "#999999";

function s(severity: SeverityEnumeration | null) {
  return { severity };
}

describe("severityColour", () => {
  test("uses red for severe and verySevere", () => {
    expect(severityColour("severe")).toBe(RED);
    expect(severityColour("verySevere")).toBe(RED);
  });

  test("uses orange for the ordinary severities", () => {
    expect(severityColour("normal")).toBe(ORANGE);
    expect(severityColour("slight")).toBe(ORANGE);
    expect(severityColour("verySlight")).toBe(ORANGE);
  });

  // "undefined" is the most common value in live data (276 of 376 sampled) and
  // those are real incident messages, so it must not be greyed out.
  test("uses orange, not grey, for undefined and unknown", () => {
    expect(severityColour("undefined")).toBe(ORANGE);
    expect(severityColour("unknown")).toBe(ORANGE);
    expect(severityColour(null)).toBe(ORANGE);
    expect(severityColour(undefined)).toBe(ORANGE);
  });

  test("greys out only noImpact", () => {
    expect(severityColour("noImpact")).toBe(GREY);
  });
});

describe("worstSeverity", () => {
  test("returns the most serious severity in the list", () => {
    expect(worstSeverity([s("normal"), s("severe"), s("noImpact")])).toBe(
      "severe",
    );
  });

  test("ranks verySevere above severe", () => {
    expect(worstSeverity([s("severe"), s("verySevere")])).toBe("verySevere");
  });

  test("ranks normal above an unrated entry", () => {
    expect(worstSeverity([s("undefined"), s("normal")])).toBe("normal");
  });

  test("ranks noImpact lowest", () => {
    expect(worstSeverity([s("noImpact"), s("undefined")])).toBe("undefined");
  });

  test("ranks an absent severity above noImpact", () => {
    expect(worstSeverity([s("noImpact"), s(null)])).toBeNull();
    expect(worstSeverity([s("noImpact")])).toBe("noImpact");
  });

  test("returns null for an empty list", () => {
    expect(worstSeverity([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- situationSeverity`

Expected: FAIL — `Failed to resolve import "./situationSeverity.ts"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/SelectedVehiclePanel/situationSeverity.ts`:

```ts
import { SeverityEnumeration } from "../../types.ts";

const SEVERE = "#c0392b";
const NOTABLE = "#e07a1f";
const MUTED = "#999999";

/**
 * Colour for a situation's severity marker.
 *
 * `undefined` maps to the same orange as `normal` rather than to grey: it is by
 * far the most common value in the live feed and those records are real
 * incident messages. Greying them would hide most of the data.
 */
export function severityColour(
  severity: SeverityEnumeration | null | undefined,
): string {
  switch (severity) {
    case "severe":
    case "verySevere":
      return SEVERE;
    case "noImpact":
      return MUTED;
    default:
      return NOTABLE;
  }
}

const SEVERITY_RANK: Record<SeverityEnumeration, number> = {
  noImpact: 0,
  unknown: 1,
  undefined: 1,
  verySlight: 2,
  slight: 3,
  normal: 4,
  severe: 5,
  verySevere: 6,
};

// An absent severity ranks with `unknown`/`undefined` rather than lowest, so a
// null does not lose to noImpact.
const UNRATED = 1;

function rank(severity: SeverityEnumeration | null): number {
  return severity ? SEVERITY_RANK[severity] : UNRATED;
}

/**
 * The most serious severity in a group, so a stop row carrying several
 * situations is coloured by the worst of them rather than by the first.
 */
export function worstSeverity(
  situations: { severity: SeverityEnumeration | null }[],
): SeverityEnumeration | null {
  let worst: SeverityEnumeration | null = null;
  let worstRank = -1;

  for (const situation of situations) {
    const current = rank(situation.severity);
    if (current > worstRank) {
      worstRank = current;
      worst = situation.severity;
    }
  }

  return worst;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- situationSeverity`

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/components/SelectedVehiclePanel/situationSeverity.ts src/components/SelectedVehiclePanel/situationSeverity.test.ts
git add src/components/SelectedVehiclePanel/situationSeverity.ts src/components/SelectedVehiclePanel/situationSeverity.test.ts
git commit -m "Add severity colour scale for situations"
```

---

### Task 4: `SituationList` component

The one rendering component. Nothing mounts it yet — Tasks 5 and 6 do that. Vitest does not collect `.tsx`, so verification here is `tsc -b` plus ESLint.

**Files:**

- Create: `src/components/SelectedVehiclePanel/SituationList.tsx`

**Interfaces:**

- Consumes: `Situation`, `TranslatedString` from `src/types.ts`; `pickTranslation`, `isRedundant` from `./situationText.ts`; `severityColour` from `./situationSeverity.ts`.
- Produces: `SituationList` — props `{ situations: Situation[] | null; dense?: boolean }`. Renders `null` when there is nothing to show, so callers never need their own emptiness check.

- [ ] **Step 1: Write the component**

Create `src/components/SelectedVehiclePanel/SituationList.tsx`:

```tsx
import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { Situation, TranslatedString } from "../../types.ts";
import { severityColour } from "./situationSeverity.ts";
import { isRedundant, pickTranslation } from "./situationText.ts";

type SituationListProps = {
  situations: Situation[] | null;
  /** Tighter layout for the inline list under a timetable row. */
  dense?: boolean;
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatValidity(situation: Situation): string | null {
  const period = situation.validityPeriods?.[0];
  if (!period?.startTime) return null;
  const end = period.endTime ? formatDateTime(period.endTime) : "open ended";
  return `${formatDateTime(period.startTime)} – ${end}`;
}

/**
 * Every translation of one field, each tagged with its language.
 *
 * The collapsed row shows a single picked string; this is the expanded view's
 * job, so someone debugging the feed can see exactly what was published and in
 * which languages.
 */
function TranslationLines({
  label,
  strings,
}: {
  label: string;
  strings: TranslatedString[];
}) {
  const entries = (strings ?? []).filter((entry) => entry.value?.trim());
  if (!entries.length) return null;

  return (
    <Box sx={{ marginTop: 0.75 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 9,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "#999",
        }}
      >
        {label}
      </Typography>
      {entries.map((entry, index) => (
        <Typography
          key={`${entry.language ?? "none"}-${index}`}
          component="div"
          sx={{ fontSize: 11, lineHeight: 1.4 }}
        >
          <Box component="span" sx={{ color: "#999", marginRight: 0.5 }}>
            {entry.language ?? "—"}
          </Box>
          {entry.value}
        </Typography>
      ))}
    </Box>
  );
}

function SituationRow({
  situation,
  dense,
}: {
  situation: Situation;
  dense: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const summaryText = pickTranslation(situation.summary);
  const descriptionText = pickTranslation(situation.description);
  const adviceText = pickTranslation(situation.advice);

  // Fall back through description to the bare identifier, so a situation with
  // no usable text is still visible and countable rather than a blank row.
  const headline = summaryText ?? descriptionText ?? situation.situationNumber;

  const colour = severityColour(situation.severity);
  const validity = formatValidity(situation);
  const links = (situation.infoLinks ?? []).filter((link) => link.uri);

  const toggle = () => setExpanded((open) => !open);

  return (
    <Box
      sx={{
        borderLeft: `3px solid ${colour}`,
        borderRadius: "0 2px 2px 0",
        background: "#f7f5f2",
        paddingLeft: 1,
        paddingRight: 0.5,
        paddingY: dense ? 0.25 : 0.5,
        marginBottom: 0.5,
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0.5,
          cursor: "pointer",
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{ color: colour, fontSize: dense ? 11 : 12, lineHeight: 1.5 }}
        >
          ⚠
        </Box>
        <Typography
          component="div"
          sx={{
            flex: 1,
            fontSize: dense ? 11 : 12,
            lineHeight: 1.4,
            ...(expanded
              ? {}
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }),
          }}
        >
          {headline}
        </Typography>
        <Box
          component="span"
          aria-hidden="true"
          sx={{ color: "#999", fontSize: 10, lineHeight: 1.8 }}
        >
          {expanded ? "▴" : "▾"}
        </Box>
      </Box>

      {expanded && (
        <Box sx={{ paddingBottom: 0.5 }}>
          <TranslationLines label="Summary" strings={situation.summary} />
          {!isRedundant(descriptionText, summaryText) && (
            <TranslationLines
              label="Description"
              strings={situation.description}
            />
          )}
          {!isRedundant(adviceText, summaryText) && (
            <TranslationLines label="Advice" strings={situation.advice} />
          )}

          {validity && (
            <Typography
              component="div"
              sx={{ marginTop: 0.75, fontSize: 10, color: "#777" }}
            >
              Valid {validity}
            </Typography>
          )}

          {links.length > 0 && (
            <Box sx={{ marginTop: 0.5 }}>
              {links.map((link, index) => (
                <Typography
                  key={`${link.uri}-${index}`}
                  component="div"
                  sx={{ fontSize: 11 }}
                >
                  <Box
                    component="a"
                    href={link.uri ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: "#2980b9" }}
                  >
                    {pickTranslation(link.labels) ?? link.uri}
                  </Box>
                </Typography>
              ))}
            </Box>
          )}

          {/*
            Nothing is deduplicated, by design. Showing the version here means a
            regression in the eventually-consistent stream is visible in the UI
            instead of being swallowed by client-side tidying.
          */}
          <Typography
            component="div"
            sx={{ marginTop: 0.75, fontSize: 9, color: "#aaa" }}
          >
            {situation.situationNumber}
            {situation.version !== null && ` · v${situation.version}`}
            {situation.reportType && ` · ${situation.reportType}`}
            {situation.severity && ` · ${situation.severity}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function SituationList({
  situations,
  dense = false,
}: SituationListProps) {
  if (!situations?.length) return null;

  return (
    <Box
      sx={{
        marginTop: 1,
        // The trip-level list sits above the scrollable timetable and would
        // push it out of view on a trip with many messages, so it scrolls
        // internally instead. The inline stop-level list is already inside the
        // timetable's own scroll container and must not nest a second one.
        ...(dense ? {} : { maxHeight: "40vh", overflowY: "auto" }),
      }}
    >
      {situations.map((situation, index) => (
        // Keyed with the index as well as the number: because nothing is
        // deduplicated, the same situationNumber can legitimately appear twice
        // during a version regression and a bare key would collide.
        <SituationRow
          key={`${situation.situationNumber}-${index}`}
          situation={situation}
          dense={dense}
        />
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npm run build && npm run lint`

Expected: both PASS. In particular no `react-refresh/only-export-components` error — the file exports only `SituationList`; `SituationRow`, `TranslationLines`, `formatDateTime` and `formatValidity` are module-private.

- [ ] **Step 3: Commit**

```bash
npx prettier --write src/components/SelectedVehiclePanel/SituationList.tsx
git add src/components/SelectedVehiclePanel/SituationList.tsx
git commit -m "Add SituationList component for rendering deviation messages"
```

---

### Task 5: Trip-level situations in the panel

**Files:**

- Modify: `src/components/SelectedVehiclePanel/SelectedVehiclePanel.tsx` (import block at `:1-7`; render the list between the cancelled banner ending at `:126` and the delay `Typography` starting at `:128`)

**Interfaces:**

- Consumes: `SituationList` from `./SituationList.tsx` (Task 4); `EstimatedTimetableUpdate.situations` (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Import the component**

In `src/components/SelectedVehiclePanel/SelectedVehiclePanel.tsx`, add to the existing imports (after the `Timetable` import on line 7):

```ts
import { SituationList } from "./SituationList.tsx";
```

- [ ] **Step 2: Render the trip-level list**

Insert between the closing `)}` of the `{tripCancelled && (...)}` block (line 126) and the `{vehicleData && (` delay block (line 128):

```tsx
<SituationList situations={timetable?.situations ?? null} />
```

It goes below the cancelled banner because a cancellation is the more severe signal and should stay first, and above the delay line so messages are not separated from the header they qualify. No conditional wrapper is needed — `SituationList` returns `null` when there is nothing to show.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`

Expected: both PASS.

- [ ] **Step 4: Check it in the browser**

Run: `npm run dev`

Click vehicles until you find one with trip-level messages (SKY / Bergen is the highest-yield codespace). Confirm:

- messages appear under the header, above the delay line,
- clicking one expands it and clicking again collapses it,
- a trip with no messages looks exactly as it did before this branch.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/components/SelectedVehiclePanel/SelectedVehiclePanel.tsx
git add src/components/SelectedVehiclePanel/SelectedVehiclePanel.tsx
git commit -m "Show trip-level deviation messages in the selected vehicle panel"
```

---

### Task 6: Stop-level situations on the timetable row

`StopRow` has been stateless until now and returns a single flex row. It needs a wrapper so the inline list can sit beneath the row, which means the `borderBottom` moves from the row to that wrapper — otherwise the separator would be drawn between a stop and its own expanded messages.

**Files:**

- Modify: `src/components/SelectedVehiclePanel/StopRow.tsx` (imports at `:1-4`; component body from `:34`; the returned JSX at `:69-171`)

**Interfaces:**

- Consumes: `SituationList` (Task 4); `severityColour`, `worstSeverity` (Task 3); `Call.situations` (Task 1).
- Produces: no new exports. `StopRow`'s props are unchanged — `Timetable.tsx` already passes whole `Call` objects, so it needs no edit.

- [ ] **Step 1: Add the imports**

In `src/components/SelectedVehiclePanel/StopRow.tsx`, replace the import block at lines 1–4 with:

```tsx
import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { Call } from "../../types.ts";
import { resolveCallTimes } from "./callTimes.ts";
import { delayBucket, delayColour } from "./delayThresholds.ts";
import { SituationList } from "./SituationList.tsx";
import { severityColour, worstSeverity } from "./situationSeverity.ts";
```

- [ ] **Step 2: Add the state and derived values**

In the `StopRow` function body, after the existing `const occupancy = ...` block (lines 49–51), add:

```tsx
const [showSituations, setShowSituations] = useState(false);
const situations = call.situations ?? [];
const hasSituations = situations.length > 0;
const situationColour = severityColour(worstSeverity(situations));
```

- [ ] **Step 3: Wrap the row and move the border**

Replace the opening of the returned JSX. The current outer element (lines 70–78) is:

```tsx
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        padding: "5px 0",
        borderBottom: "1px dotted #eee",
        opacity: isPast && !isCurrent ? 0.55 : 1,
      }}
    >
```

Replace it with a wrapper that owns the separator, plus the original row without it:

```tsx
    <Box sx={{ borderBottom: "1px dotted #eee" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          padding: "5px 0",
          opacity: isPast && !isCurrent ? 0.55 : 1,
        }}
      >
```

Everything between this and the occupancy block stays exactly as it is, but is now one level deeper — re-indent it by two spaces.

- [ ] **Step 4: Add the warning toggle and the inline list**

After the existing `{occupancy && (...)}` block (which currently ends at line 169), add the toggle button, then close the inner row and add the expandable list before closing the wrapper:

```tsx
        {hasSituations && (
          <Box
            component="button"
            type="button"
            onClick={() => setShowSituations((open) => !open)}
            aria-expanded={showSituations}
            aria-label={`${situations.length} deviation ${
              situations.length === 1 ? "message" : "messages"
            } for ${call.stopPoint.name}`}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              marginLeft: 0.5,
              padding: 0,
              flexShrink: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              color: situationColour,
            }}
          >
            ⚠
          </Box>
        )}
      </Box>

      {hasSituations && showSituations && (
        <Box sx={{ paddingLeft: "34px", paddingBottom: 0.5 }}>
          <SituationList situations={situations} dense />
        </Box>
      )}
    </Box>
  );
}
```

The `34px` left padding lines the messages up with the stop name: the 24px timeline column plus the 10px margin the name column already uses.

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint && npm test`

Expected: all PASS. If `tsc` reports unbalanced JSX, the re-indentation in Step 3 left a tag unclosed — check that the inner row `</Box>` in Step 4 is present.

- [ ] **Step 6: Check it in the browser**

Run: `npm run dev`

Stop-level messages are rarer than trip-level ones (7 of 73 sampled frames), so scan several SKY vehicles. Confirm:

- a ⚠ appears at the right of the affected row only,
- clicking it reveals the messages indented under that row, and clicking again hides them,
- the dotted separator sits below the expanded messages, not between the row and its messages,
- a stop carrying several near-identical messages shows **all** of them — that is the intended behaviour, not a bug to fix,
- rows without messages are unchanged.

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/components/SelectedVehiclePanel/StopRow.tsx
git add src/components/SelectedVehiclePanel/StopRow.tsx
git commit -m "Show stop-level deviation messages on timetable rows"
```

---

### Task 7: Documentation

Two of these corrections are pre-existing staleness rather than consequences of this feature, which is why they are their own commit.

**Files:**

- Modify: `CLAUDE.md` (commands list at `:11-20`; runtime-config note at `:26`; data-flow list at `:31-37`)

**Interfaces:** none.

- [ ] **Step 1: Document the test script**

In `CLAUDE.md`, add to the commands list after the `npm run format` line (line 15):

```markdown
- `npm test` — Vitest unit tests (`vitest run`), currently covering the pure helpers in `src/components/SelectedVehiclePanel/`
```

Then replace line 20, which currently opens `There is no `npm test` script. CI ...`, with:

```markdown
CI (`.github/workflows/build.yml`) runs only `npm run check` and `npm run build` — it does **not** run `lint`, `test`, or Playwright. A Husky pre-commit hook runs `lint-staged` → Prettier on staged files.
```

Vitest is configured in `vitest.config.ts` with `environment: "node"` and `include: ["src/**/*.test.ts"]` — worth noting because it means `.tsx` component tests are not collected. Add that as a sentence after the line above:

```markdown
`vitest.config.ts` sets `environment: "node"` and `include: ["src/**/*.test.ts"]`, so component (`.tsx`) tests are not collected — keep testable logic in plain `.ts` modules.
```

- [ ] **Step 2: Fix the stale bootstrap.json claim**

Line 26 claims `public/bootstrap.json` "currently points at `localhost:8080`". It points at `api.dev.entur.io`. Replace that bullet with:

```markdown
- Local dev: `public/bootstrap.json` is served as-is (currently points at `api.dev.entur.io`). Edit it to point at a different backend; do not commit personal client names.
```

- [ ] **Step 3: Document situations in the data flow**

Append to the data-flow list in `CLAUDE.md`, after item 5:

```markdown
6. Selecting a vehicle also opens `useTimetableSubscription(serviceJourneyId, date)`, whose `timetables` frames carry deviation messages as `Situation` objects in two places: `EstimatedTimetableUpdate.situations` (trip-wide) and `Call.situations` (one stop). Both render through the same `SituationList` component. Situations are shown exactly as delivered — no deduplication, no severity filtering — because the demo exists to expose what the feed actually contains; `situationNumber` and `version` are displayed so a version regression in the eventually-consistent stream stays visible.
```

Add to the "Key invariants worth preserving" list:

```markdown
- The `situations` selection set is a single GraphQL fragment spread at both the timetable and the call level, so the two cannot drift apart.
```

- [ ] **Step 4: Verify formatting**

Run: `npm run check`

Expected: PASS. If Prettier complains, run `npx prettier --write CLAUDE.md`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document situations in the data flow and correct stale CLAUDE.md claims"
```

---

## Final verification

- [ ] Run the full gate: `npm run check && npm run build && npm run lint && npm test`
- [ ] Confirm all four pass before opening a PR.
- [ ] **Before pushing:** confirm with the API owner that `situations` is deployed to staging and prod. Until it is, this branch breaks the timetable panel in both environments — see Global Constraints.
- [ ] PR description should carry the manual checklist from the spec's Testing section.
