import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import {
  bundleFromCore,
  createAutosave,
  loadBundle,
  loadFixture,
} from './state/persistence.js';
import { useSession } from './state/session.js';
import { decodeShareFragment } from './state/share.js';
import './styles.css';

/**
 * Boot: restore the saved design (or the starter fixture), wire the
 * debounced autosave, mount the editor. A share link in the URL
 * fragment (#d=…) loads after mount — guarded by a confirm so a link
 * can never silently replace someone's working design.
 *
 * No <StrictMode>: it double-mounts effects, and CanvasHost owns a real
 * WebGL context whose churn isn't worth the dev-only checks at M1.
 */

const saved = loadBundle();
useSession.getState().replaceWithBundle(saved ?? loadFixture());

void (async () => {
  try {
    const shared = await decodeShareFragment(window.location.hash);
    if (!shared) return;
    const emptySaved = saved === null || saved.branches.every((b) => b.ops.length === 0);
    const take =
      emptySaved ||
      // eslint-disable-next-line no-alert -- M1 guard; proper dialog post-M1
      window.confirm(
        'Open the shared design from this link? Your current design will be replaced — Cancel and use Export → Save design first if you want to keep it.',
      );
    if (take) {
      useSession.getState().replaceWithBundle(shared);
    }
    // Either way, strip the payload so a reload doesn't re-ask.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (err) {
    console.warn('share link is unreadable — keeping the current design', err);
  }
})();

const autosave = createAutosave(() => {
  const s = useSession.getState();
  return bundleFromCore(s.core, s.branch);
});
useSession.subscribe(() => { autosave.schedule(); });
window.addEventListener('beforeunload', () => { autosave.flush(); });

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');
createRoot(rootEl).render(<App />);
