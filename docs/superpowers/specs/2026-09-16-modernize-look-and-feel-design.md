# Modernize look and feel (UI) — design

Date: 2026-09-16

## Purpose

Give the map chrome a coherent, modern visual system with a light/dark toggle, and remove the
hand-coordinated layout offsets that the current rails and drawers depend on.

The audience is internal: developers and QA reading the realtime feeds. The design therefore
favours density and legibility over decoration, and keeps the chrome visually quiet so that the
only saturated colours on screen are the data — severity, line colours and transport modes.

## Scope

This is the first of two sub-projects, each with its own PR:

1. **UI (this spec).** Theme tokens, typography, dark mode, floating-card layout, component
   restyle.
2. **Base map (later spec).** Both colour schemes move from the OSM raster to OpenFreeMap vector
   styles, the base map follows the colour scheme, data colours (severity, delay, occupancy,
   map paint) get dark variants, and the new per-mode vehicle SVG icons in
   `src/static/images/vehicles/` replace the vehicle PNGs, with every mode registered and a
   real fallback icon.

Until the second PR merges, dark mode is dark chrome over a light map. That is accepted.

### Out of scope for this PR

- Map layer paint in `mapStyle.ts`, 3D vehicle models, `SituationLayers` expressions.
- Data colours: `situationSeverity.ts`, `delayThresholds.ts`, occupancy colours in `StopRow.tsx`.
  They are shared with map layers and need checking against the dark base map, so they change
  in the base map PR. On dark panels they are knowingly under-contrasted until then.
- Images that depict what the map draws: Legend and MapLayers symbols (vehicle PNGs, update
  markers, lights, occupancy, heatmap, traces), and the red/orange/green status lights in
  `DataResults` and `VehicleDetailsDialog`.
- The vehicle SVGs in `src/static/images/vehicles/` — untracked on this branch; they are not
  committed here.
- A dedicated small-screen layout.

## Decisions

| Question          | Decision                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Visual identity   | Keep MUI; build a real theme on it. Not the Entur design system, not a dark-only console.          |
| Dark mode         | Toggle with system / light / dark, following the OS by default.                                    |
| Layout            | Refresh plus light tidying: same surfaces, floating cards, nothing slides.                         |
| Colour direction  | Neutral slate chrome; teal reserved for "selected".                                                |
| Font              | Inter (variable).                                                                                  |
| Chrome icons      | `@mui/icons-material`.                                                                             |
| Theming mechanism | MUI CSS theme variables with `colorSchemes`, `useColorScheme`, persisted by MUI to `localStorage`. |
| Theme preference  | `localStorage`, not a query param: `useFilterQueryParams` would merge `?theme=` into the `Filter`. |
| Statistics tool   | Moves from the left rail into the right toolbar; the left rail is removed.                         |

## 1. Theme foundation

### Theme

`src/components/theme.ts` builds one theme:

```ts
createTheme({
  cssVariables: { colorSchemeSelector: '[data-mui-color-scheme="%s"]' },
  colorSchemes: { light: { palette: … }, dark: { palette: … } },
  shape: { borderRadius: 6 },
  typography: { fontFamily: "'Inter Variable', system-ui, sans-serif", fontSize: 13 },
});
```

The explicit selector puts `data-mui-color-scheme="light|dark"` on `<html>`, and every palette
value is exposed as a `--mui-palette-*` CSS variable, so plain CSS in `index.css` follows the
scheme without React re-rendering. The `"data"` shorthand is deliberately not used: it sets a
bare `data-dark` / `data-light` attribute instead (`prepareCssVars.js`), which would not match
the attribute MUI's `InitColorSchemeScript` — and our pre-load script — uses.

Palette:

