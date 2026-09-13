// Application entry point: mounts the Trajectory React app into #root.
// StrictMode double-invokes render/effects in dev to surface side-effect bugs.
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
