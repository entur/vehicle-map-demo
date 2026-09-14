import statisticIcon from "../../static/images/statistics.png";

import { LeftContentType } from "./types.ts";
import { ViewDimension } from "../../domain/viewDimension.ts";

// Below the top-left control stack: zoom, geolocate, 2D/3D — and in 3D the
// rotate buttons too, two 29px buttons plus MapLibre's 10px control margin.
const TOP = { "2d": 185, "3d": 253 } satisfies Record<ViewDimension, number>;

type LeftMenuButtonsProps = {
  activeContent: LeftContentType | null;
  setActiveContent: (contentType: LeftContentType | null) => void;
  viewDimension: ViewDimension;
};

export const LeftMenuButtons = ({
  activeContent,
  setActiveContent,
  viewDimension,
}: LeftMenuButtonsProps) => {
  const toggleSidebar = (newActiveContent: LeftContentType) => {
    if (newActiveContent === activeContent) {
      setActiveContent(null);
    } else {
      setActiveContent(newActiveContent);
    }
  };

  return (
    <>
      <button
        onClick={() => toggleSidebar("statistics")}
        className={`sidebar-button left ${activeContent === "statistics" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{ top: `${TOP[viewDimension]}px` }}
      >
        <img
          src={statisticIcon}
          alt="Statistics"
          title="Statistics"
          className="icon"
        />
      </button>
    </>
  );
};
