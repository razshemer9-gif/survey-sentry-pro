import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyColdStart } from "./lib/cold-start.ts";
import "./index.css";

// Before the router reads the address: a session always starts on the
// reports list, never on הגדרות. See lib/cold-start.ts.
applyColdStart();

createRoot(document.getElementById("root")!).render(<App />);
