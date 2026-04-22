/**
 * Placeholder profile section for the skeleton /settings page (E2E-502).
 * The full profile editor ships with plan 17-shell-header-nav.
 */
export default function ProfileSection() {
  return (
    <div className="space-y-2" data-testid="settings-profile-section">
      <h2 className="text-lg font-semibold text-foreground">Profile</h2>
      <p className="text-sm text-muted-foreground">
        Profile management is coming in 17-shell-header-nav.md. This placeholder
        exists so /settings no longer returns 404 (E2E-502).
      </p>
    </div>
  );
}
