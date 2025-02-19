import { Component } from "react";
import { ControlPosition } from "react-map-gl/maplibre";
import filterIcon from "./static/images/filter.png";
import { Filter } from "./types.ts";
import { CodespaceFilter } from "./CodespaceFilter.tsx";

interface RightMenuProps {
  position: ControlPosition;
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
}

interface RightMenuState {
  isSidebarOpen: boolean;
  activeContent: "filtering" | "tripFilters" | null; // Track the active content
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
            alt="Debug layer"
            title="Debug layer"
            style={{ width: "40px", height: "40px" }}
          />
        </button>

        {/* Sidebar */}
        <div
          className="right-menu-container"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: isSidebarOpen ? "270px" : "0",
            height: "100%",
            backgroundColor: "#f4f4f4",
            overflowX: "hidden",
            transition: "0.3s",
            paddingTop: "20px",
            boxShadow: isSidebarOpen ? "-2px 0 5px rgba(0, 0, 0, 0.2)" : "none",
          }}
        >
          {isSidebarOpen &&
            activeContent === "filtering" &&
            this.props.currentFilter && (
              <CodespaceFilter
                setCurrentFilter={this.props.setCurrentFilter}
                currentFilter={this.props.currentFilter}
              />
            )}
        </div>
      </div>
    );
  }
}

export default RightMenu;
