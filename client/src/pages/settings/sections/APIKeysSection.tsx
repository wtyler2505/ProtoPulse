import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function APIKeysSection() {
  const [provider, setProvider] = useState('openai');
  const [keyName, setKeyName] = useState('Workbench key');

  return (
    <form
      className="space-y-4 rounded-md border border-border/60 bg-card/40 p-4"
      data-testid="settings-api-keys-section"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-key-provider">Provider</Label>
          <select
            id="settings-key-provider"
            data-testid="settings-key-provider-select"
            aria-label="Settings API key provider"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="octopart">Octopart</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-key-name">Key label</Label>
          <Input
            id="settings-key-name"
            data-testid="settings-key-name-input"
            aria-label="Settings API key label"
            value={keyName}
            onChange={(event) => {
              setKeyName(event.target.value);
            }}
          />
        </div>
      </div>
      <Button type="submit" size="sm" data-testid="settings-api-key-save">
        Save Key Slot
      </Button>
    </form>
  );
}
