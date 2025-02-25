// App.tsx
import { useState } from "react";
import { Filter } from "../types.ts";
import { useVehiclePositionsData } from "../hooks/useVehiclePositionsData.ts";
import { MapView } from "./MapView.tsx";
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme.ts"; // Adjust the path if needed

function App() {
  const [currentFilter, setCurrentFilter] = useState<Filter | null>(null);
  const data = useVehiclePositionsData(currentFilter);

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
