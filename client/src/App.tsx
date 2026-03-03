import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ProtoPulseThemeProvider, THEME_PRESETS } from "@/lib/theme-context";
import { Loader2 } from "lucide-react";
import ProjectWorkspace from "@/pages/ProjectWorkspace";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";

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
      <Route path="/">{() => <Redirect to="/projects/1" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ProtoPulseThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <AuthGate>
                <Router />
              </AuthGate>
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ProtoPulseThemeProvider>
    </ThemeProvider>
  );
}

export default App;
