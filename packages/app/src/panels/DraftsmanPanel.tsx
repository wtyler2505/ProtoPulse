/**
 * Draftsman — STUB. The AI package (@protopulse/ai) is built by another
 * track and must NOT be imported here. Integration point: when the AI
 * package lands, it installs `window.__ppDraftsman` (or this panel is
 * replaced by one that accepts the props below).
 */

export interface DraftsmanProps {
  /** Called with the user's chat input once the AI package wires in. */
  onUserMessage?: (text: string) => void;
}

declare global {
  interface Window {
    /** Installed by @protopulse/ai when present. */
    __ppDraftsman?: { onUserMessage: (text: string) => void };
  }
}

export function DraftsmanPanel({ onUserMessage }: DraftsmanProps) {
  // TODO(@protopulse/ai): replace the disabled shell with the real chat.
  const hook = onUserMessage ?? (typeof window !== 'undefined' ? window.__ppDraftsman?.onUserMessage : undefined);
  const ready = hook !== undefined;

  return (
    <div className="panel-body draftsman">
      <div className="draftsman-feed">
        <p className="muted">
          {ready
            ? 'Draftsman is connected.'
            : 'Draftsman arrives with @protopulse/ai'}
        </p>
      </div>
      <form
        className="draftsman-input-row"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          type="text"
          className="draftsman-input"
          placeholder="Ask the Draftsman…"
          disabled={!ready}
          aria-label="Draftsman chat input"
        />
        <button type="submit" disabled={!ready}>
          Send
        </button>
      </form>
    </div>
  );
}
