import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const resizeObserverErr = /ResizeObserver loop/;
window.addEventListener('error', (e) => {
  if (e.message && resizeObserverErr.test(e.message)) {
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
