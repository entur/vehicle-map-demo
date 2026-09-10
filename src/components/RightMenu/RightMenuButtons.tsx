import filterIcon from "../../static/images/filter.png";
import infoIcon from "../../static/images/info.png";
import layersIcon from "../../static/images/layers.png";
import orangeMarkerIcon from "../../static/images/orangeMarker.png";
import statisticsIcon from "../../static/images/statistics.png";
import stoplightIcon from "../../static/images/stoplight.png";
import { AppMode, rightRailTools } from "../../domain/appMode.ts";
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
  // Shares the icon with the vehicles-mode left-rail Statistics button. They
  // never appear together — that rail is hidden in situations mode — and the
  // shared icon reads correctly: both are aggregate readouts over a feed.
  situationStats: {
    content: "situationStats",
    icon: statisticsIcon,
    label: "Feed report",
  },
  situations: {
    content: "situations",
    icon: orangeMarkerIcon,
    // Deliberately not "Situations": that is the mode toggle's label, and the
    // label drives both `alt` and `title`, so reusing it would give two
    // controls the same accessible name.
    label: "Situations panel",
  },
};

/** Below the mode switch, then one button pitch apart. */
const FIRST_BUTTON_TOP = 75;
const BUTTON_PITCH = 55;

type RightMenuButtonsProps = {
  mode: AppMode;
  activeContent: RightContentType | null;
  setActiveContent: (contentType: RightContentType | null) => void;
  /** The open drawer is a wide one, so the buttons shift further left. */
  wide: boolean;
};

export const RightMenuButtons = ({
  mode,
  activeContent,
  setActiveContent,
  wide,
}: RightMenuButtonsProps) => {
  const toggleSidebar = (newActiveContent: RightContentType) => {
    setActiveContent(
      newActiveContent === activeContent ? null : newActiveContent,
    );
  };

  return (
    <>
      {rightRailTools(mode).map((content, index) => {
        const tool = TOOLS[content];
        return (
          <button
            key={content}
            onClick={() => toggleSidebar(content)}
            className={`sidebar-button right ${
              activeContent === content ? "active" : ""
            } ${activeContent ? "open" : ""} ${wide ? "wide" : ""}`}
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
