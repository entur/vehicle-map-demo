# Vehicles / Situations App Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the app into two mutually exclusive modes — Vehicles and Situations — so each feature owns its own controls, map layers, and subscription.

**Architecture:** One new piece of state (`mode`) in `App`, synced to the URL as `?mode=`. A pure, table-driven module `src/domain/appMode.ts` maps a mode to its map layers, sources, and feed-enabled predicates; everything else is thin glue over that table. Map layers and sources are declared statically in `mapStyle.ts` and are never added or removed — a single effect keyed on mode hides the outgoing mode's layers, reapplies the incoming mode's switch-driven visibility, and empties the outgoing mode's sources.

**Tech Stack:** React 19 + TypeScript + Vite, MapLibre via `react-map-gl/maplibre`, MUI, `graphql-ws` subscriptions, Vitest (node environment), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-vehicles-situations-modes-design.md`

## Global Constraints

- ESM only. **Local imports must include the explicit `.ts`/`.tsx` extension** — match the surrounding style or the build breaks.
- `vitest.config.ts` sets `environment: "node"` and `include: ["src/**/*.test.ts"]`. **Component (`.tsx`) tests are not collected.** Testable logic must live in plain `.ts` modules.
- CI (`.github/workflows/build.yml`) runs `npm test`, then `npm run check` (Prettier) and `npm run build`. It does **not** run `npm run lint` or Playwright. `npm run check` is a hard gate — run `npm run format` before committing.
- `npm run lint` currently reports 19 pre-existing problems (14 errors, 5 warnings). That is the baseline. Do not "fix" unrelated ones; just do not add new ones in files you touch.
- Do not add a codespace facet to `SituationFilter`. Codespace is filtered from exactly one control (`Filter.codespaceId`), per CLAUDE.md.
- Situation stats and facet counts are computed over the **unfiltered** set. Do not change that.
- A Husky pre-commit hook runs `lint-staged` → Prettier on staged files.
- `git add -A` is unsafe in this repo: `build/` and `vehicle-map-demo.iml` are untracked but not gitignored. **Stage by explicit path.**

---

### Task 1: Delete the affected-vehicle halos

The halos need both feeds live, which two mutually exclusive modes make impossible. This reverses commits `2ed42b2` and `766de7f`. Doing it first means the later `appMode` completeness test can assert that every layer in `mapStyle.ts` belongs to exactly one mode.

**Files:**

- Modify: `src/components/mapStyle.ts` (remove the `situation-affected-vehicles-layer` layer and the `situationVehicles` source)
- Modify: `src/components/MapLayers.tsx` (remove `AFFECTED_VEHICLES_LAYER` and its reapplication rule)
- Modify: `src/components/SituationLayers.tsx` (remove the `vehicles` prop, the `affectedVehicles` memo, and its `useSetSourceData` call)
- Modify: `src/components/MapView.tsx` (stop passing `vehicles` to `SituationLayers`)
- Test: none new — the existing suite must stay green

**Interfaces:**

- Consumes: nothing
- Produces: `SituationLayers` prop type narrows to `{ visible: boolean }`

- [ ] **Step 1: Confirm the current suite is green**

Run: `npm test`
Expected: PASS, 8 test files, 84 tests.

- [ ] **Step 2: Remove the halo layer and source from the style**

In `src/components/mapStyle.ts`, delete the whole layer object whose `id` is `"situation-affected-vehicles-layer"` (around line 107, including the comment above it that explains MapLayers derives its visibility), and delete the `situationVehicles` entry from the `sources` object.

- [ ] **Step 3: Remove the derived-visibility rule from MapLayers**

In `src/components/MapLayers.tsx`, delete the `AFFECTED_VEHICLES_LAYER` constant and the doc comment above it, and delete this block from inside `handleToggleLayer`:

```ts
// Reapplied on every toggle rather than only on the two that matter, so
// the rule has no chance to drift out of step with the switches.
map.setLayoutProperty(
  AFFECTED_VEHICLES_LAYER,
  "visibility",
  next.showVehicles && next.showSituations ? "visible" : "none",
);
```

- [ ] **Step 4: Remove the halo feature set from SituationLayers**

In `src/components/SituationLayers.tsx`:

- delete the `affectedVehicles` memo (the `useMemo` that builds a `FeatureCollection` from `vehicles` matching `lineRefs`)
- delete the line `useSetSourceData("situationVehicles", affectedVehicles);`
- change the signature to drop `vehicles`:

```tsx
export function SituationLayers({ visible }: { visible: boolean }) {
```

- delete the now-unused `VehicleUpdate` import
- rewrite the doc comment above the component so it no longer describes halos:

```tsx
/**
 * Draws whatever of the filtered situations can be placed on the map.
 *
 * `visible` reflects the situations layer switches in MapLayers, which own the
 * layers' `visibility` directly. The sources are kept fed either way — hiding
 * the layers must not disturb the panel — but the map is not flown to a
 * selection the user cannot see.
 */
```

- [ ] **Step 5: Stop passing vehicles from MapView**

In `src/components/MapView.tsx`, replace:

```tsx
<SituationLayers
  vehicles={data.map((vehicle) => vehicle.vehicleUpdate)}
  visible={mapViewOptions.showSituations}
/>
```

with:

```tsx
<SituationLayers visible={mapViewOptions.showSituations} />
```

- [ ] **Step 6: Verify it builds and the suite is still green**

Run: `npm run format && npm test && npx tsc -b && npm run check`
Expected: tests PASS (84), `tsc -b` silent, Prettier reports all files formatted.

- [ ] **Step 7: Commit**

```bash
git add src/components/mapStyle.ts src/components/MapLayers.tsx src/components/SituationLayers.tsx src/components/MapView.tsx
git commit -m "Remove the affected-vehicle halos"
```

---

### Task 2: Replace the single Situations switch with per-feature switches

Splits `showSituations` into `showAffectedStops` and `showAffectedLines`. Points come from coordinates the feed actually carries; lines come from geometry borrowed from a vehicle running that line. Being able to see only what the feed genuinely places is a real data-QA distinction — and this is the shape `appMode.ts` needs in Task 3.

**Files:**

- Modify: `src/types.ts` (`MapViewOptions`)
- Modify: `src/components/App.tsx` (initial state)
- Modify: `src/components/MapLayers.tsx` (two switches instead of one)
- Modify: `src/components/MapView.tsx` (derive `visible`)
- Test: none new

**Interfaces:**

- Consumes: `SituationLayers({ visible })` from Task 1
- Produces: `MapViewOptions` with `showAffectedStops` and `showAffectedLines`, no `showSituations`

- [ ] **Step 1: Change the MapViewOptions type**

In `src/types.ts`, find `MapViewOptions` and replace `showSituations: boolean;` with:

```ts
showAffectedStops: boolean;
showAffectedLines: boolean;
```

- [ ] **Step 2: Update the initial state**

In `src/components/App.tsx`, replace `showSituations: false,` in the `useState<MapViewOptions>` initialiser with:

```ts
    showAffectedStops: true,
    showAffectedLines: true,
```

They default to `true` because in situations mode the user has already asked for situations by choosing the mode — the switches exist to subtract, not to opt in. The layers still start hidden in the style; the Task 5 mode effect is what reveals them on entering situations mode.

- [ ] **Step 3: Replace the single switch in MapLayers**

In `src/components/MapLayers.tsx`, replace the whole `FormControlLabel` for `showSituations` with:

```tsx
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showAffectedStops}
                onChange={handleToggleLayer(
                  "showAffectedStops",
                  "situation-points-layer",
                )}
              />
            }
            label={getLabelWithIcon(situationMarker, "Affected stops", 22)}
          />
          <FormControlLabel
            control={
              <Switch
                checked={mapViewOptions.showAffectedLines}
                onChange={handleToggleLayer(
                  "showAffectedLines",
                  "situation-lines-layer",
                )}
              />
            }
            label={getLabelWithIcon(situationMarker, "Affected lines", 22)}
          />
