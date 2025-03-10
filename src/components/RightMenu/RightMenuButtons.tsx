import filterIcon from "../../static/images/filter.png";
import infoIcon from "../../static/images/info.png";
import layersIcon from "../../static/images/layers.png";
import stoplightIcon from "../../static/images/stoplight.png";
import { ContentType } from "./types.ts";

type RightMenuButtonsProps = {
  activeContent: ContentType | null;
  setActiveContent: (contentType: ContentType | null) => void;
};

export const RightMenuButtons = ({
  activeContent,
  setActiveContent,
}: RightMenuButtonsProps) => {
  const toggleSidebar = (newActiveContent: ContentType) => {
    if (newActiveContent === activeContent) {
      setActiveContent(null);
    } else {
      setActiveContent(newActiveContent);
    }
  };

  return (
    <>
      <button
        onClick={() => toggleSidebar("layers")}
        className={`sidebar-button right ${activeContent === "layers" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "20px",
        }}
      >
        <img
          src={layersIcon}
          alt="Layers"
          title="Layers"
          style={{ width: "40px", height: "40px" }}
        />
      </button>
      <button
        onClick={() => toggleSidebar("filtering")}
        className={`sidebar-button right ${activeContent === "filtering" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "75px",
        }}
      >
        <img
          src={filterIcon}
          alt="Filter"
          title="Filter"
          style={{ width: "40px", height: "40px" }}
        />
      </button>

      <button
        onClick={() => toggleSidebar("info")}
        className={`sidebar-button right ${activeContent === "info" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "130px",
        }}
      >
        <img src={infoIcon} alt="Info" title="Info" className="icon" />
      </button>

      <button
        onClick={() => toggleSidebar("stoplight")}
        className={`sidebar-button right ${activeContent === "stoplight" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "185px",
        }}
      >
        <img
          src={stoplightIcon}
          alt="Data report"
          title="Data report"
          style={{ width: "40px", height: "40px" }}
        />
      </button>
    </>
  );
};
