import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfileSection() {
  const [displayName, setDisplayName] = useState('Tyler');
  const [email, setEmail] = useState('tyler@example.local');
  const [role, setRole] = useState('owner');

  return (
    <form
      className="space-y-4 rounded-md border border-border/60 bg-card/40 p-4"
      data-testid="settings-profile-section"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h2 className="text-lg font-semibold text-foreground">Profile</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-display-name">Display name</Label>
          <Input
            id="settings-display-name"
            data-testid="settings-display-name-input"
            aria-label="Settings display name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-email">Email</Label>
          <Input
            id="settings-email"
            data-testid="settings-email-input"
            aria-label="Settings email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-role">Workspace role</Label>
          <select
            id="settings-role"
            data-testid="settings-role-select"
            aria-label="Settings workspace role"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
            }}
          >
            <option value="owner">Owner</option>
            <option value="builder">Builder</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" data-testid="settings-profile-save">
          Save Profile
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="settings-profile-reset"
          onClick={() => {
            setDisplayName('Tyler');
            setEmail('tyler@example.local');
            setRole('owner');
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