```

- [ ] **Step 4: Derive `visible` from the two switches**

In `src/components/MapView.tsx`:

```tsx
<SituationLayers
  visible={mapViewOptions.showAffectedStops || mapViewOptions.showAffectedLines}
/>
```

- [ ] **Step 5: Verify**

Run: `npm run format && npm test && npx tsc -b && npm run check`
Expected: tests PASS (84), `tsc -b` silent. `tsc` is the real check here — it fails on any remaining reference to `showSituations`.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/components/App.tsx src/components/MapLayers.tsx src/components/MapView.tsx
git commit -m "Split the situations layer switch into stops and lines"
```

---

### Task 3: The `appMode` domain module

The one piece of this feature that can actually be unit-tested. Everything mode-derived lives here as data, so the glue in later tasks stays a few lines.

**Files:**

- Create: `src/domain/appMode.ts`
- Create: `src/domain/appMode.test.ts`

**Interfaces:**

- Consumes: `MapViewOptions` from Task 2, `mapStyle` from Task 1
- Produces:
  - `type AppMode = "vehicles" | "situations"`
  - `APP_MODES: AppMode[]`
  - `MODE_LAYERS: Record<AppMode, string[]>`
  - `MODE_SWITCHED_LAYERS: Record<AppMode, Record<string, keyof MapViewOptions>>`
  - `MODE_SOURCES: Record<AppMode, string[]>`
  - `otherMode(mode: AppMode): AppMode`
  - `isVehicleFeedEnabled(mode: AppMode): boolean`
  - `isSituationsFeedEnabled(mode: AppMode): boolean`
  - `parseAppMode(value: string | undefined | null): AppMode`

- [ ] **Step 1: Write the failing test**

Create `src/domain/appMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapStyle } from "../components/mapStyle.ts";
import {
  APP_MODES,
  MODE_LAYERS,
  MODE_SOURCES,
  MODE_SWITCHED_LAYERS,
  isSituationsFeedEnabled,
  isVehicleFeedEnabled,
  otherMode,
  parseAppMode,
} from "./appMode.ts";

/** The base map belongs to no mode and is never hidden or cleared. */
const BASE_LAYER = "osm";
const BASE_SOURCE = "osm";

describe("MODE_LAYERS", () => {
  it("claims every non-base layer in the style exactly once", () => {
    const styleLayers = mapStyle.layers
      .map((layer) => layer.id)
      .filter((id) => id !== BASE_LAYER);
    const claimed = APP_MODES.flatMap((mode) => MODE_LAYERS[mode]);

    expect([...claimed].sort()).toEqual([...styleLayers].sort());
  });

  it("names only layers that exist in the style", () => {
    const styleLayers = new Set(mapStyle.layers.map((layer) => layer.id));
    for (const mode of APP_MODES) {
      for (const id of MODE_LAYERS[mode]) {
        expect(styleLayers.has(id)).toBe(true);
      }
    }
  });
});

describe("MODE_SOURCES", () => {
  it("claims every non-base source in the style exactly once", () => {
    const styleSources = Object.keys(mapStyle.sources).filter(
      (id) => id !== BASE_SOURCE,
    );
    const claimed = APP_MODES.flatMap((mode) => MODE_SOURCES[mode]);

    expect([...claimed].sort()).toEqual([...styleSources].sort());
  });
});

describe("MODE_SWITCHED_LAYERS", () => {
  it("is a subset of the layers the mode owns", () => {
    for (const mode of APP_MODES) {
      const owned = new Set(MODE_LAYERS[mode]);
      for (const id of Object.keys(MODE_SWITCHED_LAYERS[mode])) {
        expect(owned.has(id)).toBe(true);
      }
    }
  });

  it("maps each MapViewOptions key to exactly one layer", () => {
    const keys = APP_MODES.flatMap((mode) =>
      Object.values(MODE_SWITCHED_LAYERS[mode]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("feed predicates", () => {
  it("enables exactly one feed per mode", () => {
    for (const mode of APP_MODES) {
      expect(isVehicleFeedEnabled(mode)).toBe(!isSituationsFeedEnabled(mode));
    }
  });

  it("enables the vehicle feed only in vehicles mode", () => {
    expect(isVehicleFeedEnabled("vehicles")).toBe(true);
    expect(isVehicleFeedEnabled("situations")).toBe(false);
  });
});

describe("otherMode", () => {
  it("round-trips", () => {
    for (const mode of APP_MODES) {
      expect(otherMode(otherMode(mode))).toBe(mode);
    }
    expect(otherMode("vehicles")).toBe("situations");
  });
});

describe("parseAppMode", () => {
  it("accepts a known mode", () => {
    expect(parseAppMode("situations")).toBe("situations");
  });

  it("falls back to vehicles for anything else", () => {
    expect(parseAppMode("nonsense")).toBe("vehicles");
    expect(parseAppMode(undefined)).toBe("vehicles");
    expect(parseAppMode(null)).toBe("vehicles");
    expect(parseAppMode("")).toBe("vehicles");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/appMode.test.ts`
