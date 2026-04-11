import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { I18n } from "./lib/i18n";
import { PwaManager } from "./lib/pwa-manager";

const resizeObserverErr = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;
// Errors that originate from user browser extensions (Grammarly, LanguageTool,
// Microsoft Editor, ad-blockers, etc.) rather than from our code. We swallow
// them so they don't crash dev overlays or pollute error telemetry.
const extensionNoise =
  /mce-autosize-textarea|A listener indicated an asynchronous response|message channel closed before a response|webcomponents-ce\.js|overlay_bundle\.js|chrome-extension:|moz-extension:/;

function isExtensionNoise(value: unknown): boolean {
  if (typeof value === 'string') {
    return extensionNoise.test(value);
  }
  if (value instanceof Error) {
    return extensionNoise.test(value.message) || (value.stack ? extensionNoise.test(value.stack) : false);
  }
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const msg = (value as { message?: unknown }).message;
    return typeof msg === 'string' && extensionNoise.test(msg);
  }
  return false;
}

window.addEventListener('error', (e) => {
  if (e.message && resizeObserverErr.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  if (isExtensionNoise(e.error) || (e.message && extensionNoise.test(e.message))) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && typeof e.reason === 'string' && resizeObserverErr.test(e.reason)) {
    e.preventDefault();
    return;
  }
  if (isExtensionNoise(e.reason)) {
    e.preventDefault();
  }
});

// Initialize i18n framework (loads saved locale from localStorage)
I18n.getInstance();

// Initialize PWA manager (registers service worker, monitors connection)
const pwa = PwaManager.getInstance();
if (import.meta.env.PROD) {
  pwa.registerServiceWorker().catch(() => {});
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => { r.unregister(); });
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
