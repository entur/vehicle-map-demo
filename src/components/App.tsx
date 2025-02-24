import { useState } from "react";
import { Filter } from "../types.ts";
import { useVehiclePositionsData } from "../hooks/useVehiclePositionsData.ts";
import { MapView } from "./MapView.tsx";
import { ThemeProvider } from "@mui/material";
import { createTheme } from "@mui/material/styles";

function App() {
  const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
  const data = useVehiclePositionsData(currentFilter);

  const theme = createTheme({
    palette: {
      primary: {
        light: "#afe8e5",
        main: "#1fcac1",
        dark: "#009081",
        contrastText: "#fff",
      },
      secondary: {
        light: "#e9d3ed",
        main: "#9353a1",
        dark: "#480063",
        contrastText: "#000",
      },
    },
  });

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ThemeProvider theme={theme}>
        <MapView
          data={data}
          setCurrentFilter={setCurrentFilter}
          currentFilter={currentFilter}
        />
      </ThemeProvider>
    </div>
  );
}

export default App;