Expected: FAIL — cannot resolve `./appMode.ts`.

- [ ] **Step 3: Write the module**

Create `src/domain/appMode.ts`:

```ts
import { MapViewOptions } from "../types.ts";

/**
 * The app is in exactly one mode at a time. Mode decides which subscription is
 * open, not merely what is drawn, so it lives in `App` next to the filter
 * rather than inside a drawer.
 */
export type AppMode = "vehicles" | "situations";

export const APP_MODES: AppMode[] = ["vehicles", "situations"];

/**
 * Every layer a mode owns — hidden wholesale when the mode is left.
 *
 * `vehicle-follow-layer` and `vehicle-update-interval-text-layer` are declared
 * `visibility: "none"` in mapStyle and referenced nowhere else in src/: nothing
 * currently turns them on. They are listed so the completeness test passes and
 * so they cannot be stranded visible by a future change — not revived.
 */
export const MODE_LAYERS: Record<AppMode, string[]> = {
  vehicles: [
    "vehicle-layer",
    "vehicle-trace-layer",
    "vehicle-follow-layer",
    "delay",
    "vehicle-update-interval-text-layer",
    "vehicle-update-interval-icon-layer",
    "vehicle-update-interval-skull-layer",
    "vehicles-heatmap",
    "occupancy-layer",
    "service-journey-route-layer",
  ],
  situations: ["situation-lines-layer", "situation-points-layer"],
};

/**
 * The subset of `MODE_LAYERS` whose visibility a MapViewOptions switch owns,
 * and which is therefore reapplied when the mode is entered.
 *
 * `service-journey-route-layer` is deliberately absent: it is owned by
 * `RouteLayer` and driven by the selected service journey. Selections are
 * cleared on a mode switch, so hidden is its correct entry state, and looking
 * it up here would read a MapViewOptions key that does not exist.
 */
export const MODE_SWITCHED_LAYERS: Record<
  AppMode,
  Record<string, keyof MapViewOptions>
> = {
  vehicles: {
    "vehicle-layer": "showVehicles",
    "vehicle-trace-layer": "showVehicleTraces",
    delay: "showDelay",
    "vehicle-update-interval-icon-layer": "showUpdateFrequency",
    "vehicle-update-interval-skull-layer": "showDeadUpdateFrequency",
    "vehicles-heatmap": "showVehicleHeatmap",
    "occupancy-layer": "showOccupancy",
  },
  situations: {
    "situation-points-layer": "showAffectedStops",
    "situation-lines-layer": "showAffectedLines",
  },
};

/** GeoJSON sources a mode writes into — emptied when the mode is left. */
export const MODE_SOURCES: Record<AppMode, string[]> = {
  vehicles: ["vehicles", "vehicleTraces", "serviceJourneyRoute"],
  situations: ["situationLines", "situationPoints"],
};

export const otherMode = (mode: AppMode): AppMode =>
  mode === "vehicles" ? "situations" : "vehicles";

export const isVehicleFeedEnabled = (mode: AppMode): boolean =>
  mode === "vehicles";

export const isSituationsFeedEnabled = (mode: AppMode): boolean =>
  mode === "situations";

/** Anything unrecognised — including a hand-edited URL — falls back to vehicles. */
export const parseAppMode = (value: string | undefined | null): AppMode =>
  value === "situations" ? "situations" : "vehicles";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/appMode.test.ts`
Expected: PASS.

If the "claims every non-base layer exactly once" test fails, read the diff carefully — it means `mapStyle.ts` and this table disagree, which is exactly what the test is for. Fix the table, not the test.

- [ ] **Step 5: Verify the whole suite**

