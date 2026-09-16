# Modernize Look and Feel (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the map chrome a neutral-slate MUI theme with a system/light/dark toggle, Inter, MUI icons, and a floating-card layout that removes every hand-kept layout offset.

**Architecture:** One MUI theme built with CSS theme variables (`colorSchemes` light/dark, selector `[data-mui-color-scheme="%s"]`), so MUI components and plain CSS (MapLibre controls, popups, chase HUD) switch together. Floating surfaces share one `FloatingCard` component and one `--floating-shadow` CSS variable. The right side becomes one flex cluster (mode pill → toolbar + tool panel) so nothing is positioned by hand; the left rail is removed and Statistics joins the right toolbar.

**Tech Stack:** React 19, MUI 9.4 (`@mui/material`, new `@mui/icons-material`), `@fontsource-variable/inter`, react-map-gl/maplibre, Vitest (node env, `src/**/*.test.ts` only), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-modernize-look-and-feel-design.md`

## Global Constraints

- Colour scheme selector: `'[data-mui-color-scheme="%s"]'` — never the `"data"` shorthand (it sets `data-dark`).
- Storage key: `vehicle-map-color-scheme`, in `theme.ts` (`COLOR_SCHEME_STORAGE_KEY`) and the pre-load script in `index.html`. Change one, change both.
- Palette (light / dark): `background.paper` `#ffffff` / `#23262d`; `text.primary` `#1f2430` / `#e9ebef`; `text.secondary` `#5b6272` / `#a3a9b4`; `divider` `#d9dce2` / `#40444e`; `primary.main` `#1f2430` / `#e9ebef`; `selection.main` `#00857c` / `#3fd0c5`; `selection.bg` `#e6f6f5` / `#1b3533`.
- Radius: 10px for cards over the map (`CARD_RADIUS`), 6px theme default for rows, buttons, chips. Inset: 12px (`SURFACE_INSET`).
- Font: Inter Variable, base `typography.fontSize` 13.
- **Refinement of the spec:** the shared shadow is defined once, as `--floating-shadow` in `src/index.css` (with a stronger value under the dark selector), and read as `"var(--floating-shadow)"` from `sx`. The spec had a `theme.ts` constant mirrored into CSS; one definition cannot drift, and a single shadow value is invisible on dark panels.
- **Data colours are out of scope** and must not change: `situationSeverity.ts`, `delayThresholds.ts`, the occupancy table and `#c0392b` cancelled/warning reds in `StopRow.tsx`, the flag-warning `#c0392b` in `SituationRow`/`UnmappableList`, anything in `mapStyle.ts`, `vehicleMeshes.ts`, `vehiclePaint.ts`.
- Map-symbol images stay: Legend and MapLayers images, `orangeMarker.png` (MapLayers uses it), the status lights in `DataResults` and `VehicleDetailsDialog`.
- Accessible names the smoke tests rely on stay exactly: "Layers", "Filter", "Info", "Data report", "Feed report", "Situations panel", "Situations" (mode toggle), heading "Situations".
- Local imports carry explicit `.ts`/`.tsx` extensions. No `.tsx` file exports a non-component (`react-refresh/only-export-components`) — shared constants go in `.ts` files.
- Do not render components chosen at render time (`const Icon = cond ? A : B; <Icon />`); keep icons as JSX elements in a record or render conditionally, so `react-hooks` lint stays clean.
- Stage by explicit path. Never `git add -A`: `build/`, `vehicle-map-demo.iml` and `src/static/images/vehicles/` (base map PR) are untracked and must stay out.
- Commit messages: plain imperative sentence, no prefix (repo style, e.g. "Reduce chase camera CPU use").
- Gates before calling a task done: `npm test`, `npm run check`, `npm run build`, and the lint rule below. Playwright: `npx playwright test --project=chromium` (auto-starts `npm run dev`, talks to the live dev API).
- **Lint is not clean on master and is not a CI gate.** Baseline on this branch before Task 1: `npm run lint` reports `19 problems (16 errors, 3 warnings)`, in `CaptureBoundingBox`, `Legend`, `MapView`, `SelectedVehiclePanel`, `VehicleDetailsDialog`, `SituationsProvider` and six hooks. Lint is run on its own, never chained with `&&`, and the requirement is that the totals do not rise. Do not fix pre-existing problems — out of scope.

---

### Task 1: Theme foundation and colour scheme toggle

**Files:**

- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `src/components/theme.ts` (full rewrite)
- Create: `src/domain/colorSchemeMode.ts`
- Test: `src/domain/colorSchemeMode.test.ts`
- Create: `src/components/FloatingCard.tsx`
- Create: `src/components/ColorSchemeToggle.tsx`
- Modify: `src/components/ModeSwitch.tsx`
- Modify: `src/components/App.tsx`
- Modify: `src/main.tsx`
- Modify: `index.html`
- Modify: `src/index.css` (add shadow variable; drop `background: #fff` from `.mode-switch`)
- Test: `tests/smoketests.spec.ts`

**Interfaces:**

- Produces:
  - `theme.ts`: `theme`, `COLOR_SCHEME_STORAGE_KEY = "vehicle-map-color-scheme"`, `SURFACE_INSET = 12`, `CARD_RADIUS = 10`; palette augmentation `palette.selection: { main: string; bg: string }` (CSS vars `--mui-palette-selection-main`, `--mui-palette-selection-bg`).
  - `colorSchemeMode.ts`: `type ColorSchemeMode = "system" | "light" | "dark"`, `nextColorSchemeMode(mode: ColorSchemeMode): ColorSchemeMode`.
  - `FloatingCard(props: PaperProps)` — Paper with card radius, `var(--floating-shadow)`, `pointerEvents: "auto"`, elevation 0.
  - CSS variable `--floating-shadow`.
  - A button named `Theme: <mode>` in the mode pill.

- [ ] **Step 1: Swap dependencies**

```bash
npm install @fontsource-variable/inter@^5.3.0 @mui/icons-material@^9.4.0
npm uninstall @fontsource/roboto
```

Expected: both added under `dependencies`, `@fontsource/roboto` gone. Roboto was never imported, so nothing references it.

- [ ] **Step 2: Write the failing unit test**

Create `src/domain/colorSchemeMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextColorSchemeMode } from "./colorSchemeMode.ts";

describe("nextColorSchemeMode", () => {
  it("cycles system, light, dark", () => {
    expect(nextColorSchemeMode("system")).toBe("light");
    expect(nextColorSchemeMode("light")).toBe("dark");
    expect(nextColorSchemeMode("dark")).toBe("system");
  });

  it("returns to where it started after three steps", () => {
    let mode = nextColorSchemeMode("system");
    mode = nextColorSchemeMode(mode);
    mode = nextColorSchemeMode(mode);
    expect(mode).toBe("system");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/domain/colorSchemeMode.test.ts`
Expected: FAIL — cannot resolve `./colorSchemeMode.ts`.

- [ ] **Step 4: Implement**

Create `src/domain/colorSchemeMode.ts`:

```ts
/** The three settings the theme toggle offers. `system` follows the OS. */
export type ColorSchemeMode = "system" | "light" | "dark";

const ORDER: ColorSchemeMode[] = ["system", "light", "dark"];

/** The mode one click of the toggle moves to. */
export function nextColorSchemeMode(mode: ColorSchemeMode): ColorSchemeMode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/domain/colorSchemeMode.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing Playwright test**

Append to `tests/smoketests.spec.ts`:

```ts
test("the theme toggle switches to dark and survives a reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("button", { name: "Theme: light" }).click();
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
  await expect(html).toHaveAttribute("data-mui-color-scheme", "dark");

  // Hold the app back on its config fetch, so React has not rendered when we
  // look: a dark attribute at that point can only have come from the pre-load
  // script in index.html.
  await page.route("**/bootstrap.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(html).toHaveAttribute("data-mui-color-scheme", "dark", {
    timeout: 500,
  });

  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx playwright test --project=chromium -g "theme toggle"`
Expected: FAIL — no button named "Theme: system".

- [ ] **Step 8: Rewrite `src/components/theme.ts`**

```ts
import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    /** Marks what is selected — the active tool, the selected row — and
     * nothing else. The chrome is otherwise neutral so data colours stand out. */
    selection: { main: string; bg: string };
  }
  interface PaletteOptions {
    selection?: { main: string; bg: string };
  }
}

