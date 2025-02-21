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
        light: "#757ce8",
        main: "#3f50b5",
        dark: "#002884",
        contrastText: "#fff",
      },
      secondary: {
        light: "#ff7961",
        main: "#f44336",
        dark: "#ba000d",
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