Run: `npm run format && npm test && npx tsc -b && npm run check`
Expected: 9 test files, 84 + new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/appMode.ts src/domain/appMode.test.ts
git commit -m "Add the appMode domain table"
```

---

### Task 4: Mode state, the URL param, and the mode switch UI

After this task the app visibly has two modes: the switch works, the rails and panels swap. Both subscriptions still run and layer visibility is unchanged — those come in Tasks 5 and 6.

**Files:**

- Create: `src/components/ModeSwitch.tsx`
- Modify: `src/index.css` (position the switch, shift the rail down)
- Modify: `src/components/App.tsx` (own `mode`, pass it down)
- Modify: `src/hooks/useFilterQueryParams.ts` (keep `mode` out of `Filter`)
- Create: `src/hooks/useModeQueryParam.ts`
- Modify: `src/components/MapView.tsx` (render per mode)
- Modify: `src/components/RightMenu/RightMenu.tsx`, `RightMenuButtons.tsx`, `DrawerContent.tsx`
- Modify: `src/components/LeftMenu/LeftMenu.tsx`

**Interfaces:**

- Consumes: `AppMode`, `APP_MODES`, `parseAppMode`, `otherMode` from Task 3
- Produces: `mode: AppMode` and `setMode: (mode: AppMode) => void` threaded from `App` into `MapView`, `RightMenu`, `LeftMenu`, `ModeSwitch`

- [ ] **Step 1: Write the mode URL hook**

Create `src/hooks/useModeQueryParam.ts`:

```ts
import { useEffect, useRef } from "react";
import { AppMode, parseAppMode } from "../domain/appMode.ts";

/**
 * Reads `?mode=` once on load, then mirrors the mode back into the URL.
 *
 * Kept separate from `useFilterQueryParams` because mode is not part of
 * `Filter`: it decides which subscription runs, and folding it into the filter
 * object would smuggle a stray key into the vehicle subscription variables.
 * Both hooks build their URL from `window.location.href` and only touch their
 * own keys, so they compose without clobbering each other.
 */
export function useModeQueryParam(
  mode: AppMode,
  setMode: (mode: AppMode) => void,
) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const params = new URLSearchParams(window.location.search);
    setMode(parseAppMode(params.get("mode")));
  }, [setMode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("mode") === mode) return;
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
  }, [mode]);
}
```

- [ ] **Step 2: Keep `mode` out of the Filter object**

In `src/hooks/useFilterQueryParams.ts`, inside the first `useEffect`, replace:

```ts
const queryParams = getQueryParams();
setFilter({
  ...(filter || {}),
  ...queryParams,
} as Filter);
```

with:

```ts
// `mode` shares the query string but is not part of Filter — it is owned
// by useModeQueryParam. Merging it here would put a stray key into the
// filter object and, from there, into the subscription variables.
const { mode: _mode, ...queryParams } = getQueryParams();
void _mode;
setFilter({
  ...(filter || {}),
  ...queryParams,
} as Filter);
```

- [ ] **Step 3: Write the mode switch component**

Create `src/components/ModeSwitch.tsx`:

```tsx
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { AppMode } from "../domain/appMode.ts";

type Props = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  drawerOpen: boolean;
};

/**
 * Always visible, because mode governs which subscription is open. Putting it
 * inside a drawer — which is closed by default — would leave the app with no
 * on-screen indication of which feed is running.
 */
export function ModeSwitch({ mode, setMode, drawerOpen }: Props) {
  return (
    <ToggleButtonGroup
      className={`mode-switch ${drawerOpen ? "open" : ""}`}
      value={mode}
      exclusive
      size="small"
      onChange={(_event, next: AppMode | null) => {
        // MUI reports null when the active button is clicked again. Mode is
        // never absent, so that is a no-op rather than a deselection.
        if (next) setMode(next);
      }}
    >
      <ToggleButton value="vehicles">Vehicles</ToggleButton>
      <ToggleButton value="situations">Situations</ToggleButton>
    </ToggleButtonGroup>
  );
}
```

- [ ] **Step 4: Position it and shift the rail down**

Append to `src/index.css`:

```css
.mode-switch {
  position: absolute;
  top: 20px;
  right: 5px;
  z-index: 1;
  background: #fff;
  transition: right 0.3s;
}

.mode-switch.open {
  right: 255px;
}
```

The rail's buttons are absolutely positioned with inline `top` values starting at 20px. They move down to make room in the next step.

- [ ] **Step 5: Render the rail from a list**

Replace the whole body of `src/components/RightMenu/RightMenuButtons.tsx` with a list-driven version, so the button set can differ per mode without hand-maintained `top` values:

```tsx
import filterIcon from "../../static/images/filter.png";
import infoIcon from "../../static/images/info.png";
import layersIcon from "../../static/images/layers.png";
import orangeMarkerIcon from "../../static/images/orangeMarker.png";
import stoplightIcon from "../../static/images/stoplight.png";
import { AppMode } from "../../domain/appMode.ts";
import { RightContentType } from "./types.ts";

type Tool = {
  content: RightContentType;
  icon: string;
  label: string;
};

const TOOLS: Record<RightContentType, Tool> = {
  layers: { content: "layers", icon: layersIcon, label: "Layers" },
  filtering: { content: "filtering", icon: filterIcon, label: "Filter" },
  info: { content: "info", icon: infoIcon, label: "Info" },
  stoplight: {
    content: "stoplight",
    icon: stoplightIcon,
    label: "Data report",
  },
  situations: {
    content: "situations",
    icon: orangeMarkerIcon,
    label: "Situations",
  },
};

const TOOLS_BY_MODE: Record<AppMode, RightContentType[]> = {
  vehicles: ["layers", "filtering", "info", "stoplight"],
  situations: ["layers", "filtering", "situations"],
};

/** Below the mode switch, then one button pitch apart. */
const FIRST_BUTTON_TOP = 75;
const BUTTON_PITCH = 55;

type RightMenuButtonsProps = {
  mode: AppMode;
  activeContent: RightContentType | null;
  setActiveContent: (contentType: RightContentType | null) => void;
};

