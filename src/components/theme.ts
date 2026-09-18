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
