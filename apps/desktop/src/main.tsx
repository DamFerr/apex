import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { Overlay } from "./app/Overlay";
import { isTauri } from "./lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";

// The overlay is a second native window that loads this same bundle; its label picks which UI to show.
const isOverlay = isTauri && getCurrentWindow().label === "overlay";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>{isOverlay ? <Overlay /> : <App />}</React.StrictMode>);
if (import.meta.env.DEV) console.info(`[perf] first render at ${performance.now().toFixed(0)} ms (cold start budget 2000)`);