export const RightMenuButtons = ({
  mode,
  activeContent,
  setActiveContent,
}: RightMenuButtonsProps) => {
  const toggleSidebar = (newActiveContent: RightContentType) => {
    setActiveContent(
      newActiveContent === activeContent ? null : newActiveContent,
    );
  };

  return (
    <>
      {TOOLS_BY_MODE[mode].map((content, index) => {
        const tool = TOOLS[content];
        return (
          <button
            key={content}
            onClick={() => toggleSidebar(content)}
            className={`sidebar-button right ${
              activeContent === content ? "active" : ""
            } ${activeContent ? "open" : ""}`}
            style={{ top: `${FIRST_BUTTON_TOP + index * BUTTON_PITCH}px` }}
          >
            <img
              src={tool.icon}
              alt={tool.label}
              title={tool.label}
              style={{ width: "40px", height: "40px" }}
            />
          </button>
        );
      })}
    </>
  );
};
```

- [ ] **Step 6: Close a drawer that the new mode does not offer**

Replace `src/components/RightMenu/RightMenu.tsx`'s component body so it takes `mode`, clears an active drawer that the incoming mode has no button for, and renders the switch:

```tsx
export const RightMenu = ({
  mode,
  setMode,
  currentFilter,
  setCurrentFilter,
  mapViewOptions,
  setMapViewOptions,
  data,
}: RightMenuProps) => {
  const [activeContent, setActiveContent] = useState<RightContentType | null>(
    null,
  );

  // Switching modes can remove the tool whose drawer is open — leaving a
  // situations panel on screen in vehicles mode with no button to close it.
  useEffect(() => {
    setActiveContent(null);
  }, [mode]);

  return (
    <>
      <ModeSwitch
        mode={mode}
        setMode={setMode}
        drawerOpen={activeContent !== null}
      />
      <RightMenuButtons
        mode={mode}
        activeContent={activeContent}
        setActiveContent={setActiveContent}
      />
      <div className={`right-menu-container ${activeContent ? "open" : ""}`}>
        {activeContent && (
          <DrawerContent
            mode={mode}
            activeContent={activeContent}
            currentFilter={currentFilter}
            setCurrentFilter={setCurrentFilter}
            mapViewOptions={mapViewOptions}
            setMapViewOptions={setMapViewOptions}
            data={data}
          />
        )}
      </div>
    </>
  );
};
```

Add `mode: AppMode;` and `setMode: (mode: AppMode) => void;` to `RightMenuProps`, import `useEffect` from `react`, import `ModeSwitch` from `../ModeSwitch.tsx` and `AppMode` from `../../domain/appMode.ts`.

- [ ] **Step 7: Pass mode into the drawer**

In `src/components/RightMenu/DrawerContent.tsx`, add `mode: AppMode;` to `DrawerContentProps`, import `AppMode` from `../../domain/appMode.ts`, and accept `mode` in the destructured parameters. Leave the render body alone for now — Task 7 changes what the filter drawer holds. `MapLayers` still shows all nine switches in both modes for this one task; that is temporary and visibly odd, which is fine for an intermediate commit.

- [ ] **Step 8: Hide the left rail in situations mode**

In `src/components/LeftMenu/LeftMenu.tsx`, add `mode: AppMode` to the props (importing `AppMode` from `../../domain/appMode.ts`) and return `null` when it is not `"vehicles"`:

```tsx
// The left rail holds vehicle statistics only.
if (mode !== "vehicles") return null;
```

Place it after the existing hook calls, not before them — an early return above a `useState` changes the hook order between renders and React will throw.

- [ ] **Step 9: Own the mode in App**

In `src/components/App.tsx`:

```tsx
const [mode, setMode] = useState<AppMode>("vehicles");
```

Import `AppMode` from `../domain/appMode.ts` and `useModeQueryParam` from `../hooks/useModeQueryParam.ts`, then call it next to the existing filter sync:

```tsx
useFilterQueryParams(currentFilter, setCurrentFilter);
useModeQueryParam(mode, setMode);
```

Pass `mode={mode}` and `setMode={setMode}` into `<MapView>`.

- [ ] **Step 10: Render per mode in MapView**

In `src/components/MapView.tsx`, add `mode: AppMode` and `setMode: (mode: AppMode) => void` to `MapViewProps`, then gate the map children and panels:

```tsx
        <LeftMenu mode={mode} … />
        <RightMenu mode={mode} setMode={setMode} … />
        <RegisterIcons />
        <CaptureBoundingBox setCurrentFilter={setCurrentFilter} />
        {mode === "vehicles" && (
          <>
            <VehicleMarkers
              data={data.map((vehicle) => vehicle.vehicleUpdate)}
              setSelectedVehicle={setSelectedVehicle}
              followedVehicleId={
                followedVehicle ? followedVehicle.properties.id : null
              }
            />
            {mapViewOptions.showVehicleTraces && <VehicleTraces data={data} />}
            <RouteLayer
              serviceJourneyId={
                selectedVehicle?.properties.serviceJourneyId ?? null
              }
              cancelled={tripCancelled}
            />
            {selectedVehicle && (
              <VehiclePopup
                vehicle={selectedVehicle}
                onClose={() => setSelectedVehicle(null)}
                onFollow={handleFollowToggle}
                followedVehicle={followedVehicle}
              />
            )}
          </>
        )}
        {mode === "situations" && (
          <SituationLayers
            visible={
              mapViewOptions.showAffectedStops ||
              mapViewOptions.showAffectedLines
            }
          />
        )}