/**
 * localStorage key MUI keeps the colour scheme mode under. The pre-load script
 * in index.html reads the same key to avoid a light flash — change both.
 */
export const COLOR_SCHEME_STORAGE_KEY = "vehicle-map-color-scheme";

/** Distance of every floating surface from the map edge. */
export const SURFACE_INSET = 12;

/** Corner radius of cards over the map. Rows, buttons and chips use the
 * theme's 6px. */
export const CARD_RADIUS = 10;

export const theme = createTheme({
  // Explicit rather than the "data" shorthand, which would set a bare
  // `data-dark` attribute that neither MUI's InitColorSchemeScript convention
  // nor our pre-load script uses.
  cssVariables: { colorSchemeSelector: '[data-mui-color-scheme="%s"]' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1f2430", contrastText: "#ffffff" },
        background: { default: "#f4f5f7", paper: "#ffffff" },
        text: { primary: "#1f2430", secondary: "#5b6272" },
        divider: "#d9dce2",
        selection: { main: "#00857c", bg: "#e6f6f5" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#e9ebef", contrastText: "#16181d" },
        background: { default: "#16181d", paper: "#23262d" },
        text: { primary: "#e9ebef", secondary: "#a3a9b4" },
        divider: "#40444e",
        selection: { main: "#3fd0c5", bg: "#1b3533" },
      },
    },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: "'Inter Variable', system-ui, sans-serif",
    fontSize: 13,
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 2,
          "& .MuiToggleButtonGroup-grouped": {
            border: 0,
            borderRadius: 6,
            margin: 0,
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: "4px 10px",
          color: (theme.vars ?? theme).palette.text.secondary,
          "&.Mui-selected, &.Mui-selected:hover": {
            backgroundColor: (theme.vars ?? theme).palette.primary.main,
            color: (theme.vars ?? theme).palette.primary.contrastText,
          },
        }),
      },
    },
  },
});
```

- [ ] **Step 9: Add the shadow variable to `src/index.css`**

Insert at the top of the file, above `body {`:

```css
/* The one shadow every surface over the map uses — cards, toolbar, popups,
   map controls. Read from sx as "var(--floating-shadow)". Dark panels over a
   dark map need a much stronger shadow to separate at all. */
:root {
  --floating-shadow: 0 2px 10px rgba(20, 24, 32, 0.18);
}

[data-mui-color-scheme="dark"] {
  --floating-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
}
```

In the `.mode-switch` rule, delete the line `background: #fff;` (the Paper provides the background now).

- [ ] **Step 10: Create `src/components/FloatingCard.tsx`**

```tsx
import { Paper, PaperProps } from "@mui/material";
import { CARD_RADIUS } from "./theme.ts";

/**
 * A surface floating over the map: card radius, the shared shadow, and pointer
 * events back on — floating clusters switch them off so the map stays
 * draggable between cards. Elevation 0 because MUI lightens elevated Paper in
 * dark mode, which would make each card a slightly different grey.
 */
export function FloatingCard({ sx, ...props }: PaperProps) {
  return (
    <Paper
      elevation={0}
      {...props}
      sx={[
        {
          borderRadius: `${CARD_RADIUS}px`,
          boxShadow: "var(--floating-shadow)",
          pointerEvents: "auto",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
```

- [ ] **Step 11: Create `src/components/ColorSchemeToggle.tsx`**

```tsx
import { IconButton, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { ReactElement } from "react";
import {
  ColorSchemeMode,
  nextColorSchemeMode,
} from "../domain/colorSchemeMode.ts";

const ICONS: Record<ColorSchemeMode, ReactElement> = {
  system: <BrightnessAutoIcon fontSize="small" />,
  light: <LightModeIcon fontSize="small" />,
  dark: <DarkModeIcon fontSize="small" />,
};

/** Cycles system → light → dark. MUI persists the choice. */
export function ColorSchemeToggle() {
  const { mode, setMode } = useColorScheme();
  // `mode` is undefined until MUI has read storage. Show `system` rather than
  // nothing so the pill does not change width.
  const current: ColorSchemeMode = mode ?? "system";
  const label = `Theme: ${current}`;

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        onClick={() => setMode(nextColorSchemeMode(current))}
        sx={{ borderRadius: "6px", color: "text.secondary" }}
      >
        {ICONS[current]}
      </IconButton>
    </Tooltip>
  );
}
```

- [ ] **Step 12: Put the toggle in the mode pill — `src/components/ModeSwitch.tsx`**

Replace the file with (positioning props and classes stay for now; Task 2 removes them):

```tsx
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { AppMode } from "../domain/appMode.ts";
import { FloatingCard } from "./FloatingCard.tsx";
import { ColorSchemeToggle } from "./ColorSchemeToggle.tsx";

type Props = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  drawerOpen: boolean;
  /** The open drawer is a wide one, so the switch shifts further left. */
  wide: boolean;
};

/**
 * Always visible, because mode governs which subscription is open. Putting it
 * inside a drawer — which is closed by default — would leave the app with no
 * on-screen indication of which feed is running.
 */
export function ModeSwitch({ mode, setMode, drawerOpen, wide }: Props) {
  return (
    <FloatingCard
      className={`mode-switch ${drawerOpen ? "open" : ""} ${wide ? "wide" : ""}`}
      sx={{ display: "flex", alignItems: "center", gap: 0.5, padding: 0.5 }}
    >
      <ToggleButtonGroup
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
      <ColorSchemeToggle />
    </FloatingCard>
  );
}
```

- [ ] **Step 13: Wire the theme in `src/components/App.tsx`**

Replace the two import lines

```tsx
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme.ts";
```

with

```tsx
import { CssBaseline, ThemeProvider } from "@mui/material";
import { COLOR_SCHEME_STORAGE_KEY, theme } from "./theme.ts";
```

and replace `<ThemeProvider theme={theme}>` with

```tsx
      <ThemeProvider
        theme={theme}
        modeStorageKey={COLOR_SCHEME_STORAGE_KEY}
        // Client-only app: read the stored mode on the first render instead
        // of rendering once with no mode and again after mount.
        noSsr
      >
        <CssBaseline enableColorScheme />
```

- [ ] **Step 14: Load Inter — `src/main.tsx`**

Add as the first import after `react-dom/client`:

```tsx
import "@fontsource-variable/inter";
```

- [ ] **Step 15: Add the pre-load script — `index.html`**

Insert inside `<head>`, after the `<title>` line:

```html
<script>
  // Mirrors MUI's InitColorSchemeScript: apply the saved colour scheme
  // before the bundle loads, so dark-mode users see no light flash. The key
  // is COLOR_SCHEME_STORAGE_KEY in src/components/theme.ts — change both.
  (function () {
    try {
      var mode = localStorage.getItem("vehicle-map-color-scheme") || "system";
      var scheme =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : mode;
      if (scheme === "light" || scheme === "dark") {
        document.documentElement.setAttribute("data-mui-color-scheme", scheme);
      }
    } catch (e) {}
  })();
</script>
```

- [ ] **Step 16: Run the Playwright test to verify it passes**

Run: `npx playwright test --project=chromium -g "theme toggle"`
Expected: PASS.

- [ ] **Step 17: Run the gates**

Run: `npm test && npm run check && npm run build`

Then run `npm run lint 2>&1 | tail -1` separately (it exits non-zero on master): the problem totals must not exceed the baseline in Global Constraints.
Expected: all pass. If `npm run check` fails, run `npx prettier --write` on the changed files and re-run.

- [ ] **Step 18: Commit**

```bash
git add package.json package-lock.json src/components/theme.ts src/domain/colorSchemeMode.ts src/domain/colorSchemeMode.test.ts src/components/FloatingCard.tsx src/components/ColorSchemeToggle.tsx src/components/ModeSwitch.tsx src/components/App.tsx src/main.tsx index.html src/index.css tests/smoketests.spec.ts
git commit -m "Add slate light and dark theme with a colour scheme toggle"
```

---

### Task 2: Floating right-side cluster, Statistics in the toolbar, no left rail

**Files:**

- Modify: `src/components/RightMenu/types.ts`
- Modify: `src/domain/appMode.ts:141-163`
- Test: `src/domain/appMode.test.ts:155-200`
- Create: `src/components/RightMenu/toolLabels.ts`
- Modify: `src/components/RightMenu/RightMenuButtons.tsx` (full rewrite)
- Modify: `src/components/RightMenu/RightMenu.tsx` (full rewrite)
- Modify: `src/components/RightMenu/DrawerContent.tsx`
- Modify: `src/components/ModeSwitch.tsx`
- Modify: `src/components/MapView.tsx` (remove `LeftMenu`)
- Delete: `src/components/LeftMenu/` (whole directory)
- Modify: `src/index.css` (remove rail/drawer/mode-switch rules)
- Modify: `src/components/InfoBox.tsx`, `src/components/Legend.tsx`, `src/components/FilterBox.tsx`, `src/components/MapLayers.tsx`, `src/components/DataChecker/DataChecker.tsx` (drop `Card` wrappers)
- Modify: `src/components/SituationsPanel/SituationsPanel.tsx` (drop own padding and viewport max-height)
- Test: `tests/smoketests.spec.ts`

**Interfaces:**

- Consumes: `FloatingCard`, `SURFACE_INSET` (Task 1).
- Produces:
  - `RightContentType` gains `"statistics"`.
  - `rightRailTools("vehicles")` → `["layers", "filtering", "info", "stoplight", "statistics"]`.
  - `TOOL_LABELS: Record<RightContentType, string>` in `toolLabels.ts`.
  - The open tool panel is `role="region"` named by its tool label.
  - `ModeSwitch` props become `{ mode, setMode }`.

- [ ] **Step 1: Update the unit tests first — `src/domain/appMode.test.ts`**

Replace the `KNOWN_CONTENT_TYPES` array with:

```ts
const KNOWN_CONTENT_TYPES: RightContentType[] = [
  "filtering",
  "info",
  "layers",
  "stoplight",
  "statistics",
  "situations",
  "situationStats",
];
```

In `describe("rightRailTools")`, replace the vehicles expectation with:

```ts
expect(rightRailTools("vehicles")).toEqual([
  "layers",
  "filtering",
  "info",
  "stoplight",
  "statistics",
]);
```

and add a new test inside the same `describe`:

```ts
it("offers statistics in vehicles mode only", () => {
  expect(rightRailTools("vehicles")).toContain("statistics");
  expect(rightRailTools("situations")).not.toContain("statistics");
});
```

In `describe("isWideTool")`, add to the first test:

```ts
expect(isWideTool("statistics")).toBe(false);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/appMode.test.ts`
Expected: FAIL — type error / `"statistics"` missing from the vehicles list.

- [ ] **Step 3: Implement the domain change**

`src/components/RightMenu/types.ts`:

```ts
export type RightContentType =
  | "filtering"
  | "info"
  | "layers"
  | "stoplight"
  | "statistics"
  | "situations"
  | "situationStats";
```

In `src/domain/appMode.ts`, change the vehicles entry of `RIGHT_RAIL_TOOLS`:

```ts
  vehicles: ["layers", "filtering", "info", "stoplight", "statistics"],
```

and replace the doc comment above `WIDE_TOOLS` with:

```ts
/**
 * Tools whose panel opens wider than the default 300px.
 *
 * The feed report is six count tables over the whole feed; in a narrow column
 * they stack into one long scroll and nothing can be compared side by side.
 * Only the tool panel reads this — nothing else moves when it widens.
 */
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/appMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing Playwright test**

Append to `tests/smoketests.spec.ts`:

```ts
test("statistics is a vehicles-mode tool in the right toolbar", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByRole("region", { name: "Statistics" })).toBeVisible();

  await page.getByRole("button", { name: "Situations", exact: true }).click();
  await expect(page.getByRole("button", { name: "Statistics" })).toHaveCount(0);
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx playwright test --project=chromium -g "statistics is a vehicles-mode tool"`
Expected: FAIL at the region assertion — the left rail's Statistics button exists (its name comes from the `<img alt>`), but it opens the left drawer, which has no region named "Statistics".

- [ ] **Step 7: Create `src/components/RightMenu/toolLabels.ts`**

```ts
import { RightContentType } from "./types.ts";

/**
 * Each tool's name: the toolbar button's accessible name and tooltip, and the
 * name of the panel it opens. The smoke tests find tools by these strings.
 */
export const TOOL_LABELS: Record<RightContentType, string> = {
  layers: "Layers",
  filtering: "Filter",
  info: "Info",
  stoplight: "Data report",
  statistics: "Statistics",
  situationStats: "Feed report",
  // Deliberately not "Situations": that is the mode toggle's label, and two
  // controls with the same accessible name cannot be told apart.
  situations: "Situations panel",
};
```

- [ ] **Step 8: Rewrite `src/components/RightMenu/RightMenuButtons.tsx`**

```tsx
import { IconButton, Tooltip } from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import FilterListIcon from "@mui/icons-material/FilterList";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import BarChartIcon from "@mui/icons-material/BarChart";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { ReactElement } from "react";
import { AppMode, rightRailTools } from "../../domain/appMode.ts";
import { FloatingCard } from "../FloatingCard.tsx";
import { RightContentType } from "./types.ts";
import { TOOL_LABELS } from "./toolLabels.ts";

const ICONS: Record<RightContentType, ReactElement> = {
  layers: <LayersIcon fontSize="small" />,
  filtering: <FilterListIcon fontSize="small" />,
  info: <InfoOutlinedIcon fontSize="small" />,
  stoplight: <FactCheckIcon fontSize="small" />,
  statistics: <BarChartIcon fontSize="small" />,
  situations: <WarningAmberIcon fontSize="small" />,
  situationStats: <AssessmentIcon fontSize="small" />,
};

type RightMenuButtonsProps = {
  mode: AppMode;
  activeContent: RightContentType | null;
  setActiveContent: (contentType: RightContentType | null) => void;
};

export const RightMenuButtons = ({
  mode,
  activeContent,
  setActiveContent,
}: RightMenuButtonsProps) => (
  <FloatingCard
    role="navigation"
    aria-label="Tools"
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: 0.25,
      padding: 0.5,
      flexShrink: 0,
    }}
  >
    {rightRailTools(mode).map((content) => {
      const label = TOOL_LABELS[content];
      const active = activeContent === content;
      return (
        <Tooltip key={content} title={label} placement="left">
          <IconButton
            aria-label={label}
            aria-pressed={active}
            onClick={() => setActiveContent(active ? null : content)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "6px",
              color: active ? "selection.main" : "text.secondary",
              bgcolor: active ? "selection.bg" : "transparent",
              "&:hover": { bgcolor: active ? "selection.bg" : "action.hover" },
            }}
          >
            {ICONS[content]}
          </IconButton>
        </Tooltip>
      );
    })}
  </FloatingCard>
);
```

- [ ] **Step 9: Rewrite `src/components/RightMenu/RightMenu.tsx`**

```tsx
import { useState } from "react";
import { Box } from "@mui/material";
import { Filter, MapViewOptions, VehicleUpdate } from "../../types.ts";
import { RightMenuButtons } from "./RightMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { RightContentType } from "./types.ts";
import { TOOL_LABELS } from "./toolLabels.ts";
import { ModeSwitch } from "../ModeSwitch.tsx";
import { FloatingCard } from "../FloatingCard.tsx";
import { SURFACE_INSET } from "../theme.ts";
import { AppMode, isWideTool, rightRailTools } from "../../domain/appMode.ts";

