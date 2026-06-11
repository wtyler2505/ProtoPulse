import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

export default function TldrawOverlayPanel() {
  if (import.meta.env.MODE === 'test') {
    return (
      <div
        className="mt-2 h-44 rounded border border-dashed border-primary/40 bg-primary/5"
        data-testid="tscircuit-tldraw-overlay"
      />
    );
  }

  return (
    <div
      className="mt-2 h-44 overflow-hidden rounded border border-dashed border-primary/40 bg-primary/5"
      data-testid="tscircuit-tldraw-overlay"
    >
      <Tldraw autoFocus={false} />
    </div>
  );
}
