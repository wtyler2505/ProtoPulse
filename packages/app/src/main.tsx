import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import {
  bundleFromCore,
  createAutosave,
  loadBundle,
  loadFixture,
} from './state/persistence.js';
import { useSession } from './state/session.js';
import './styles.css';

/**
 * Boot: restore the saved design (or the starter fixture), wire the
 * debounced autosave, mount the editor.
 *
 * No <StrictMode>: it double-mounts effects, and CanvasHost owns a real
 * WebGL context whose churn isn't worth the dev-only checks at M1.
 */

const saved = loadBundle();
useSession.getState().replaceWithBundle(saved ?? loadFixture());

const autosave = createAutosave(() => {
  const s = useSession.getState();
  return bundleFromCore(s.core, s.branch);
});
useSession.subscribe(() => { autosave.schedule(); });
window.addEventListener('beforeunload', () => { autosave.flush(); });

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');
createRoot(rootEl).render(<App />);