| Token                     | Light       | Dark        | Used for                                          |
| ------------------------- | ----------- | ----------- | ------------------------------------------------- |
| `background.paper`        | `#ffffff`   | `#23262d`   | Cards, toolbar, popups, control stack             |
| `text.primary`            | `#1f2430`   | `#e9ebef`   | Body text, icons                                  |
| `text.secondary`          | `#5b6272`   | `#a3a9b4`   | Labels, meta text (replaces `#666`, `#777`)       |
| `text.disabled`           | MUI default | MUI default | Faint text (replaces `#999`, `#aaa`, `#888`)      |
| `divider`                 | `#d9dce2`   | `#40444e`   | Rules, chip outlines (replaces `#ddd`, `#eee`, …) |
| `primary.main` (ink)      | `#1f2430`   | `#e9ebef`   | Selected mode segment, filled chips, buttons      |
| `selection.main` (custom) | `#00857c`   | `#3fd0c5`   | Selected-row marker, active tool icon             |
| `selection.bg` (custom)   | `#e6f6f5`   | `#1b3533`   | Selected row, active tool background              |

`selection` is added to the palette through TypeScript module augmentation of `Palette` and
`PaletteOptions` in `theme.ts`.

Shape and elevation: cards over the map use a 10px radius; rows, buttons and chips use 6px (the
theme default). One shared shadow for every floating surface, exported from `theme.ts` as a
constant and mirrored in `index.css` as a CSS custom property on `:root` so MapLibre surfaces
use the same one.

Removed: the secondary purple palette, the off-by-one `#1fcac2` teal outside the theme, and the
`#5d9c9b` hover colour.

### Typography

- `@fontsource-variable/inter` is added and imported once in `src/main.tsx`.
- `@fontsource/roboto` is removed from `package.json`. It was never imported, so there is no
  visual regression from removing it.
- Base font size 13px.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on count tables
  (`SituationStatsTables`, `DataResults`), stop times and delays (`StopRow`), and facet counts.
- `CssBaseline` with `enableColorScheme` is rendered inside `ThemeProvider` in `App.tsx`, so the
  page background, default font and native scrollbars follow the scheme.

### Theme toggle

- `src/domain/colorSchemeMode.ts` exports `nextColorSchemeMode(mode)`, cycling system, light,
  dark, then back to system. It is plain `.ts` so vitest collects its test.
- `ColorSchemeToggle.tsx` is an `IconButton` at the end of the mode pill. It reads and sets the
  mode through `useColorScheme()`, shows `BrightnessAuto`, `LightMode` or `DarkMode` for the
  current mode, and has a tooltip and `aria-label` of the form "Theme: system".
- `ThemeProvider` gets `modeStorageKey="vehicle-map-color-scheme"`.
- `useColorScheme().mode` is `undefined` on the first render before MUI reads storage; the
  toggle renders the `system` icon in that case rather than nothing, so the pill does not change
  width.
- `index.html` gets a small inline script in `<head>`, equivalent to MUI's
  `InitColorSchemeScript` for `attribute: "data-mui-color-scheme"` and the same storage key,
  that sets the attribute before the bundle loads. This prevents a light flash for dark-mode
  users. The script is written by hand because the app is a Vite SPA with no server rendering.

## 2. Layout

All floating surfaces sit 12px from the map edge, use the card radius and shared shadow, and
appear or disappear rather than slide. Nothing moves to make room for anything else, which
removes every hand-kept offset.

### Right side

- **Mode pill**, top-right: _Vehicles | Situations_ as a `ToggleButtonGroup`, then the theme
  toggle. `ModeSwitch` loses its `drawerOpen` and `wide` props and the `.mode-switch.open*` CSS.
  Its comment about being always visible stays true.
- **Toolbar**, directly below the pill: one vertical card of 36px `IconButton`s, one per entry of
  `rightRailTools(mode)`, in that order. The active tool uses `selection.bg` / `selection.main`.
  Each button keeps today's label as both its `aria-label` and its tooltip: "Layers", "Filter",
  "Info", "Data report", "Statistics", "Feed report", "Situations panel". The smoke tests locate
  buttons by these names.
- **Tool panel**: a card to the left of the toolbar, top-aligned with it, with
  `max-height` down to 12px above the bottom edge and internal scrolling. Width 300px, or 460px
  when `isWideTool(content)`; both capped at `calc(100vw - 96px)`.

