import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single CSS custom-property entry (variable name WITHOUT leading `--`). */
interface ThemeColors {
  '--color-background': string;
  '--color-foreground': string;
  '--color-card': string;
  '--color-card-foreground': string;
  '--color-popover': string;
  '--color-popover-foreground': string;
  '--color-primary': string;
  '--color-primary-foreground': string;
  '--color-secondary': string;
  '--color-secondary-foreground': string;
  '--color-muted': string;
  '--color-muted-foreground': string;
  '--color-accent': string;
  '--color-accent-foreground': string;
  '--color-editor-accent': string;
  '--color-destructive': string;
  '--color-destructive-foreground': string;
  '--color-border': string;
  '--color-input': string;
  '--color-ring': string;
  '--color-sidebar': string;
  '--color-sidebar-border': string;
}

export interface ThemePreset {
  /** Unique machine-readable identifier. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** CSS custom property values. */
  colors: ThemeColors;
}

export interface ThemeContextValue {
  currentTheme: string;
  setTheme: (name: string) => void;
  themes: ThemePreset[];
}

// ---------------------------------------------------------------------------
// Presets — all dark, WCAG AA compliant (4.5:1+ text/bg contrast).
// ---------------------------------------------------------------------------

const NEON_CYAN: ThemePreset = {
  id: 'neon-cyan',
  label: 'Neon Cyan',
  colors: {
    '--color-background': 'hsl(225 20% 3%)',
    '--color-foreground': 'hsl(210 20% 90%)',
    '--color-card': 'hsl(225 18% 5%)',
    '--color-card-foreground': 'hsl(210 20% 90%)',
    '--color-popover': 'hsl(225 18% 5%)',
    '--color-popover-foreground': 'hsl(210 20% 90%)',
    '--color-primary': 'hsl(190 100% 43%)',
    '--color-primary-foreground': 'hsl(225 20% 3%)',
    '--color-secondary': 'hsl(260 100% 65%)',
    '--color-secondary-foreground': 'hsl(210 20% 98%)',
    '--color-muted': 'hsl(225 12% 10%)',
    '--color-muted-foreground': 'hsl(215 15% 55%)',
    '--color-accent': 'hsl(190 100% 43%)',
    '--color-accent-foreground': 'hsl(225 20% 3%)',
    '--color-editor-accent': '#00F0FF',
    '--color-destructive': 'hsl(0 85% 55%)',
    '--color-destructive-foreground': 'hsl(210 40% 98%)',
    '--color-border': 'hsl(225 12% 14%)',
    '--color-input': 'hsl(225 12% 14%)',
    '--color-ring': 'hsl(190 100% 43%)',
    '--color-sidebar': 'hsl(225 20% 4%)',
    '--color-sidebar-border': 'hsl(225 12% 12%)',
  },
};

const MIDNIGHT_PURPLE: ThemePreset = {
  id: 'midnight-purple',
  label: 'Midnight Purple',
  colors: {
    '--color-background': 'hsl(250 30% 4%)',
    '--color-foreground': 'hsl(250 15% 90%)',
    '--color-card': 'hsl(250 25% 6%)',
    '--color-card-foreground': 'hsl(250 15% 90%)',
    '--color-popover': 'hsl(250 25% 6%)',
    '--color-popover-foreground': 'hsl(250 15% 90%)',
    '--color-primary': 'hsl(270 90% 65%)',
    '--color-primary-foreground': 'hsl(250 30% 4%)',
    '--color-secondary': 'hsl(300 70% 55%)',
    '--color-secondary-foreground': 'hsl(250 15% 98%)',
    '--color-muted': 'hsl(250 18% 10%)',
    '--color-muted-foreground': 'hsl(250 12% 55%)',
    '--color-accent': 'hsl(270 90% 65%)',
    '--color-accent-foreground': 'hsl(250 30% 4%)',
    '--color-editor-accent': '#A855F7',
    '--color-destructive': 'hsl(0 85% 55%)',
    '--color-destructive-foreground': 'hsl(210 40% 98%)',
    '--color-border': 'hsl(250 15% 14%)',
    '--color-input': 'hsl(250 15% 14%)',
    '--color-ring': 'hsl(270 90% 65%)',
    '--color-sidebar': 'hsl(250 30% 5%)',
    '--color-sidebar-border': 'hsl(250 15% 12%)',
  },
};

