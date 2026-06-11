import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { I18n } from "./lib/i18n";
import { PwaManager } from "./lib/pwa-manager";

// --- Early, one-time guard for the known TinyMCE duplicate registration ---
// The chat rich-text composer pulls in `overlay_bundle.js` + `webcomponents-ce.js`
// which does an unconditional `customElements.define('mce-autosize-textarea', ...)`.
// Under Vite HMR, lazy-loaded chat panels, or multiple chat instances this
// registration runs more than once and throws an Uncaught Error that pollutes
// the console and the React error overlay.
//
// We patch the global BEFORE any app / chat code can run so the second (and
// subsequent) calls become silent no-ops. This is the exact pattern recommended
// for third-party libraries that do not guard their own define() calls.
if (typeof customElements !== 'undefined') {
  const origDefine = customElements.define.bind(customElements);
  customElements.define = function (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) {
    if (name === 'mce-autosize-textarea' && customElements.get(name)) {
      // Already defined by a previous HMR cycle or duplicate bundle evaluation.
      return;
    }
    return origDefine(name, ctor, opts);
  };
}

const resizeObserverErr = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;
// Errors that originate from user browser extensions (Grammarly, LanguageTool,
// Microsoft Editor, ad-blockers, etc.) rather than from our code. We swallow
// them so they don't crash dev overlays or pollute error telemetry.
const extensionNoise =
  /mce-autosize-textarea|A listener indicated an asynchronous response|message channel closed before a response|webcomponents-ce\.js|overlay_bundle\.js|chrome-extension:|moz-extension:/;
const optimizeDepNoise = /Outdated Optimize Dep|Failed to fetch dynamically imported module/i;
const DEP_RECOVERY_COUNT = "__pp_dep_recovery_count__";
const DEP_RECOVERY_WINDOW_START = "__pp_dep_recovery_window_start__";
const DEP_RECOVERY_WINDOW_MS = 30_000;
const DEP_RECOVERY_MAX_ATTEMPTS = 3;

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

function triggerDepRecoveryReload(reason: string): void {
  if (import.meta.env.PROD) return;
  try {
    const now = Date.now();
    const windowStart = Number(sessionStorage.getItem(DEP_RECOVERY_WINDOW_START) ?? "0");
    const shouldResetWindow = !Number.isFinite(windowStart) || windowStart <= 0 || (now - windowStart) > DEP_RECOVERY_WINDOW_MS;
    if (shouldResetWindow) {
      sessionStorage.setItem(DEP_RECOVERY_WINDOW_START, String(now));
      sessionStorage.setItem(DEP_RECOVERY_COUNT, "0");
    }
    const current = Number(sessionStorage.getItem(DEP_RECOVERY_COUNT) ?? "0");
    const attempts = Number.isFinite(current) ? current : 0;
    if (attempts >= DEP_RECOVERY_MAX_ATTEMPTS) {
      console.error(`[dev-recovery] Skipping reload; max attempts reached (${DEP_RECOVERY_MAX_ATTEMPTS}) for reason: ${reason}`);
      return;
    }
    sessionStorage.setItem(DEP_RECOVERY_COUNT, String(attempts + 1));
  } catch {
    // ignore session storage failures
  }
  console.warn(`[dev-recovery] Reloading page after dependency optimizer mismatch: ${reason}`);
  window.setTimeout(() => window.location.reload(), 250);
}

function resetDepRecoveryWindow(): void {
  try {
    sessionStorage.removeItem(DEP_RECOVERY_COUNT);
    sessionStorage.removeItem(DEP_RECOVERY_WINDOW_START);
  } catch {
    // ignore session storage failures
  }
}

window.addEventListener('error', (e) => {
  const target = e.target as (EventTarget & { src?: string; href?: string }) | null;
  const failedPath = target?.src ?? target?.href ?? '';
  if (import.meta.env.DEV && failedPath.includes('/node_modules/.vite/deps/')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    triggerDepRecoveryReload(failedPath);
    return;
  }
  if (e.message && resizeObserverErr.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  if (import.meta.env.DEV && e.message && optimizeDepNoise.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    triggerDepRecoveryReload(e.message);
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
    return;
  }
  if (import.meta.env.DEV) {
    const reasonMessage =
      typeof e.reason === 'string'
        ? e.reason
        : e.reason instanceof Error
          ? e.reason.message
          : '';
    if (optimizeDepNoise.test(reasonMessage)) {
      e.preventDefault();
      triggerDepRecoveryReload(reasonMessage);
      return;
    }
  }
});

window.addEventListener('vite:preloadError', (event) => {
  if (!import.meta.env.DEV) {
    return;
  }
  const detail = (event as unknown as CustomEvent).detail as unknown;
  const message = detail instanceof Error
    ? detail.message
    : typeof detail === 'string'
      ? detail
      : '';
  if (!message || optimizeDepNoise.test(message)) {
    event.preventDefault();
    triggerDepRecoveryReload(message || 'vite:preloadError');
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

if (import.meta.env.DEV) {
  window.setTimeout(() => {
    resetDepRecoveryWindow();
  }, 1200);
}
