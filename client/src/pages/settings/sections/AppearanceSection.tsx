/**
 * Placeholder appearance section for the skeleton /settings page (E2E-502).
 * The full theme/appearance controls ship with plan 17-shell-header-nav.
 */
export default function AppearanceSection() {
  return (
    <div className="space-y-2" data-testid="settings-appearance-section">
      <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
      <p className="text-sm text-muted-foreground">
        Appearance controls are coming in 17-shell-header-nav.md. This placeholder exists so /settings no longer returns
        404 (E2E-502).
      </p>
    </div>
  );
}
