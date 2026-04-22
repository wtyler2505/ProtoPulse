/**
 * Unit test for the skeleton /settings page (Plan 01 Phase 4, E2E-502).
 *
 * Asserts the page renders its landmark heading and all three tabs. The
 * route integration (wiring /settings in App.tsx) is covered by the
 * companion Playwright spec `e2e/p0-settings-route.spec.ts`.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import SettingsPage from '../SettingsPage';

describe('SettingsPage (skeleton, E2E-502)', () => {
  it('renders the Settings heading', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument();
  });

  it('renders Profile, Appearance, and API Keys tabs', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-tab-profile')).toBeInTheDocument();
    expect(screen.getByTestId('settings-tab-appearance')).toBeInTheDocument();
    expect(screen.getByTestId('settings-tab-api-keys')).toBeInTheDocument();
  });

  it('defaults to the Profile section visible', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-profile-section')).toBeInTheDocument();
  });
});
