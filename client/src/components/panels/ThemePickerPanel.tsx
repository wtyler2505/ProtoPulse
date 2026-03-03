import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProtoPulseTheme } from '@/lib/theme-context';
import type { ThemePreset } from '@/lib/theme-context';

// ---------------------------------------------------------------------------
// Individual theme swatch card
// ---------------------------------------------------------------------------

function ThemeSwatch({ preset, active, onSelect }: {
  preset: ThemePreset;
  active: boolean;
  onSelect: () => void;
}) {
  const bg = preset.colors['--color-background'];
  const fg = preset.colors['--color-foreground'];
  const primary = preset.colors['--color-primary'];
  const accent = preset.colors['--color-editor-accent'];
  const muted = preset.colors['--color-muted'];
  const border = preset.colors['--color-border'];

  return (
    <button
      data-testid={`theme-swatch-${preset.id}`}
      aria-label={`Select ${preset.label} theme`}
      aria-pressed={active}
      className={cn(
        'relative flex flex-col gap-2 p-3 border transition-all text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        active
          ? 'border-primary ring-1 ring-primary/30'
          : 'border-border/50 hover:border-muted-foreground/40',
      )}
      onClick={onSelect}
    >
      {/* Color bar preview */}
      <div className="flex gap-1 h-6 w-full overflow-hidden">
        <div className="flex-1" style={{ background: bg, border: `1px solid ${border}` }} />
        <div className="flex-1" style={{ background: primary }} />
        <div className="flex-1" style={{ background: accent }} />
        <div className="flex-1" style={{ background: muted, border: `1px solid ${border}` }} />
      </div>

      {/* Text preview */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="text-xs font-medium truncate"
          style={{ color: fg }}
        >
          {preset.label}
        </span>
      </div>

      {/* Sample text on bg */}
      <div
        className="text-[10px] px-1.5 py-0.5 leading-tight truncate"
        style={{ background: bg, color: fg, border: `1px solid ${border}` }}
      >
        Aa Sample
      </div>

      {/* Active check mark */}
      {active && (
        <div
          data-testid={`theme-active-${preset.id}`}
          className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-primary text-primary-foreground"
        >
          <Check className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function ThemePickerPanel() {
  const { currentTheme, setTheme, themes } = useProtoPulseTheme();

  return (
    <div data-testid="theme-picker-panel" className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Color Theme</h3>
        <p className="text-xs text-muted-foreground">
          Choose a color palette for the interface.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((preset) => (
          <ThemeSwatch
            key={preset.id}
            preset={preset}
            active={currentTheme === preset.id}
            onSelect={() => setTheme(preset.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default ThemePickerPanel;
