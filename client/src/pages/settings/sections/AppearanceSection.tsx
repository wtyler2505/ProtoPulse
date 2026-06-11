import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function AppearanceSection() {
  const [density, setDensity] = useState('comfortable');
  const [focusRings, setFocusRings] = useState(true);

  return (
    <form
      className="space-y-4 rounded-md border border-border/60 bg-card/40 p-4"
      data-testid="settings-appearance-section"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-density">Interface density</Label>
          <select
            id="settings-density"
            data-testid="settings-density-select"
            aria-label="Settings interface density"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            value={density}
            onChange={(event) => {
              setDensity(event.target.value);
            }}
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
          <input
            data-testid="settings-focus-rings-checkbox"
            aria-label="Settings enhanced focus rings"
            type="checkbox"
            checked={focusRings}
            onChange={(event) => {
              setFocusRings(event.target.checked);
            }}
          />
          Enhanced focus rings
        </label>
      </div>
      <Button type="submit" size="sm" data-testid="settings-appearance-save">
        Save Appearance
      </Button>
    </form>
  );
}
