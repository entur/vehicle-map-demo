import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./components/App.tsx";
import { ConfigContext } from "./config/ConfigContext.ts";
import { registerNorgeIBilder } from "./utils/norgeIBilder.ts";

const init = async () => {
  const configResponse = await fetch("/bootstrap.json");
  const config = await configResponse.json();
  registerNorgeIBilder(config["nib-token-endpoint"]);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ConfigContext.Provider value={config}>
        <App />
      </ConfigContext.Provider>
    </StrictMode>,
  );
};

init();
