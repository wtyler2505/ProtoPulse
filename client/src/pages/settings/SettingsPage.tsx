import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileSection from "./sections/ProfileSection";
import AppearanceSection from "./sections/AppearanceSection";
import APIKeysSection from "./sections/APIKeysSection";

/**
 * Skeleton /settings route (Plan 01 Phase 4, E2E-502).
 *
 * This page exists to close E2E-502 — the /settings URL used to 404 because
 * no route was registered. The full settings catalog (profile editor,
 * appearance picker, API key manager, etc.) is tracked in plan 17
 * (17-shell-header-nav.md) and is deliberately out of scope here.
 *
 * Each tab renders a short placeholder section. The page is intentionally
 * lightweight: its job is to assert "/settings is a real page" for both
 * humans and Playwright, nothing more.
 */
export default function SettingsPage() {
  return (
    <div
      className="min-h-screen w-full bg-background p-6"
      data-testid="settings-page"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, appearance, and API keys. Full controls land with
            plan 17-shell-header-nav.
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