```

and outside `<Map>`, gate the vehicle panel:

```tsx
{
  mode === "vehicles" && (
    <SelectedVehiclePanel
      selectedVehicle={selectedVehicle}
      onClose={() => setSelectedVehicle(null)}
      onCancellationChange={setTripCancelled}
    />
  );
}
```

- [ ] **Step 11: Clear the vehicle selection on leaving vehicles mode**

Still in `src/components/MapView.tsx`, add next to the existing `selectedVehicle` effect:

```tsx
// A selection has no rendering in the other mode, and returning to a stale
// one — pointing at a journey whose vehicle expired while away — is worse
// than returning to none.
useEffect(() => {
  setSelectedVehicle(null);
}, [mode]);
```

The situation selection is cleared in Task 6, where the provider is already being changed.

- [ ] **Step 12: Verify by hand**

Run: `npm run format && npm test && npx tsc -b && npm run check`, then `npm run dev` and open http://localhost:5173.

Expected: a Vehicles/Situations pill above the rail. Clicking Situations swaps the rail to three buttons, hides the left statistics button, removes the vehicle markers, and puts `?mode=situations` in the URL. Reloading that URL comes back in situations mode. Opening a drawer slides the pill left with the buttons.

- [ ] **Step 13: Commit**

```bash
git add src/components/ModeSwitch.tsx src/hooks/useModeQueryParam.ts src/hooks/useFilterQueryParams.ts src/index.css src/components/App.tsx src/components/MapView.tsx src/components/RightMenu src/components/LeftMenu
git commit -m "Add Vehicles/Situations mode switch"
```

---

### Task 5: Hide and clear the other mode's layers on switch

Without this, vehicle layers stay visible in situations mode: the components stop feeding their sources but the style still declares the layers visible with the last data in them.

**Files:**

- Create: `src/components/ModeLayers.tsx`
- Modify: `src/components/MapView.tsx` (render it inside `<Map>`)

**Interfaces:**

- Consumes: `MODE_LAYERS`, `MODE_SWITCHED_LAYERS`, `MODE_SOURCES`, `otherMode`, `AppMode` from Task 3
- Produces: nothing — a rendering-free effect component

- [ ] **Step 1: Write the component**

Create `src/components/ModeLayers.tsx`:

```tsx
import { GeoJSONSource } from "maplibre-gl";
import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import {
  AppMode,
  MODE_LAYERS,
  MODE_SOURCES,
  MODE_SWITCHED_LAYERS,
  otherMode,
} from "../domain/appMode.ts";
import { MapViewOptions } from "../types.ts";

const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [],
};

/**
 * Layers and sources are declared statically in mapStyle and are never added or
 * removed, so leaving a mode does not unmount its layers — it just stops
 * feeding them. This is what actually hides them.
 *
 * Only switch-owned layers are revealed on entry. Layers owned by component
 * state (`service-journey-route-layer`) stay hidden until that state says
 * otherwise; selections are cleared on a mode switch, so hidden is correct.
 */
export function ModeLayers({
  mode,
  mapViewOptions,
}: {
  mode: AppMode;
  mapViewOptions: MapViewOptions;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const apply = () => {
      const leaving = otherMode(mode);

      for (const id of MODE_LAYERS[leaving]) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        }
      }

      const switched = MODE_SWITCHED_LAYERS[mode];
      for (const id of MODE_LAYERS[mode]) {
        if (!map.getLayer(id)) continue;
        const optionKey = switched[id];
        if (!optionKey) continue;
        map.setLayoutProperty(
          id,
          "visibility",
          mapViewOptions[optionKey] ? "visible" : "none",
        );
      }

      for (const sourceId of MODE_SOURCES[leaving]) {
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
        source?.setData(EMPTY_FEATURE_COLLECTION);
      }
    };

    // getLayer/getSource return undefined until the style has loaded, and this
    // effect can run first. Same hazard the vehicle and situation source
    // writers already guard against.
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("load", apply);
    // If the effect re-runs before "load" fires, drop the pending handler —
    // otherwise each run stacks another one and they all fire at once.
    return () => {
      map.off("load", apply);
    };
  }, [mode, mapRef, mapViewOptions]);

  return null;
}
```

Depending on `mapViewOptions` as a whole is intentional: `MapLayers` already sets visibility imperatively as the user flips a switch, so this effect re-running is a harmless reassertion of the same values, and it keeps the entry state correct if a switch was flipped in the other mode.

- [ ] **Step 2: Render it**

In `src/components/MapView.tsx`, inside `<Map>` and next to `<RegisterIcons />`:

```tsx
<ModeLayers mode={mode} mapViewOptions={mapViewOptions} />
```

Import it from `./ModeLayers.tsx`.

- [ ] **Step 3: Verify by hand**

Run: `npm run format && npm test && npx tsc -b && npm run check`, then `npm run dev`.

Expected: switching to Situations leaves no vehicle markers, traces, delay dots, or heatmap on the map, and situation stops/lines appear. Switching back restores exactly the vehicle switches you had set — flip Delay off, switch to Situations, switch back, Delay is still off. Selecting a vehicle to draw its route, then switching away and back, leaves no orphaned route line.

- [ ] **Step 4: Commit**

```bash
git add src/components/ModeLayers.tsx src/components/MapView.tsx
git commit -m "Hide and clear the inactive mode's map layers"
```

---

### Task 6: Gate the subscriptions

The point of the whole change. After this, only one feed streams at a time.

**Files:**

- Modify: `src/hooks/useSituationsSubscription.ts`
- Modify: `src/hooks/useVehiclePositionsData.ts`
- Modify: `src/situations/SituationsProvider.tsx`
- Modify: `src/components/App.tsx`

**Interfaces:**

- Consumes: `isVehicleFeedEnabled`, `isSituationsFeedEnabled`, `AppMode` from Task 3
- Produces:
  - `useSituationsSubscription(enabled: boolean): SituationsFeed`
  - `useVehiclePositionsData(filter, mapViewOptions, enabled: boolean): VehicleData[]`
  - `<SituationsProvider codespaceId enabled>`

- [ ] **Step 1: Gate the situations subscription**

In `src/hooks/useSituationsSubscription.ts`, change the signature to take `enabled: boolean` and add a guard as the first statement inside the `useEffect`:

```ts
if (!enabled) {
  // Reset rather than freeze: the feed has no TTL, so keeping the last
  // frames would present a stale snapshot as live on returning.
  byNumber.current = new Map();
  setFeed({ situations: [], status: "connecting", lastUpdated: null });
  return;
}
```

Add `enabled` to the dependency array alongside `subscriptionClient`. Everything below the guard — including the `emptyTimer` and the existing cleanup — stays as it is.

- [ ] **Step 2: Gate the vehicle subscription and fix the leak**

In `src/hooks/useVehiclePositionsData.ts`, add `enabled: boolean` as a third parameter. Today the hook calls `subscriptionClient.iterate(...)` unconditionally and only afterwards checks `if (filter && filter.boundingBox)` before consuming it — so a subscription is opened even when nothing reads it. Restructure so the `iterate` call happens only when the subscription will actually be consumed:

```ts
    if (!enabled || !filter?.boundingBox) {
      map.current.clear();
      setData([]);
      return;
    }

    subscription.current = subscriptionClient.iterate<Data>({
      query: subscriptionQuery,
      variables: { … unchanged … },
    });
    const subscribe = async () => { … unchanged … };
    subscribe();
