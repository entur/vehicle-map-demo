import statisticIcon from "../../static/images/statistics.png";

import { LeftContentType } from "./types.ts";

type LeftMenuButtonsProps = {
  activeContent: LeftContentType | null;
  setActiveContent: (contentType: LeftContentType | null) => void;
};

export const LeftMenuButtons = ({
  activeContent,
  setActiveContent,
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
        style={{
          // Below the top-left control stack: zoom, geolocate, 2D/3D.
          top: "185px",
        }}
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
