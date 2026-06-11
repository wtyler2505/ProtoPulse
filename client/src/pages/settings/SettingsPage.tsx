import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import APIKeysSection from './sections/APIKeysSection';
import AppearanceSection from './sections/AppearanceSection';
import ProfileSection from './sections/ProfileSection';

/**
 * Lightweight /settings route (Plan 01 Phase 4, E2E-502).
 *
 * This page exists to close E2E-502 — the /settings URL used to 404 because
 * no route was registered. The full settings catalog (profile editor,
 * appearance picker, API key manager, etc.) is tracked in plan 17
 * (17-shell-header-nav.md) and is deliberately out of scope here.
 *
 * Each tab renders a small keyboard-reachable control group. The broader
 * settings catalog is still tracked in plan 17-shell-header-nav, but this
 * route must not behave like a tabpanel dead end for keyboard users.
 */
export default function SettingsPage() {
  return (
    <div className="min-h-screen w-full bg-background p-6" data-testid="settings-page">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage profile, appearance, and API key defaults for this workspace.
          </p>
        </header>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" data-testid="settings-tab-profile">
              Profile
            </TabsTrigger>
            <TabsTrigger value="appearance" data-testid="settings-tab-appearance">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="api-keys" data-testid="settings-tab-api-keys">
              API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <ProfileSection />
          </TabsContent>
          <TabsContent value="appearance" className="mt-4">
            <AppearanceSection />
          </TabsContent>
          <TabsContent value="api-keys" className="mt-4">
            <APIKeysSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
