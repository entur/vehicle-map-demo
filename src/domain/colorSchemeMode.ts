/** The three settings the theme toggle offers. `system` follows the OS. */
export type ColorSchemeMode = "system" | "light" | "dark";

const ORDER: ColorSchemeMode[] = ["system", "light", "dark"];

/** The mode one click of the toggle moves to. */
export function nextColorSchemeMode(mode: ColorSchemeMode): ColorSchemeMode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
}
