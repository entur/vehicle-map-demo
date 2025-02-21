import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ConfigContext } from "./config/ConfigContext.ts";

const init = async () => {
  const configResponse = await fetch("/bootstrap.json");
  const config = await configResponse.json();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ConfigContext.Provider value={config}>
        <App />
      </ConfigContext.Provider>
    </StrictMode>,
  );
};

init();
