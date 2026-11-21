import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyColdStart } from "./lib/cold-start.ts";
import { startTheme } from "./lib/theme.ts";
import "./index.css";

// Before the router reads the address: a session always starts on the
// reports list, never on הגדרות. See lib/cold-start.ts.
applyColdStart();

// Before the first paint, so the page never flashes the wrong theme: the
// phone's own setting, unless the consultant has chosen. See lib/theme.ts.
startTheme();

createRoot(document.getElementById("root")!).render(<App />);
