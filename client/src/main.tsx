import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { I18n } from "./lib/i18n";
import { PwaManager } from "./lib/pwa-manager";

const resizeObserverErr = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;
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

// Initialize i18n framework (loads saved locale from localStorage)
I18n.getInstance();

// Initialize PWA manager (registers service worker, monitors connection)
const pwa = PwaManager.getInstance();
pwa.registerServiceWorker().catch(() => {
  // Service worker registration is optional — fail silently in dev
});

createRoot(document.getElementById("root")!).render(<App />);
