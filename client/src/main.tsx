import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress ResizeObserver loop errors - these are harmless browser errors
// that fire during rapid resize operations (e.g. when dragging panel borders).
// React Flow and other components use ResizeObserver internally, and during
// fast resizing the browser can't deliver all observations in one frame,
// firing a non-critical error that would otherwise crash the app.
const resizeObserverErr = /ResizeObserver loop/;
window.addEventListener('error', (e) => {
  if (e.message && resizeObserverErr.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  // Also catch non-Error-object throws (ResizeObserver in some browsers)
  if (!e.error && !e.message) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && typeof e.reason === 'string' && resizeObserverErr.test(e.reason)) {
    e.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