const FOREST: ThemePreset = {
  id: 'forest',
  label: 'Forest',
  colors: {
    '--color-background': 'hsl(160 25% 3%)',
    '--color-foreground': 'hsl(140 15% 88%)',
    '--color-card': 'hsl(160 20% 5%)',
    '--color-card-foreground': 'hsl(140 15% 88%)',
    '--color-popover': 'hsl(160 20% 5%)',
    '--color-popover-foreground': 'hsl(140 15% 88%)',
    '--color-primary': 'hsl(150 80% 45%)',
    '--color-primary-foreground': 'hsl(160 25% 3%)',
    '--color-secondary': 'hsl(80 65% 50%)',
    '--color-secondary-foreground': 'hsl(160 25% 3%)',
    '--color-muted': 'hsl(160 12% 10%)',
    '--color-muted-foreground': 'hsl(150 10% 50%)',
    '--color-accent': 'hsl(150 80% 45%)',
    '--color-accent-foreground': 'hsl(160 25% 3%)',
    '--color-editor-accent': '#22C55E',
    '--color-destructive': 'hsl(0 85% 55%)',
    '--color-destructive-foreground': 'hsl(210 40% 98%)',
    '--color-border': 'hsl(160 10% 13%)',
    '--color-input': 'hsl(160 10% 13%)',
    '--color-ring': 'hsl(150 80% 45%)',
    '--color-sidebar': 'hsl(160 25% 4%)',
    '--color-sidebar-border': 'hsl(160 10% 11%)',
  },
};

const AMBER: ThemePreset = {
  id: 'amber',
  label: 'Amber',
  colors: {
    '--color-background': 'hsl(30 20% 4%)',
    '--color-foreground': 'hsl(35 20% 88%)',
    '--color-card': 'hsl(30 18% 6%)',
    '--color-card-foreground': 'hsl(35 20% 88%)',
    '--color-popover': 'hsl(30 18% 6%)',
    '--color-popover-foreground': 'hsl(35 20% 88%)',
    '--color-primary': 'hsl(40 95% 55%)',
    '--color-primary-foreground': 'hsl(30 20% 4%)',
    '--color-secondary': 'hsl(25 85% 50%)',
    '--color-secondary-foreground': 'hsl(35 20% 98%)',
    '--color-muted': 'hsl(30 12% 10%)',
    '--color-muted-foreground': 'hsl(35 10% 50%)',
    '--color-accent': 'hsl(40 95% 55%)',
    '--color-accent-foreground': 'hsl(30 20% 4%)',
    '--color-editor-accent': '#F59E0B',
    '--color-destructive': 'hsl(0 85% 55%)',
    '--color-destructive-foreground': 'hsl(210 40% 98%)',
    '--color-border': 'hsl(30 10% 14%)',
    '--color-input': 'hsl(30 10% 14%)',
    '--color-ring': 'hsl(40 95% 55%)',
    '--color-sidebar': 'hsl(30 20% 5%)',
    '--color-sidebar-border': 'hsl(30 10% 12%)',
  },
};

const ROSE: ThemePreset = {
  id: 'rose',
  label: 'Rose',
  colors: {
    '--color-background': 'hsl(350 20% 4%)',
    '--color-foreground': 'hsl(350 15% 88%)',
    '--color-card': 'hsl(350 18% 6%)',
    '--color-card-foreground': 'hsl(350 15% 88%)',
    '--color-popover': 'hsl(350 18% 6%)',
    '--color-popover-foreground': 'hsl(350 15% 88%)',
    '--color-primary': 'hsl(350 85% 58%)',
    '--color-primary-foreground': 'hsl(350 20% 98%)',
    '--color-secondary': 'hsl(330 70% 50%)',
    '--color-secondary-foreground': 'hsl(350 15% 98%)',
    '--color-muted': 'hsl(350 12% 10%)',
    '--color-muted-foreground': 'hsl(350 10% 50%)',
    '--color-accent': 'hsl(350 85% 58%)',
    '--color-accent-foreground': 'hsl(350 20% 98%)',
    '--color-editor-accent': '#F43F5E',
    '--color-destructive': 'hsl(15 85% 55%)',
    '--color-destructive-foreground': 'hsl(210 40% 98%)',
    '--color-border': 'hsl(350 10% 14%)',
    '--color-input': 'hsl(350 10% 14%)',
    '--color-ring': 'hsl(350 85% 58%)',
    '--color-sidebar': 'hsl(350 20% 5%)',
    '--color-sidebar-border': 'hsl(350 10% 12%)',
  },
};

