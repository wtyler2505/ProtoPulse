import { useProtoPulseTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

/**
 * A small toggle button that switches between light and dark themes.
 * Switches between the 'light' preset and the last active dark preset
 * in ProtoPulseThemeProvider.
 */
export default function ThemeToggle() {
  const { isDark, toggleThemeMode } = useProtoPulseTheme();

  return (
    <Button
      data-testid="theme-toggle"
      variant="ghost"
      size="icon"
      onClick={toggleThemeMode}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}