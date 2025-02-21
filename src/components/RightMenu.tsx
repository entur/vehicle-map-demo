import { Component } from "react";
import filterIcon from "../static/images/filter.png";
import metadataIcon from "../static/images/metadata.png";
import layersIcon from "../static/images/layers.png";
import { Filter, VehicleUpdate } from "../types.ts";
import { CodespaceFilter } from "./CodespaceFilter.tsx";
import { MetadataBox } from "./MetadataBox.tsx";
import { MapLayerToggles } from "./MapLayerToggles.tsx";
import { OperatorFilter } from "./OperatorFilter.tsx";

interface RightMenuProps {
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
  data: VehicleUpdate[];
}

interface RightMenuState {
  isSidebarOpen: boolean;
  activeContent: "filtering" | "metadata" | "layers" | null; // Track the active content
}

class RightMenu extends Component<RightMenuProps, RightMenuState> {
  constructor(props: RightMenuProps) {
    super(props);
    this.state = {
      isSidebarOpen: false,
      activeContent: null,
    };
  }

  // Method to toggle the sidebar and set the active content
  toggleSidebar = (content: RightMenuState["activeContent"]) => {
    this.setState((prevState) => ({
      isSidebarOpen:
        prevState.activeContent !== content || !prevState.isSidebarOpen,
      activeContent: prevState.activeContent === content ? null : content, // Toggle content
    }));
  };

  render() {
    const { isSidebarOpen, activeContent } = this.state;

    return (
      <div>
        {/* Buttons to control sidebar */}
        <button
          onClick={() => this.toggleSidebar("filtering")}
          className={`sidebar-button right ${activeContent === "filtering" ? "active" : ""} ${
            isSidebarOpen ? "open" : ""
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
          onClick={() => this.toggleSidebar("metadata")}
          className={`sidebar-button right ${activeContent === "metadata" ? "active" : ""} ${
            isSidebarOpen ? "open" : ""
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
          onClick={() => this.toggleSidebar("layers")}
          className={`sidebar-button right ${activeContent === "layers" ? "active" : ""} ${
            isSidebarOpen ? "open" : ""
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
        {/* Sidebar */}
        <div className={`right-menu-container ${isSidebarOpen ? "open" : ""}`}>
          {isSidebarOpen &&
            activeContent === "filtering" &&
            this.props.currentFilter && (
              <CodespaceFilter
                setCurrentFilter={this.props.setCurrentFilter}
                currentFilter={this.props.currentFilter}
              />
            )}
          {isSidebarOpen &&
            activeContent === "filtering" &&
            this.props.currentFilter && (
              <OperatorFilter
                setCurrentFilter={this.props.setCurrentFilter}
                currentFilter={this.props.currentFilter}
              />
            )}
          {isSidebarOpen &&
            activeContent === "metadata" &&
            this.props.currentFilter && (
              <MetadataBox title={"Metadata"} data={this.props.data} />
            )}
          {isSidebarOpen &&
            activeContent === "layers" &&
            this.props.currentFilter && <MapLayerToggles />}
        </div>
      </div>
    );
  }
}

export default RightMenu;
