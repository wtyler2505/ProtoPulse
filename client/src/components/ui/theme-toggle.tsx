import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

/**
 * A small toggle button that switches between light and dark themes.
 * The current theme is pulled from next-themes and toggled between
 * 'light' and 'dark'. The button is intended to live in a header or
 * toolbar. Users expect dark mode toggles in modern web apps【651377378202774†L357-L366】.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const handleClick = () => {
    setTheme(isDark ? 'light' : 'dark');
  };
  return (
    <Button variant="ghost" size="icon" onClick={handleClick} aria-label="Toggle dark mode">
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}