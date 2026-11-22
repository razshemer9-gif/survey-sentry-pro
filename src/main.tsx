import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyColdStart } from "./lib/cold-start.ts";
import { startTheme } from "./lib/theme.ts";
import { watchForNewBuild } from "./lib/build-version.ts";
import "./index.css";

// Before the router reads the address: a session always starts on the
// reports list, never on הגדרות. See lib/cold-start.ts.
applyColdStart();

// Before the first paint, so the page never flashes the wrong theme: the
// phone's own setting, unless the consultant has chosen. See lib/theme.ts.
startTheme();

// A phone keeps a page added to its Home Screen for a long time, so a
// consultant can be looking at last week's build while the fix they asked
// for sits on the server. Ask the server which build is current, at launch
// and whenever the app is opened again. See lib/build-version.
watchForNewBuild();

createRoot(document.getElementById("root")!).render(<App />);