`FIRST_BUTTON_TOP`, `BUTTON_PITCH`, and the `.right-menu-container*`, `.sidebar-button*` rules go.
`isWideTool` stays, and its doc comment is updated: the panel is now the only reader.

### Left side

- **Map controls** stay in MapLibre's top-left stack (restyled in section 3).
- **The left rail is removed.** `LeftMenu/` (`LeftMenu.tsx`, `LeftMenuButtons.tsx`,
  `DrawerContent.tsx`, `types.ts`) is deleted, together with `TOP = {2d:185, 3d:253}` and the
  `.left-menu-container*` CSS. `RightContentType` gains `"statistics"`, which renders the same
  `InfoBox` content the left drawer rendered. `RIGHT_RAIL_TOOLS.vehicles` becomes
  `["layers", "filtering", "info", "stoplight", "statistics"]`.
- **Detail panel** — the selected vehicle (`SelectedVehiclePanel`) or selected situation
  (`SituationDetailPanel`): a card to the right of the control stack, 12px from the top and
  bottom, `min(340px, 100vw - 80px)` wide, scrolling internally.

`detailDrawer.ts` remains the single definition of that geometry for both panels, now as card
position and size (`left`, `top`, `bottom`, `width`) instead of drawer width and top offset.
`DETAIL_DRAWER_TOP_OFFSET` is removed: nothing sits above the panel any more.

The two panels stop being MUI `Drawer`s and become a positioned `Paper` with
`role="region"` and an `aria-label` naming the panel ("Selected vehicle", "Selected situation").

### Narrow windows

With a detail panel and a tool panel open at once, the two cards can overlap below about 760px.
Both stay within the viewport width. No separate small-screen layout.

## 3. Component restyle

### Icons

Actions become MUI icons. Images that depict what the map draws stay.

| Where                          | Now                           | Becomes                           |
| ------------------------------ | ----------------------------- | --------------------------------- |
| Toolbar: Layers                | `layers.png`                  | `Layers`                          |
| Toolbar: Filter                | `filter.png`                  | `FilterList`                      |
| Toolbar: Info                  | `info.png`                    | `InfoOutlined`                    |
| Toolbar: Data report           | `stoplight.png`               | `FactCheck`                       |
| Toolbar: Statistics            | `statistics.png`              | `BarChart`                        |
| Toolbar: Situations panel      | `orangeMarker.png`            | `WarningAmber`                    |
| Toolbar: Feed report           | `statistics.png`              | `Assessment`                      |
| Popup: Follow / Stop following | `follow.png`/`stopFollow.png` | `MyLocation` / `LocationDisabled` |
| Popup: Details                 | `details.png`                 | `ListAlt`                         |
| Popup: Chase                   | `chase.svg`                   | `Videocam`                        |
| Details dialog: JSON           | `json.png`                    | `DataObject`                      |
| `MaxDataAgeFilter` clear       | `clear.png`                   | `Clear`                           |
| `DataInfo` info                | `info.png`                    | `InfoOutlined`                    |

Statistics and Feed report currently share `statistics.png`, with a comment in
`RightMenuButtons.tsx` justifying it by the left rail being hidden in situations mode. They now
get distinct icons, and that comment is removed along with the rail.

`@mui/icons-material` is added as a dependency, imported per icon (`@mui/icons-material/Layers`)
so only used icons are bundled. PNGs and SVGs in `src/static/images/` that nothing imports after
the change are deleted in this PR.

### Buttons

`.round-icon-button` (48px black-bordered circle) becomes an MUI `IconButton` with a tooltip. The
popup's action row is a row of 36px icon buttons. `ChaseButton`, `FollowButton` and
`DetailsButton` keep their existing accessible names.

### MapLibre surfaces

Plain CSS in `index.css`, reading `--mui-palette-*` variables:

- **Control stack** (`.maplibregl-ctrl-group`): `background.paper` background, card radius and
  shadow, `divider` between buttons, `text.primary` for the text buttons (`.view-dimension-button`,
  `.rotate-button`). MapLibre draws zoom, compass and geolocate icons as background SVGs, so in
  dark mode those icon elements (`.maplibregl-ctrl-icon`) get `filter: invert(1)`, scoped to
  `[data-mui-color-scheme="dark"]`.