```

The existing `subscription.current?.return()` at the top of the effect stays where it is, above the guard, so leaving vehicles mode still tears the old iterator down. Add `enabled` to the dependency array.

- [ ] **Step 3: Gate the provider**

In `src/situations/SituationsProvider.tsx`, add `enabled: boolean` to the props and pass it through:

```tsx
const feed = useSituationsSubscription(enabled);
```

The provider itself stays mounted in both modes — unmounting it would throw away `useSituationLineGeometry`'s per-line-ref cache and re-fetch every borrowed line geometry on each return to situations mode.

Also clear the situation selection when the feed is disabled, so returning to situations mode does not restore a detail view for a situation that is no longer in the feed:

```tsx
useEffect(() => {
  if (!enabled) setSelected(null);
}, [enabled]);
```

Import `useEffect` from `react`.

- [ ] **Step 4: Wire both from App**

In `src/components/App.tsx`:

```tsx
const data = useVehiclePositionsData(
  currentFilter,
  mapViewOptions,
  isVehicleFeedEnabled(mode),
);
```

and:

```tsx
        <SituationsProvider
          codespaceId={currentFilter?.codespaceId}
          enabled={isSituationsFeedEnabled(mode)}
        >
```

Import both predicates from `../domain/appMode.ts`.

- [ ] **Step 5: Verify the gate directly**

This is the claim the whole change rests on, so check it rather than assume it.

Run: `npm run format && npm test && npx tsc -b && npm run check`, then `npm run dev`. Open DevTools → Network → WS → the `graphql` socket → Messages.

Expected: in vehicles mode, `vehicles` payloads arrive and no `situations` payload ever does. Switch to Situations: `vehicles` payloads stop, `situations` payloads start. Switch back: the reverse. The situations panel shows "Connecting…" briefly on each return rather than a stale count.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSituationsSubscription.ts src/hooks/useVehiclePositionsData.ts src/situations/SituationsProvider.tsx src/components/App.tsx
git commit -m "Run only the active mode's subscription"
```

---

### Task 7: Per-mode filter and layer drawers

The last structural change: each drawer holds only what its mode can act on.

**Files:**

- Modify: `src/components/FilterBox.tsx`
- Modify: `src/components/MapLayers.tsx`
- Modify: `src/components/RightMenu/DrawerContent.tsx`
- Modify: `src/components/SituationsPanel/SituationsPanel.tsx`

**Interfaces:**

- Consumes: `AppMode` from Task 3, `mode` prop on `DrawerContent` from Task 4
- Produces: `<FilterBox mode …>`, `<MapLayers mode …>`

- [ ] **Step 1: Make the filter drawer mode-aware**

In `src/components/FilterBox.tsx`, add `mode: AppMode` to `FilterProps` (importing `AppMode` from `../domain/appMode.ts` and `SituationFilters` from `./SituationsPanel/SituationFilters.tsx`), and render the vehicle-only controls and the situation facets on their respective sides:

```tsx
<CodespaceFilter
  currentFilter={currentFilter}
  setCurrentFilter={setCurrentFilter}
/>;
{
  mode === "vehicles" && (
    <>
      <Box sx={{ mt: 2 }} />
      <OperatorFilter
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
      />
      <Box sx={{ mt: 2 }} />
      <MaxDataAgeFilter
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
      />
    </>
  );
}
{
  mode === "situations" && (
    <>
      <Box sx={{ mt: 2 }} />
      <SituationFilters />
    </>
  );
}
```

Codespace stays outside the branch: it is the one filter that means the same thing to both modes, and keeping it in a single control is the CLAUDE.md invariant.

`SituationFilters` reads everything from `useSituations()` and takes no props, so it works unchanged in its new parent — `SituationsProvider` wraps `MapView` and therefore the drawer too.

- [ ] **Step 2: Take the facets out of the panel**

In `src/components/SituationsPanel/SituationsPanel.tsx`, delete the `<SituationFilters />` element and its import. The panel becomes a readout: status line, list, detail, unmappable list, stats.

- [ ] **Step 3: Split the layer switches by mode**

In `src/components/MapLayers.tsx`, add `mode: AppMode` to `Props` (importing `AppMode` from `../domain/appMode.ts`), wrap the seven vehicle `FormControlLabel`s in `{mode === "vehicles" && (<>…</>)}` and the two situation ones in `{mode === "situations" && (<>…</>)}`.

- [ ] **Step 4: Pass mode into both**

In `src/components/RightMenu/DrawerContent.tsx`, pass `mode={mode}` to `<FilterBox>` and `<MapLayers>`.

Note the existing `currentFilter &&` guards: `filtering`, `info`, `layers` and `stoplight` all render only once a filter exists. Keep those as they are — `CaptureBoundingBox` populates the filter on the first `moveend`, which happens on load in both modes.

- [ ] **Step 5: Verify by hand**

Run: `npm run format && npm test && npx tsc -b && npm run check`, then `npm run dev`.

