import { Switch, Route, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ProtoPulseThemeProvider, THEME_PRESETS } from "@/lib/theme-context";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import ProjectWorkspace from "@/pages/ProjectWorkspace";
import ProjectPickerPage from "@/pages/ProjectPickerPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";

const EmbedViewerPage = lazy(() => import("@/pages/EmbedViewerPage"));

// Apply high-contrast class eagerly to avoid flash of unstyled content.
// The useHighContrast hook keeps it in sync after React mounts.
try {
  if (localStorage.getItem('protopulse-high-contrast') === 'true') {
    document.documentElement.classList.add('high-contrast');
  }
} catch {
  // localStorage unavailable — skip
}

// Apply saved color theme eagerly to prevent flash of default colors.
// The ProtoPulseThemeProvider keeps it in sync after React mounts.
try {
  const savedTheme = localStorage.getItem('protopulse-theme');
  if (savedTheme && savedTheme !== 'neon-cyan') {
    const preset = THEME_PRESETS.find((t) => t.id === savedTheme);
    if (preset) {
      const root = document.documentElement;
      for (const [varName, value] of Object.entries(preset.colors)) {
        root.style.setProperty(varName, value);
      }
    }
  }
} catch {
  // localStorage unavailable — skip
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/projects/:projectId" component={ProjectWorkspace} />
      <Route path="/projects" component={ProjectPickerPage} />
      <Route path="/" component={ProjectPickerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** Render embed viewer for /embed/* routes — bypasses AuthGate */
function EmbedRouter() {
  const [matchData, paramsData] = useRoute("/embed/:data");
  const [matchShort, paramsShort] = useRoute("/embed/s/:code");

  if (matchShort) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}>
        <EmbedViewerPage codeParam={paramsShort.code} />
      </Suspense>
    );
  }

  if (matchData) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}>
        <EmbedViewerPage dataParam={paramsData.data} />
      </Suspense>
    );
  }

  return null;
}

function App() {
  const [isEmbed] = useRoute("/embed/*");

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ProtoPulseThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {isEmbed ? (
              <EmbedRouter />
            ) : (
              <AuthProvider>
                <AuthGate>
                  <Router />
                </AuthGate>
              </AuthProvider>
            )}
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ProtoPulseThemeProvider>
    </ThemeProvider>
  );
}

export default App;
