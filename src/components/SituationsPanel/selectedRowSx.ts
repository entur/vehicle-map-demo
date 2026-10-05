/**
 * How a selected situation is marked wherever it is listed — the panel's two
 * lists and the map popup — so the three cannot drift apart.
 */
export function selectedRowSx(selected: boolean) {
  return {
    background: selected ? "var(--mui-palette-selection-bg)" : "none",
    boxShadow: selected
      ? "inset 3px 0 0 var(--mui-palette-selection-main)"
      : "none",
  };
}
