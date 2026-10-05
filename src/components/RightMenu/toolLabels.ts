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