- **Popups** (`.maplibregl-popup-content` and the four `.maplibregl-popup-anchor-* .maplibregl-popup-tip`
  border colours): `background.paper`, `text.primary`, card radius and shadow.
- **`.chase-hud`**: `background.paper` and `text.primary` instead of `#fff`/`#000`.

After this change `index.css` contains only MapLibre overrides, `.chase-hud`, the shared shadow
custom property, and the popup content layout.

### Panel internals

- Hardcoded greys in `sx` props move to tokens: `#666`/`#777` → `text.secondary`;
  `#999`/`#aaa`/`#888`/`#8a8a8a` → `text.disabled`; `#ddd`/`#eee`/`#e4e4e4`/`#d0d0d0`/`#d8d8d8`
  → `divider`; `#f5f5f5`/`#f7f5f2` → `action.hover`; the selected-row `#eef7f7` and marker
  `#1fcac2` → `selection.bg` / `selection.main`. Files: `StopRow`, `SituationList`,
  `SituationDetail`, `SituationRow`, `SituationPopup`, `UnmappableList`, `SituationsPanel`,
  `SituationStatsTables`, `CodespaceSelector`, `VehicleDetailsDialog`, `VehicleInfo`.
- `SituationsPanel`'s error text `#c0392b` → `error.main`. The flag-warning red in `SituationRow`
  and `UnmappableList` is a data colour and stays.
- `SituationFilters`' hand-built chips become MUI `Chip`s: unselected is `variant="outlined"`,
  selected is `variant="filled" color="primary"` (ink). Chip order and counts are unchanged; the
  `#1976d2` default blue goes.
- The cancelled-trip banner in `SelectedVehiclePanel` becomes `<Alert severity="error">`.
- The line badge in `VehicleInfo` (teal `#1fcac2` with black border) uses `selection.main` with
  no border.
- `FilterBox`, `Legend` and `DataChecker` drop their outer `Card`, because the panel is already
  a card. `InfoBox` likewise.

## 4. Testing and documentation

### Unit tests (vitest)

- `colorSchemeMode.test.ts`: the cycle, and that it returns to `system`.
- `appMode.test.ts`: update the existing `rightRailTools` expectations for `"statistics"` in
  vehicles mode and not in situations mode; `isWideTool` still marks only `situationStats`.

### Playwright smoke tests

- Replace the `.MuiDrawer-paper` selector with `getByRole("region", { name: … })`.
- New: clicking the theme toggle to dark sets `data-mui-color-scheme="dark"` on `<html>`, and
  it is still dark after `page.reload()` (covers persistence and the pre-load script).
- New: a "Statistics" button is present in vehicles mode and absent in situations mode.

### Manual verification

Run the app and check, in both modes × light/dark × 2D/3D:

- the mode pill, toolbar, tool panels, the wide feed report;
- vehicle and situation popups;
- the vehicle detail panel, including a cancelled trip;
- the situation detail panel;
- the chase HUD;
- the control stack, including the 3D rotate buttons;
- no light flash on reload in dark mode.

Screenshots of light and dark go into the PR description.

### Gates

`npm test`, `npm run check`, `npm run build`, `npx tsc --noEmit -p tsconfig.app.json`,
`npx playwright test`.

### CLAUDE.md

- Replace the "right drawer has two widths" invariant: one card reads `isWideTool`; no rules
  must change together.
- Remove the statistics-button `TOP` note from the Map / icons section, and the left rail.
- Update the `detailDrawer.ts` description (card geometry, both panels are `Paper` regions).
- Correct the claim that vehicle icons load through `vite-svg-loader`: they are PNGs registered
  in `RegisterIcons.tsx`.
- Add a short "Theme" section: CSS-variable colour schemes selected by
  `data-mui-color-scheme`, the `selection.*` tokens and what they are for, the
  `vehicle-map-color-scheme` storage key and the matching pre-load script in `index.html`
  (change one, change both), and that data colours are deliberately outside the theme until the
  base map PR.
