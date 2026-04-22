/**
 * Placeholder API keys section for the skeleton /settings page (E2E-502).
 * The full API key manager ships with plan 17-shell-header-nav.
 */
export default function APIKeysSection() {
  return (
    <div className="space-y-2" data-testid="settings-api-keys-section">
      <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
      <p className="text-sm text-muted-foreground">
        API key management is coming in 17-shell-header-nav.md. This placeholder exists so /settings no longer returns
        404 (E2E-502).
      </p>
    </div>
  );
}