interface RightMenuProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
  mapViewOptions: MapViewOptions;
  setMapViewOptions: (mapViewOptions: MapViewOptions) => void;
  data: VehicleUpdate[];
}

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
  const [prevMode, setPrevMode] = useState(mode);

  // Switching modes can remove the tool whose panel is open — leaving a
  // situations panel on screen in vehicles mode with no button to close it.
  // `layers` and `filtering` exist in both modes, so a tool common to both
  // should stay open across the switch. Adjusted here, during render, rather
  // than in an effect: that avoids both the one-frame flicker of the stale
  // panel before an effect fires and a react-hooks/set-state-in-effect
  // lint error.
  if (mode !== prevMode) {
    setPrevMode(mode);
    if (
      activeContent !== null &&
      !rightRailTools(mode).includes(activeContent)
    ) {
      setActiveContent(null);
    }
  }

  const panelWidth =
    activeContent !== null && isWideTool(activeContent) ? 460 : 300;

  // One flex cluster: the mode pill on top, then the tool panel beside the
  // toolbar. Nothing is positioned by hand, so nothing has to move in step.
  // Pointer events are off on the layout boxes and back on in each card, so
  // the map stays draggable in the gaps.
  return (
    <Box
      sx={{
        position: "absolute",
        top: SURFACE_INSET,
        right: SURFACE_INSET,
        bottom: SURFACE_INSET,
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1,
        pointerEvents: "none",
      }}
    >
      <ModeSwitch mode={mode} setMode={setMode} />
      <Box
        sx={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          pointerEvents: "none",
        }}
      >
        {activeContent && (
          <FloatingCard
            role="region"
            aria-label={TOOL_LABELS[activeContent]}
            sx={{
              width: `min(${panelWidth}px, calc(100vw - 96px))`,
              maxHeight: "100%",
              overflowY: "auto",
              padding: 2,
              boxSizing: "border-box",
            }}
          >
            <DrawerContent
              mode={mode}
              activeContent={activeContent}
              currentFilter={currentFilter}
              setCurrentFilter={setCurrentFilter}
              mapViewOptions={mapViewOptions}
              setMapViewOptions={setMapViewOptions}
              data={data}
            />
          </FloatingCard>
        )}
        <RightMenuButtons
          mode={mode}
          activeContent={activeContent}
          setActiveContent={setActiveContent}
        />
      </Box>
    </Box>
  );
};
```

- [ ] **Step 10: Render Statistics — `src/components/RightMenu/DrawerContent.tsx`**

Add the import:

```tsx
import { InfoBox } from "../InfoBox.tsx";
```

Add `data,` to the destructured props (after `setMapViewOptions,`), and add this line after the `stoplight` line:

```tsx
{
  activeContent === "statistics" && currentFilter && <InfoBox data={data} />;
}
```

- [ ] **Step 11: Simplify `src/components/ModeSwitch.tsx`**

Remove the `drawerOpen` and `wide` props from `Props` and from the function signature, and remove the `className` from `FloatingCard`. The result:

```tsx
type Props = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