const MONOCHROME: ThemePreset = {
  id: 'monochrome',
  label: 'Monochrome',
  colors: {
    '--color-background': 'hsl(0 0% 3%)',
    '--color-foreground': 'hsl(0 0% 88%)',
    '--color-card': 'hsl(0 0% 5%)',
    '--color-card-foreground': 'hsl(0 0% 88%)',
    '--color-popover': 'hsl(0 0% 5%)',
    '--color-popover-foreground': 'hsl(0 0% 88%)',
    '--color-primary': 'hsl(0 0% 95%)',
    '--color-primary-foreground': 'hsl(0 0% 3%)',
    '--color-secondary': 'hsl(0 0% 70%)',
    '--color-secondary-foreground': 'hsl(0 0% 3%)',
    '--color-muted': 'hsl(0 0% 10%)',
    '--color-muted-foreground': 'hsl(0 0% 50%)',
    '--color-accent': 'hsl(0 0% 95%)',
    '--color-accent-foreground': 'hsl(0 0% 3%)',
    '--color-editor-accent': '#E5E5E5',
    '--color-destructive': 'hsl(0 85% 55%)',
    '--color-destructive-foreground': 'hsl(0 0% 98%)',
    '--color-border': 'hsl(0 0% 14%)',
    '--color-input': 'hsl(0 0% 14%)',
    '--color-ring': 'hsl(0 0% 95%)',
    '--color-sidebar': 'hsl(0 0% 4%)',
    '--color-sidebar-border': 'hsl(0 0% 12%)',
  },
};

export const THEME_PRESETS: ThemePreset[] = [
  NEON_CYAN,
  MIDNIGHT_PURPLE,
  FOREST,
  AMBER,
  ROSE,
  MONOCHROME,
];

const DEFAULT_THEME_ID = 'neon-cyan';
const STORAGE_KEY = 'protopulse-theme';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Apply a theme preset's CSS custom properties to document.documentElement.
 * When switching back to the default preset we *remove* inline styles so the
 * @theme block in index.css takes over — this avoids inline styles pinning
 * values that would otherwise be overridden by .high-contrast.
 */
function applyThemeColors(preset: ThemePreset): void {
  const root = document.documentElement;
  const isDefault = preset.id === DEFAULT_THEME_ID;

  const vars = Object.keys(preset.colors) as (keyof ThemeColors)[];
  for (const varName of vars) {
    if (isDefault) {
      root.style.removeProperty(varName);
    } else {
      root.style.setProperty(varName, preset.colors[varName]);
    }
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ProtoPulseThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  });

  // Apply on mount and whenever the theme changes.
  useEffect(() => {
    const preset = THEME_PRESETS.find((t) => t.id === currentTheme) ?? THEME_PRESETS[0];
    applyThemeColors(preset);

    try {
      if (currentTheme === DEFAULT_THEME_ID) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, currentTheme);
      }
    } catch {
      // localStorage unavailable — gracefully degrade
    }
  }, [currentTheme]);

  const setTheme = useCallback((name: string) => {
    if (THEME_PRESETS.some((t) => t.id === name)) {
      setCurrentTheme(name);
    }
  }, []);

  const value: ThemeContextValue = {
    currentTheme,
    setTheme,
    themes: THEME_PRESETS,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useProtoPulseTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useProtoPulseTheme must be used within a ProtoPulseThemeProvider');
  }
  return ctx;
}
