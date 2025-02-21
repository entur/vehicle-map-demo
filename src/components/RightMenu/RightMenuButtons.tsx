import filterIcon from "../../static/images/filter.png";
import metadataIcon from "../../static/images/metadata.png";
import layersIcon from "../../static/images/layers.png";
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
        onClick={() => toggleSidebar("filtering")}
        className={`sidebar-button right ${activeContent === "filtering" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "20px",
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
        onClick={() => toggleSidebar("metadata")}
        className={`sidebar-button right ${activeContent === "metadata" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "75px",
        }}
      >
        <img
          src={metadataIcon}
          alt="Metadata"
          title="Metadata"
          style={{ width: "40px", height: "40px" }}
        />
      </button>

      <button
        onClick={() => toggleSidebar("layers")}
        className={`sidebar-button right ${activeContent === "layers" ? "active" : ""} ${
          activeContent ? "open" : ""
        }`}
        style={{
          top: "130px",
        }}
      >
        <img
          src={layersIcon}
          alt="Layers"
          title="Layers"
          style={{ width: "40px", height: "40px" }}
        />
      </button>
    </>
  );
};