Expected: in vehicles mode the Filter drawer holds codespace, operator and max data age, and Layers holds the seven vehicle switches. In situations mode Filter holds codespace plus the severity / report type / quality flag chips, Layers holds Affected stops and Affected lines, and the Situations panel starts with its status line — no filter block. Selecting a codespace narrows both the situations list and the stats-versus-list counts as before; the facet counts stay computed over the whole feed.

- [ ] **Step 6: Commit**

```bash
git add src/components/FilterBox.tsx src/components/MapLayers.tsx src/components/RightMenu/DrawerContent.tsx src/components/SituationsPanel/SituationsPanel.tsx
git commit -m "Give each mode its own filter and layer drawer"
```

---

### Task 8: Playwright smoke test

Not run in CI (`.github/workflows/build.yml` runs `npm test`, `npm run check`, `npm run build` only), so this is local confidence, not a gate.

**Files:**

- Modify: `tests/smoketests.spec.ts`

**Interfaces:**

- Consumes: the finished UI from Tasks 4–7

- [ ] **Step 1: Write the test**

Append to `tests/smoketests.spec.ts`:

```ts
test("switching to situations mode swaps the tool rail", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Data report" })).toBeVisible();

  await page.getByRole("button", { name: "Situations", exact: true }).click();

  await expect(page).toHaveURL(/mode=situations/);
  await expect(page.getByRole("button", { name: "Data report" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Info" })).toHaveCount(0);

  await page
    .getByRole("button", { name: "Situations", exact: true })
    .nth(1)
    .click();
  await expect(page.getByRole("heading", { name: "Situations" })).toBeVisible();
});

test("mode survives a reload", async ({ page }) => {
  await page.goto("/?mode=situations");

  await expect(page.getByRole("button", { name: "Data report" })).toHaveCount(
    0,
  );
});
```

The `.nth(1)` is because "Situations" names both the mode toggle and the rail button. If that proves brittle, give the rail button a `title` that differs from the toggle label rather than loosening the selector.

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/smoketests.spec.ts -g "mode"`
Expected: PASS. Playwright auto-starts `npm run dev`.

- [ ] **Step 3: Commit**

```bash
git add tests/smoketests.spec.ts
git commit -m "Smoke-test the mode switch"
```

---

### Task 9: Update CLAUDE.md

The data-flow section describes an architecture this change replaces. Leaving it stale would mislead the next reader more than having no note at all.

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite the affected parts**

In the **Data flow** section:

- Add mode as the first item: `App` holds `mode`, `currentFilter` and `mapViewOptions`; mode decides which subscription is open and is synced to the URL as `?mode=`.
- Amend item 7: `SituationsProvider` stays mounted in both modes but only subscribes in situations mode.

In **Key invariants worth preserving**, add:

- Every layer and source in `mapStyle.ts` must be claimed by exactly one mode in `src/domain/appMode.ts`. `appMode.test.ts` enforces this — a new layer that is not assigned will fail the build, which is the point: an unassigned layer is never hidden when its mode is left.
- Only switch-owned layers are reapplied on entering a mode. Layers driven by component state stay hidden until that state reveals them.
- The two feeds are mutually exclusive. Anything needing both at once — the affected-vehicle halos, removed here — cannot work.

In **Situations carry almost no geography**, note that `useSituationLineGeometry`'s cache is why `SituationsProvider` stays mounted in vehicles mode instead of unmounting.

- [ ] **Step 2: Verify and commit**

Run: `npm run format && npm run check`

```bash
git add CLAUDE.md
git commit -m "Document the vehicles/situations mode split"
```

---

## Self-Review

**Spec coverage:**

| Spec section                                                  | Task                                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The model (`AppMode`, `?mode=`, delete `showSituations`)      | 2, 4                                                                                                  |
| The control (segmented switch above the rail)                 | 4                                                                                                     |
| What each mode owns (rail, left rail, panels, map children)   | 4, 7                                                                                                  |
| Filtering (facets into the drawer, one codespace control)     | 7                                                                                                     |
| Layers (affected stops / affected lines)                      | 2, 7                                                                                                  |
| Data gating (both `enabled` flags, the `iterate` leak)        | 6                                                                                                     |
| `useSituationLineGeometry` unaffected, provider stays mounted | 6                                                                                                     |
| Map layers across a switch (hide / reapply / clear)           | 5                                                                                                     |
| Switch-owned vs component-owned vs dormant layers             | 3, 5                                                                                                  |
| Persist / reset table                                         | 4 (vehicle selection), 6 (situation selection, both caches), 7 (filters persist by not being touched) |
| Delete the halos                                              | 1                                                                                                     |
| `SelectedVehiclePanel` situations stay                        | 4 (kept inside the vehicles branch)                                                                   |
| `src/domain/appMode.ts` structure                             | 3                                                                                                     |
| Testing (unit, Playwright, manual WS check)                   | 3, 6, 8                                                                                               |

No gaps. Task 9 is not in the spec — documentation upkeep the spec did not think to name.

**Type consistency:** `AppMode`, `MODE_LAYERS`, `MODE_SWITCHED_LAYERS`, `MODE_SOURCES`, `otherMode`, `isVehicleFeedEnabled`, `isSituationsFeedEnabled` and `parseAppMode` are defined in Task 3 and used with those exact names in Tasks 4–7. `showAffectedStops` / `showAffectedLines` are introduced in Task 2 and referenced identically in Tasks 3, 4, 5 and 7.

**Known ordering constraint:** Task 3's completeness test fails unless Task 1 has removed `situation-affected-vehicles-layer` and `situationVehicles` from `mapStyle.ts` and Task 2 has renamed the `MapViewOptions` keys. Tasks 1 → 2 → 3 must run in order. Tasks 5, 6 and 7 are independent of each other once 4 is done.