/**
 * Always visible, because mode governs which subscription is open. Putting it
 * inside a drawer — which is closed by default — would leave the app with no
 * on-screen indication of which feed is running.
 */
export function ModeSwitch({ mode, setMode }: Props) {
  return (
    <FloatingCard
      sx={{ display: "flex", alignItems: "center", gap: 0.5, padding: 0.5 }}
    >
```

(the rest of the body is unchanged).

- [ ] **Step 12: Remove the left rail**

In `src/components/MapView.tsx`, delete the line `import { LeftMenu } from "./LeftMenu";` and the whole `<LeftMenu … />` element (from `<LeftMenu` to its closing `/>`, eight props).

Then:

```bash
git rm -r src/components/LeftMenu
```

- [ ] **Step 13: Remove the dead CSS — `src/index.css`**

Delete these rules entirely: `.right-menu-container`, `.right-menu-container.open`, the `.right-menu-container.open.wide` rule and the comment above it, `.sidebar-button.right`, `.sidebar-button.right.open`, `.sidebar-button.right.open.wide`, both copies of `.sidebar-button.active` and `.sidebar-button:hover`, `.left-menu-container`, `.left-menu-container.open`, `.sidebar-button.left`, `.sidebar-button.left.open`, `.mode-switch`, `.mode-switch.open`, `.mode-switch.open.wide`.

Verify: `grep -nE "right-menu|left-menu|sidebar-button|mode-switch" src/index.css src -r`
Expected: no output.

- [ ] **Step 14: Drop the inner Card wrappers**

The panel is already a card, so a `Card` inside it draws a card in a card. In each of `InfoBox.tsx`, `Legend.tsx`, `FilterBox.tsx`, `MapLayers.tsx`:

- replace `<Card>` and `<CardContent>` with `<Box>` and `</CardContent>` / `</Card>` with `</Box>` — i.e. one `<Box>` wrapper: delete the `<CardContent>` open and close lines, and turn `<Card>`/`</Card>` into `<Box>`/`</Box>`;
- remove `Card` and `CardContent` from the `@mui/material` import and add `Box` if it is not imported yet.

In `DataChecker/DataChecker.tsx` do the same (it also holds `<DataDialog>` inside the wrapper — keep that inside the `<Box>`).

Verify: `grep -rn "Card" src/components --include=*.tsx | grep -v FloatingCard`
Expected: no output.

- [ ] **Step 15: Let the panel own padding and scrolling — `SituationsPanel.tsx`**

In the outer `<Box sx={{ … }}>` of `SituationsPanel`, delete `padding: 2,`, `overflowY: "auto",`, the long comment about `.right-menu-container`, and `maxHeight: "calc(100vh - 40px)",`. If the `sx` object is then empty, remove the `sx` prop.

- [ ] **Step 16: Run the Playwright tests**

Run: `npx playwright test --project=chromium`
Expected: PASS, including "statistics is a vehicles-mode tool" and the existing "switching to situations mode swaps the tool rail". The "selecting a vehicle" test still uses `.MuiDrawer-paper` and still passes (Task 3 changes it).

- [ ] **Step 17: Look at it**

Run `npm run dev`, open http://localhost:5173. Check: the pill sits top-right with the toolbar below it; opening Filter puts the panel left of the toolbar, top-aligned; Feed report (situations mode) opens 460px wide; a long panel scrolls inside itself and stops 12px above the bottom; the map drags in the gap between the pill and the toolbar.

- [ ] **Step 18: Run the gates and commit**

Run: `npm test && npm run check && npm run build`

Then run `npm run lint 2>&1 | tail -1` separately (it exits non-zero on master): the problem totals must not exceed the baseline in Global Constraints.
Expected: all pass.

```bash
git add src/components/RightMenu src/domain/appMode.ts src/domain/appMode.test.ts src/components/ModeSwitch.tsx src/components/MapView.tsx src/index.css src/components/InfoBox.tsx src/components/Legend.tsx src/components/FilterBox.tsx src/components/MapLayers.tsx src/components/DataChecker/DataChecker.tsx src/components/SituationsPanel/SituationsPanel.tsx tests/smoketests.spec.ts
git commit -m "Float the mode pill, toolbar and tool panel, and move Statistics into the toolbar"
```

(`git rm -r src/components/LeftMenu` already staged the deletion.)

---

### Task 3: Detail panels as floating cards

**Files:**

- Modify: `src/components/detailDrawer.ts` (full rewrite)
- Modify: `src/components/SelectedVehiclePanel/SelectedVehiclePanel.tsx`
- Modify: `src/components/SituationsPanel/SituationDetailPanel.tsx`
- Modify: `src/index.css` (control stack inset)
- Test: `tests/smoketests.spec.ts` (selected-vehicle test)

**Interfaces:**

- Consumes: `FloatingCard`, `SURFACE_INSET` (Task 1).
- Produces: `DETAIL_PANEL_SX` in `detailDrawer.ts`; regions named "Selected vehicle" and "Selected situation".

- [ ] **Step 1: Update the smoke test first**

In `tests/smoketests.spec.ts`, in "selecting a vehicle shows the timetable panel", replace

```ts
// If a vehicle was selected, the drawer (MUI's persistent Drawer renders a
// `.MuiDrawer-paper` element) becomes visible.
const drawer = page.locator(".MuiDrawer-paper");
await expect(drawer).toBeVisible({ timeout: 5000 });
```

with

```ts
// If a vehicle was selected, its detail panel appears.
const panel = page.getByRole("region", { name: "Selected vehicle" });
await expect(panel).toBeVisible({ timeout: 5000 });
```

and in the following assertion replace `drawer.locator(` with `panel.locator(` and the word "drawer" in its comment with "panel".

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test --project=chromium -g "selecting a vehicle"`
Expected: FAIL (no region named "Selected vehicle") — or SKIP if no vehicle was under the map centre; if it skips, move on, it is re-run at the end of the task and in Task 6.

- [ ] **Step 3: Rewrite `src/components/detailDrawer.ts`**

```ts
import { SxProps, Theme } from "@mui/material/styles";
import { SURFACE_INSET } from "./theme.ts";

/** MapLibre's control buttons are 29px wide (maplibre-gl.css). */
const MAP_CONTROL_WIDTH = 29;

/**
 * Geometry shared by the two left-hand detail panels — the selected vehicle's
 * and the selected situation's. One definition so the two cannot drift into
 * looking like different kinds of surface.
 *
 * A card beside MapLibre's top-left control stack: the stack's inset (see the
 * `.maplibregl-ctrl-top-left` rule in index.css), its button width, and the
 * same inset again. Nothing sits above it, so it runs the full height.
 */
export const DETAIL_PANEL_SX = {
  position: "absolute",
  top: SURFACE_INSET,
  bottom: SURFACE_INSET,
  left: SURFACE_INSET + MAP_CONTROL_WIDTH + SURFACE_INSET,
  width: "min(340px, calc(100vw - 80px))",
  zIndex: 2,
  padding: 2,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
} as const satisfies SxProps<Theme>;
```

- [ ] **Step 4: Inset the control stack — `src/index.css`**

Append:

```css
/* The top-left control stack sits at the same inset as every other floating
   surface. DETAIL_PANEL_SX (src/components/detailDrawer.ts) is placed beside
   it from this value — change both. */
.maplibregl-map .maplibregl-ctrl-top-left .maplibregl-ctrl {
  margin: 12px 0 0 12px;
}
```

- [ ] **Step 5: Convert `SelectedVehiclePanel.tsx`**

Imports: replace

```tsx
import { Box, Drawer, IconButton, Typography } from "@mui/material";
```

with

```tsx
import { Alert, Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
```

and replace

```tsx
import {
  DETAIL_DRAWER_TOP_OFFSET,
  DETAIL_DRAWER_WIDTH,
} from "../detailDrawer.ts";
```

with

```tsx
import { DETAIL_PANEL_SX } from "../detailDrawer.ts";
import { FloatingCard } from "../FloatingCard.tsx";
```

Delete the two lines `const DRAWER_WIDTH = DETAIL_DRAWER_WIDTH;` and `const DRAWER_TOP_OFFSET = DETAIL_DRAWER_TOP_OFFSET;`.

Directly above `return (` (after `headerTitle` is computed — all hooks are above this point), add:

```tsx
if (!open) return null;
```

Replace the opening `<Drawer … >` element (from `<Drawer` through the `>` that closes its props, i.e. the whole `slotProps` block) with:

```tsx
    <FloatingCard
      role="region"
      aria-label="Selected vehicle"
      sx={DETAIL_PANEL_SX}
    >
```

and the closing `</Drawer>` with `</FloatingCard>`.

Replace the close button's child

```tsx
<Box component="span" sx={{ fontSize: 20, lineHeight: 1 }}>
  ×
</Box>
```

with

```tsx
<CloseIcon fontSize="small" />
```

Replace the whole `{tripCancelled && ( <Box …>Trip cancelled</Box> )}` block with:

```tsx
{
  tripCancelled && (
    <Alert severity="error" sx={{ marginTop: 1, paddingY: 0 }}>
      Trip cancelled
    </Alert>
  );
}
```

- [ ] **Step 6: Convert `SituationDetailPanel.tsx`**

Replace the imports

```tsx
import { Box, Drawer } from "@mui/material";
```

and the `detailDrawer.ts` import with

```tsx
import { Box } from "@mui/material";
import { DETAIL_PANEL_SX } from "../detailDrawer.ts";
import { FloatingCard } from "../FloatingCard.tsx";
```

In the doc comment, replace "in its own left-hand drawer" with "in its own left-hand panel" and "this drawer closes" with "this panel closes".

Replace everything from `return (` to the end of the function with:

```tsx
  if (situation === null) return null;

  return (
    <FloatingCard
      role="region"
      aria-label="Selected situation"
      sx={DETAIL_PANEL_SX}
    >
      {/* `minHeight: 0` so the flex child may shrink below its content and
          actually scroll — a situation with many affects groups is far taller
          than the panel. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <SituationDetail
          situation={situation}
          flags={flagsBySituation.get(situation.situationNumber) ?? []}
          onClose={() => setSelected(null)}
        />
      </Box>
    </FloatingCard>
  );
}
```

- [ ] **Step 7: Check nothing else used the old names**

Run: `grep -rn "DETAIL_DRAWER\|MuiDrawer" src tests`
Expected: no output.

- [ ] **Step 8: Run the tests and look at it**

Run: `npx playwright test --project=chromium`
Expected: PASS (the vehicle test may skip if nothing is under the centre).

Run `npm run dev`. Select a vehicle: the panel appears beside the control stack, full height with 12px top and bottom, and the timetable scrolls inside it. In 3D the rotate buttons do not overlap the panel. In situations mode select a situation: same geometry. Close buttons work.

- [ ] **Step 9: Run the gates and commit**

Run: `npm test && npm run check && npm run build`

Then run `npm run lint 2>&1 | tail -1` separately (it exits non-zero on master): the problem totals must not exceed the baseline in Global Constraints.

```bash
git add src/components/detailDrawer.ts src/components/SelectedVehiclePanel/SelectedVehiclePanel.tsx src/components/SituationsPanel/SituationDetailPanel.tsx src/index.css tests/smoketests.spec.ts
git commit -m "Show vehicle and situation details as floating cards beside the map controls"
```

---

### Task 4: MapLibre surfaces, popup actions and remaining chrome icons

**Files:**

- Modify: `src/index.css` (MapLibre controls, popups, chase HUD; remove round-button rules)
- Create: `src/components/Vehicle/popupAction.ts`
- Modify: `src/components/Vehicle/FollowButton.tsx`, `ChaseButton.tsx`, `DetailsButton.tsx` (full rewrites)
- Modify: `src/components/Vehicle/VehicleInfo.tsx` (line badge)
- Modify: `src/components/Vehicle/VehicleDetailsDialog.tsx` (JSON toggle, `<pre>` background)
- Modify: `src/components/MaxDataAgeFilter.tsx`
- Modify: `src/components/DataChecker/DataInfo.tsx`
- Delete: unreferenced images in `src/static/images/` (top level only)

**Interfaces:**

- Consumes: `--floating-shadow`, `--mui-palette-*` variables (Task 1).
- Produces: `POPUP_ACTION_SX` in `popupAction.ts`.

This task changes appearance only; the checks are the build, the smoke tests (which find nothing by these buttons' names) and a visual pass in both schemes.

- [ ] **Step 1: MapLibre and HUD CSS — `src/index.css`**

Delete these rules: `.round-icon-button`, `.round-icon-button:hover`, `.icon`, `.icon-small`, `.round-icon-button-small`.

Change `.vehicle-popup-actions` to:

```css
.vehicle-popup-actions {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 4px;
  width: 100%;
}
```

Replace `.view-dimension-button` and `.rotate-button` colour `#333` with `var(--mui-palette-text-primary)` in both rules.

Replace the `.chase-hud` properties `background: #fff;`, `border: 1px solid #000;` and `box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);` with:

```css
background: var(--mui-palette-background-paper);
color: var(--mui-palette-text-primary);
box-shadow: var(--floating-shadow);
```

Replace `.chase-hud-stop` and `.chase-hud-stop:hover` with:

```css
.chase-hud-stop {
  padding: 6px 14px;
  border: 1px solid var(--mui-palette-divider);
  border-radius: 16px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.chase-hud-stop:hover {
  background: var(--mui-palette-action-hover);
}
```

Append the MapLibre overrides. `.maplibregl-map` is prefixed on each selector because `maplibre-gl.css` is imported later in the bundle than `index.css`, so equal specificity would lose:

```css
/* MapLibre's control stack and popups, drawn like the app's own cards. */
.maplibregl-map .maplibregl-ctrl-group {
  background: var(--mui-palette-background-paper);
  border-radius: 10px;
}

.maplibregl-map .maplibregl-ctrl-group:not(:empty) {
  box-shadow: var(--floating-shadow);
}

.maplibregl-map .maplibregl-ctrl-group button + button {
  border-top-color: var(--mui-palette-divider);
}

.maplibregl-map .maplibregl-ctrl-group button:first-child {
  border-radius: 10px 10px 0 0;
}

.maplibregl-map .maplibregl-ctrl-group button:last-child {
  border-radius: 0 0 10px 10px;
}

.maplibregl-map .maplibregl-ctrl-group button:only-child {
  border-radius: 10px;
}

.maplibregl-map .maplibregl-ctrl button:not(:disabled):hover {
  background-color: var(--mui-palette-action-hover);
}

/* The zoom, compass and geolocate glyphs are dark background SVGs. */
[data-mui-color-scheme="dark"] .maplibregl-map .maplibregl-ctrl-icon {
  filter: invert(1);
}

.maplibregl-map .maplibregl-popup-content {
  background: var(--mui-palette-background-paper);
  color: var(--mui-palette-text-primary);
  border-radius: 10px;
  box-shadow: var(--floating-shadow);
  padding: 12px 16px;
}

.maplibregl-map .maplibregl-popup-close-button {
  color: var(--mui-palette-text-secondary);
}

.maplibregl-map .maplibregl-popup-anchor-top .maplibregl-popup-tip,
.maplibregl-map .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
.maplibregl-map .maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
  border-bottom-color: var(--mui-palette-background-paper);
}

.maplibregl-map .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
.maplibregl-map .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
.maplibregl-map .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
  border-top-color: var(--mui-palette-background-paper);
}

.maplibregl-map .maplibregl-popup-anchor-left .maplibregl-popup-tip {
  border-right-color: var(--mui-palette-background-paper);
}

.maplibregl-map .maplibregl-popup-anchor-right .maplibregl-popup-tip {
  border-left-color: var(--mui-palette-background-paper);
}
```

- [ ] **Step 2: Create `src/components/Vehicle/popupAction.ts`**

```ts
/** The vehicle popup's action buttons: one size, one shape. */
export const POPUP_ACTION_SX = {
  width: 36,
  height: 36,
  borderRadius: "6px",
  color: "text.primary",
} as const;
```

- [ ] **Step 3: Rewrite the three popup buttons**

`src/components/Vehicle/FollowButton.tsx`:

```tsx
import { IconButton, Tooltip } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationDisabledIcon from "@mui/icons-material/LocationDisabled";
import { POPUP_ACTION_SX } from "./popupAction.ts";

type FollowButtonProps = {
  isFollowing: boolean;
  onClick: () => void;
};

export function FollowButton({ isFollowing, onClick }: FollowButtonProps) {
  const label = isFollowing ? "Stop Following" : "Follow";
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick} sx={POPUP_ACTION_SX}>
        {isFollowing ? (
          <LocationDisabledIcon fontSize="small" />
        ) : (
          <MyLocationIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
```

`src/components/Vehicle/ChaseButton.tsx`:

```tsx
import { IconButton, Tooltip } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import { POPUP_ACTION_SX } from "./popupAction.ts";

type ChaseButtonProps = {
  onClick: () => void;
};

/** Starts the chase camera; it is stopped from the chase camera's own bar. */
export function ChaseButton({ onClick }: ChaseButtonProps) {
  return (
    <Tooltip title="Chase camera">
      <IconButton
        aria-label="Chase camera"
        onClick={onClick}
        sx={POPUP_ACTION_SX}
      >
        <VideocamIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
```

`src/components/Vehicle/DetailsButton.tsx`:

```tsx
import { IconButton, Tooltip } from "@mui/material";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { useState } from "react";
import { VehicleDetailsDialog } from "./VehicleDetailsDialog.tsx";
import { VehicleUpdateComplete } from "../../types.ts";
import { POPUP_ACTION_SX } from "./popupAction.ts";

type DetailsButtonProps = {
  vehicleData: VehicleUpdateComplete | null;
};

export function DetailsButton({ vehicleData }: DetailsButtonProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!vehicleData) {
    return null;
  }
  return (
    <>
      <Tooltip title="Show details">
        <IconButton
          aria-label="Show details"
          onClick={() => setDetailsOpen(true)}
          sx={POPUP_ACTION_SX}
        >
          <ListAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <VehicleDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        vehicleData={vehicleData}
      />
    </>
  );
}
```

- [ ] **Step 4: Line badge — `src/components/Vehicle/VehicleInfo.tsx`**

Replace the whole `{vehicleData.line.publicCode && ( … )}` block (outer 58px ring plus inner 46px circle) with:

```tsx
{
  vehicleData.line.publicCode && (
    <Box
      sx={{
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 46,
        height: 46,
        bgcolor: "selection.main",
        color: "background.paper",
        fontSize: "1rem",
        fontWeight: 700,
      }}
    >
      {vehicleData.line.publicCode}
    </Box>
  );
}
```

- [ ] **Step 5: `src/components/Vehicle/VehicleDetailsDialog.tsx`**

Remove the imports of `detailsIcon` and `jsonIcon` (keep `redlightIcon`/`greenlightIcon` — status lights are out of scope). Add:

```tsx
import { IconButton } from "@mui/material";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DataObjectIcon from "@mui/icons-material/DataObject";
```

(If `@mui/material` is already imported as a multi-name import, add `IconButton` to it instead.)

Replace the JSON toggle button

```tsx
<button className="round-icon-button" onClick={toggleJson}>
  <img
    src={showJson ? detailsIcon : jsonIcon}
    alt={showJson ? "View details" : "View JSON"}
    className="icon"
  />
</button>
```

with

```tsx
<IconButton
  aria-label={showJson ? "View details" : "View JSON"}
  onClick={toggleJson}
  sx={{ borderRadius: "6px" }}
>
  {showJson ? (
    <ListAltIcon fontSize="small" />
  ) : (
    <DataObjectIcon fontSize="small" />
  )}
</IconButton>
```

In the JSON `<pre>` box, replace `backgroundColor: "#f5f5f5",` with `bgcolor: "action.hover",`.

- [ ] **Step 6: `src/components/MaxDataAgeFilter.tsx`**

Replace `import clearIcon from "../static/images/clear.png";` with `import ClearIcon from "@mui/icons-material/Clear";` and add `IconButton` to the `@mui/material` import. Replace the `<button className="round-icon-button round-icon-button-small" …>…</button>` element with:

```tsx
<IconButton size="small" aria-label="Clear" onClick={handleClear}>
  <ClearIcon fontSize="small" />
</IconButton>
```

- [ ] **Step 7: `src/components/DataChecker/DataInfo.tsx`**

Replace `import infoIcon from "../../static/images/info.png";` with:

```tsx
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Tooltip from "@mui/material/Tooltip";
```

Replace

```tsx
<IconButton onClick={handleInfoOpen} size="small">
  <img
    src={infoIcon}
    alt="How is this calculated"
    title="How is this calculated"
    style={{ width: "24px", height: "24px" }}
  />
</IconButton>
```

with

```tsx
<Tooltip title="How is this calculated">
  <IconButton
    onClick={handleInfoOpen}
    size="small"
    aria-label="How is this calculated"
  >
    <InfoOutlinedIcon fontSize="small" />
  </IconButton>
</Tooltip>
```

- [ ] **Step 8: Confirm no class or image reference is left dangling**

Run: `grep -rnE "round-icon-button|className=\"icon" src`
Expected: no output.

- [ ] **Step 9: Delete images nothing imports any more**

Top level of `src/static/images/` only — `vehicles/` belongs to the base map PR.

```bash
cd src/static/images && for f in *.png *.svg; do grep -rq "images/$f" ../.. || git rm -q "$f"; done; cd -
git status --short src/static/images
```

Expected deletions include at least `chase.svg`, `clear.png`, `details.png`, `filter.png`, `follow.png`, `info.png`, `json.png`, `layers.png`, `statistics.png`, `stopFollow.png`, `stoplight.png`, plus images that were already unused (e.g. `filterOld.png`, `eye.png`, `metro.png`). Must **not** include `orangeMarker.png`, `bus.png`, `redLight.png`, `occupancy*.png` or anything under `vehicles/`.

- [ ] **Step 10: Run the gates and look at it in both schemes**

Run: `npm test && npm run check && npm run build && npx playwright test --project=chromium`

Then run `npm run lint 2>&1 | tail -1` separately (it exits non-zero on master): the problem totals must not exceed the baseline in Global Constraints.
Expected: all pass.

Run `npm run dev`. In light and in dark: the control stack is a rounded card with visible glyphs (zoom, compass, geolocate, 2D/3D, and in 3D the rotate buttons); a vehicle popup has a themed background, a tip in the same colour and three icon buttons with tooltips; Follow toggles its icon; Details opens the dialog and the JSON toggle works; the chase HUD is themed; the Filter tool's max data age clear button works; the Data report info button opens its dialog.

- [ ] **Step 11: Commit**

```bash
git add src/index.css src/components/Vehicle/popupAction.ts src/components/Vehicle/FollowButton.tsx src/components/Vehicle/ChaseButton.tsx src/components/Vehicle/DetailsButton.tsx src/components/Vehicle/VehicleInfo.tsx src/components/Vehicle/VehicleDetailsDialog.tsx src/components/MaxDataAgeFilter.tsx src/components/DataChecker/DataInfo.tsx
git commit -m "Theme MapLibre controls, popups and the chase HUD, and use MUI icons for actions"
```

(The image deletions were staged by `git rm`.)

---

### Task 5: Panel internals on theme tokens

**Files:**

- Modify: `src/components/SituationsPanel/SituationFilters.tsx`
- Modify: `src/components/SelectedVehiclePanel/StopRow.tsx`, `SituationList.tsx`
- Modify: `src/components/SituationsPanel/SituationRow.tsx`, `SituationPopup.tsx`, `UnmappableList.tsx`, `SituationsPanel.tsx`, `SituationDetail.tsx`, `SituationStatsTables.tsx`
- Modify: `src/components/CodespaceSelector.tsx`, `src/components/DataChecker/DataResults.tsx`

**Interfaces:**

- Consumes: palette tokens and `--mui-palette-*` variables (Task 1).

**The substitution rule.** In an `sx` `color`, `bgcolor` or `borderColor`, use the palette path string (`"text.secondary"`). Anywhere else — `background`, border shorthands, `boxShadow`, a plain `style` prop, or a `React.CSSProperties` object — use the CSS variable (`"var(--mui-palette-text-secondary)"`).

| Old                                             | Token            | CSS variable                   |
| ----------------------------------------------- | ---------------- | ------------------------------ |
| `#666`, `#777`                                  | `text.secondary` | `--mui-palette-text-secondary` |
| `#999`, `#aaa`, `#888`, `#8a8a8a`, `#bababa`    | `text.disabled`  | `--mui-palette-text-disabled`  |
| `#4a4a4a`                                       | `text.secondary` | `--mui-palette-text-secondary` |
| `#000` (dot border), `#333`, `#2980b9` (link)   | `text.primary`   | `--mui-palette-text-primary`   |
| `#ddd`, `#eee`, `#e4e4e4`, `#d0d0d0`, `#d8d8d8` | `divider`        | `--mui-palette-divider`        |
| `#f7f5f2`, `#f5f5f5`                            | `action.hover`   | `--mui-palette-action-hover`   |
| `#eef7f7` (selected row)                        | `selection.bg`   | `--mui-palette-selection-bg`   |
| `#1fcac2` (current stop)                        | `selection.main` | `--mui-palette-selection-main` |

**Never replace:** `#c0392b`, `#7a1f1f`, `#1f8a3a`, `#e6a700`, `#e07a1f` (data colours), or anything returned by `severityColour`/`delayColour`.

- [ ] **Step 1: Rewrite the chips in `SituationFilters.tsx`**

Change the `@mui/material` import to `import { Box, Chip, Typography } from "@mui/material";`. Replace the doc comment and the whole `FacetChip` function with:

```tsx
/** Chips are far denser than checkbox rows in a narrow panel. */
function FacetChip({
  label,
  count,
  selected,
  warning,
  dotColour,
  onToggle,
}: {
  label: string;
  count: number;
  selected: boolean;
  warning?: boolean;
  dotColour?: string;
  onToggle: () => void;
}) {
  return (
    <Chip
      size="small"
      clickable
      onClick={onToggle}
      aria-pressed={selected}
      variant={selected ? "filled" : "outlined"}
      color={warning ? "error" : selected ? "primary" : "default"}
      icon={
        dotColour ? (
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: dotColour,
              // The dot would clash with a filled chip without a ring.
              outline: selected
                ? "1px solid var(--mui-palette-background-paper)"
                : "none",
              flexShrink: 0,
            }}
          />
        ) : undefined
      }
      label={
        <>
          {label}{" "}
          <Box
            component="span"
            sx={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}
          >
            {count}
          </Box>
        </>
      }
      sx={{
        fontSize: 11,
        height: 22,
        // A zero-count facet value is kept rather than hidden — it is a
        // regression detector — but it should not read as live data.
        opacity: count === 0 && !selected ? 0.45 : 1,
        "& .MuiChip-icon": { marginLeft: "6px", marginRight: "-2px" },
      }}
    />
  );
}
```

In `Facet`, replace the title's `color: "#888",` with `color: "text.disabled",`, and in the per-facet clear button replace `color: "#1976d2",` with `color: "text.secondary", textDecoration: "underline",`.

In `SituationFilters`, replace the wrapper's

```tsx
        background: "#fff",
        border: "1px solid #e4e4e4",
```

with

```tsx
        border: "1px solid",
        borderColor: "divider",
```

and in the "clear all" button replace `color: "#1976d2",` with `color: "text.secondary", textDecoration: "underline",`.

- [ ] **Step 2: `StopRow.tsx`**

In `dotStyle` (a `React.CSSProperties`, so CSS variables):

```tsx
    background: isCurrent
      ? "var(--mui-palette-selection-main)"
      : isPast
        ? "var(--mui-palette-text-disabled)"
        : "var(--mui-palette-text-secondary)",
    border: isCurrent ? "2px solid var(--mui-palette-text-primary)" : "none",
```

and in the cancelled branch:

```tsx
dotStyle.border = `2px solid ${
  isPast
    ? "var(--mui-palette-text-disabled)"
    : "var(--mui-palette-text-secondary)"
}`;
```

Replace `sx={{ borderBottom: "1px dotted #eee" }}` with `sx={{ borderBottom: "1px dotted var(--mui-palette-divider)", fontVariantNumeric: "tabular-nums" }}`. Replace `background: "#d0d0d0",` with `background: "var(--mui-palette-divider)",`. Replace `color: "#999"` with `color: "text.disabled"`. Leave the occupancy table and every `#c0392b`.

- [ ] **Step 3: `SituationList.tsx`**

Replace each `color: "#999"` with `color: "text.disabled"` (three places), `background: "#f7f5f2",` with `background: "var(--mui-palette-action-hover)",`, `color: "#777"` with `color: "text.secondary"`, `sx={{ color: "#2980b9" }}` with `sx={{ color: "text.primary" }}`, and `color: "#aaa"` with `color: "text.disabled"`.

- [ ] **Step 4: Selected rows — `SituationRow.tsx`, `SituationPopup.tsx`, `UnmappableList.tsx`**

In all three, each `borderBottom: "1px dotted #eee",` becomes `borderBottom: "1px dotted var(--mui-palette-divider)",`.

Each selected-row background becomes a background plus the teal marker from the mock-up. In `SituationRow.tsx` replace `background: selected ? "#eef7f7" : "none",` with:

```tsx
        background: selected ? "var(--mui-palette-selection-bg)" : "none",
        boxShadow: selected
          ? "inset 3px 0 0 var(--mui-palette-selection-main)"
          : "none",
```

In `SituationPopup.tsx` and `UnmappableList.tsx` do the same with their conditions (`selected === situation.situationNumber` and `selected === situationNumber` respectively).

Then: `SituationRow.tsx` `color: "#666"` → `color: "text.secondary"`; its flag colour `"#c0392b" : "#666"` → `"#c0392b" : "text.secondary"`. `SituationPopup.tsx` `#666` (two) → `text.secondary`, `#999` → `text.disabled`. `UnmappableList.tsx` `#666` → `text.secondary`, `color: "#999"` → `color: "text.disabled"`, flag colour `"#c0392b" : "#999"` → `"#c0392b" : "text.disabled"`.

- [ ] **Step 5: `SituationsPanel.tsx`, `SituationDetail.tsx`, `SituationStatsTables.tsx`, `CodespaceSelector.tsx`, `DataResults.tsx`**

- `SituationsPanel.tsx`: `feed.status === "error" ? "#c0392b" : "#666"` → `feed.status === "error" ? "error.main" : "text.secondary"`; the other `color: "#666"` → `color: "text.secondary"`.
- `SituationDetail.tsx`: in `Field`, `style={{ color: "#666", minWidth: 110 }}` → `style={{ color: "var(--mui-palette-text-secondary)", minWidth: 110 }}`; every `color: "#666"` in `sx` → `color: "text.secondary"`; `color: "#999"` → `color: "text.disabled"`; `border: "1px solid #ddd",` → `border: "1px solid var(--mui-palette-divider)",`.
- `SituationStatsTables.tsx`: `#666` → `text.secondary`, `#999` → `text.disabled`; on the exported component's root `<Box sx={{ padding: 1.5 }}>` add `fontVariantNumeric: "tabular-nums"`.
- `CodespaceSelector.tsx`: `color: "#999"` → `color: "text.disabled"`.
- `DataResults.tsx`: on the root `<Box>` returned by the component, add `sx={{ fontVariantNumeric: "tabular-nums" }}`.

- [ ] **Step 6: Verify only data colours remain**

Run:

```bash
grep -rnE '"#[0-9a-fA-F]{3,6}\b' src/components --include=*.tsx
```

Expected: only lines in `StopRow.tsx` (occupancy table and `#c0392b`), `SituationRow.tsx` and `UnmappableList.tsx` (`#c0392b` flag warning). Anything else is a missed substitution.

- [ ] **Step 7: Run the gates and look at it**

Run: `npm test && npm run check && npm run build && npx playwright test --project=chromium`

Then run `npm run lint 2>&1 | tail -1` separately (it exits non-zero on master): the problem totals must not exceed the baseline in Global Constraints.
Expected: all pass.

Run `npm run dev`, in light and dark: situations Filter chips (unselected outlined, selected filled ink, warning flags red, zero counts faded, severity dots visible); situations panel rows with a selected row showing the teal marker; the unmappable list; the situation popup; the situation detail panel; the feed report tables with aligned digits; a selected vehicle's timetable (current stop dot teal, past stops faded); a vehicle with situations shows the situation list readable in dark.

- [ ] **Step 8: Commit**

```bash
git add src/components/SituationsPanel/SituationFilters.tsx src/components/SelectedVehiclePanel/StopRow.tsx src/components/SelectedVehiclePanel/SituationList.tsx src/components/SituationsPanel/SituationRow.tsx src/components/SituationsPanel/SituationPopup.tsx src/components/SituationsPanel/UnmappableList.tsx src/components/SituationsPanel/SituationsPanel.tsx src/components/SituationsPanel/SituationDetail.tsx src/components/SituationsPanel/SituationStatsTables.tsx src/components/CodespaceSelector.tsx src/components/DataChecker/DataResults.tsx
git commit -m "Move panel colours onto theme tokens and use MUI chips for situation facets"
```

---

### Task 6: CLAUDE.md and full verification

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Data flow item 7 — the surfaces**

In item 7, replace

```
the right-menu situations drawer (`SituationsPanel` — status line, then the two halves of the filtered set: an "On the map" list and `UnmappableList`), the right-menu filter drawer (`SituationFilters`, beside the codespace dropdown)
```

with

```
the situations tool panel (`SituationsPanel` — status line, then the two halves of the filtered set: an "On the map" list and `UnmappableList`), the filter tool panel (`SituationFilters`, beside the codespace dropdown)
```

and replace

```
`SituationDetailPanel`, a left-anchored drawer over the map, mirroring what `SelectedVehiclePanel` is to a selected vehicle. Both share their geometry from `src/components/detailDrawer.ts` so the two cannot drift into looking like different kinds of surface.
```

with

```
`SituationDetailPanel`, a floating card on the left of the map, mirroring what `SelectedVehiclePanel` is to a selected vehicle. Both take their geometry from `DETAIL_PANEL_SX` in `src/components/detailDrawer.ts` so the two cannot drift into looking like different kinds of surface. That geometry places the card beside MapLibre's top-left control stack using the stack's 12px inset in `index.css` and its 29px button width — change the inset in one place and the other must follow.
```

- [ ] **Step 2: Replace the two-widths invariant**

Replace the whole bullet beginning `- The right drawer has two widths.` with:

```
- The right side is one flex cluster in `RightMenu`: the mode pill, then the tool panel beside the toolbar. Nothing in it is positioned by hand, so opening, closing or widening a panel moves nothing else. `isWideTool` (`src/domain/appMode.ts`) marks the tools whose content does not fit the default 300px panel — currently only the feed report — and the panel is its only reader. Tool names live in `TOOL_LABELS` (`src/components/RightMenu/toolLabels.ts`) and double as the toolbar buttons' accessible names and the open panel's region name; the smoke tests find tools by them.
```

- [ ] **Step 3: Map / icons section**

Delete the sentence starting `The statistics button in \`LeftMenuButtons\``through`or the two overlap.`

Replace the bullet `- SVG vehicle icons are loaded via \`vite-svg-loader\` …` with:

```
- Vehicle map icons are PNGs registered as MapLibre images in `src/components/RegisterIcons.tsx`; new map symbols must be registered there. `vite-svg-loader` is configured but no map icon uses it. `vehicle-layer` only has icons for BUS, FERRY, RAIL and TRAM — its fallback name is not registered, so other modes draw no 2D icon (to be fixed with the base map change).
```

- [ ] **Step 4: Add a Theme section**

Insert before `## Map / icons`:

```
## Theme

- One MUI theme (`src/components/theme.ts`) built with CSS theme variables: `colorSchemes` light and dark, selected by `data-mui-color-scheme="light|dark"` on `<html>` via the explicit selector `'[data-mui-color-scheme="%s"]'`. Do not switch to the `"data"` shorthand — it sets a bare `data-dark` attribute that the pre-load script does not set.
- Every palette value is a `--mui-palette-*` CSS variable, so plain CSS (MapLibre controls, popups, `.chase-hud` in `index.css`) follows the scheme. In `sx`, use palette paths for `color`/`bgcolor`/`borderColor` and `var(--mui-palette-…)` everywhere else.
- The chrome is neutral slate on purpose: the only saturated colours on screen should be data. `palette.selection` (`main`, `bg`) marks what is selected — the active tool, the selected row, the current stop — and nothing else.
- The toggle (`ColorSchemeToggle`, in the mode pill) cycles system → light → dark (`nextColorSchemeMode`). MUI persists the mode under `COLOR_SCHEME_STORAGE_KEY` (`vehicle-map-color-scheme`); the inline script in `index.html` reads the same key to set the attribute before the bundle loads. Change one, change both. The preference is deliberately not a query param: `useFilterQueryParams` would merge it into the `Filter` and the subscription variables.
- Every surface over the map is a `FloatingCard` (10px radius, `var(--floating-shadow)`, elevation 0 — MUI lightens elevated Paper in dark mode). `--floating-shadow` is defined once in `index.css`, with a stronger value for dark.
- Data colours — `situationSeverity.ts`, `delayThresholds.ts`, occupancy and cancellation colours in `StopRow`, flag-warning red, all map paint — are deliberately outside the theme and not yet tuned for dark panels. They change together with the dark base map.
```

- [ ] **Step 5: Full verification**

Run: `npm test && npm run check && npm run build && npx tsc --noEmit -p tsconfig.app.json && npx playwright test --project=chromium`

Then run `npm run lint 2>&1 | tail -1` separately (it exits non-zero on master): the problem totals must not exceed the baseline in Global Constraints.
Expected: all pass. Report any skipped Playwright test by name.

Then, with `npm run dev`, walk the manual matrix — vehicles and situations mode × light and dark × 2D and 3D:

- mode pill, toolbar, each tool panel, the 460px feed report;
- vehicle popup and situation popup;
- selected vehicle panel, including a cancelled trip if one can be found;
- selected situation panel;
- chase HUD;
- control stack including the 3D rotate buttons, with no overlap with the detail panel;
- reload in dark mode shows no light flash;
- a window about 760px wide with a detail panel and a tool panel open: both stay inside the window.

Take one light and one dark screenshot per mode for the PR description, saved outside the repo (scratchpad).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the theme and floating layout in CLAUDE.md"
```
