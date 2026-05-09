/**
 * Component tests for 4-canonical-tier trust badge rendering (audit #173).
 *
 * Mounts BreadboardPartInspector with a minimal model fixture for each of the
 * 4 trust tiers and asserts:
 *   1. The correct text label is present in the rendered output.
 *   2. Each tier has a distinct CSS color class on the badge.
 *   3. The old binary 'Candidate exact' label is gone.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import BreadboardPartInspector from '../BreadboardPartInspector';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import type { BreadboardTrustTier } from '@/lib/breadboard-part-inspector';

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// Minimal model fixture builder
// ---------------------------------------------------------------------------

function buildModel(
  trustTier: BreadboardTrustTier,
  overrides: Partial<BreadboardSelectedPartModel> = {},
): BreadboardSelectedPartModel {
  return {
    authoritativeWiringAllowed: false,
    instanceId: 1,
    refDes: 'U1',
    title: 'Test Part',
    family: 'ic',
    type: 'mcu',
    manufacturer: 'ACME',
    mpn: 'TEST-001',
    pinCount: 2,
    partFamily: 'ic-package',
    fit: 'native',
    modelQuality: 'basic',
    storageLocation: null,
    ownedQuantity: 1,
    requiredQuantity: 1,
    missingQuantity: 0,
    readyNow: true,
    starterFriendly: true,
    pinMapConfidence: 'exact',
    exactPinCount: 2,
    heuristicPinCount: 0,
    criticalPinCount: 0,
    requiresVerification: false,
    roleCounts: {
      power: 1,
      ground: 1,
      clock: 0,
      control: 0,
      communication: 0,
      analog: 0,
      passive: 0,
      signal: 0,
    },
    pinTrustSummary: 'All pins connector-defined.',
    fitSummary: 'Native fit.',
    inventorySummary: 'Ready now.',
    trustSummary: 'Verified exact.',
    verificationLevel: 'official-backed',
    verificationStatus: 'verified',
    trustTier,
    coach: {
      headline: 'Make power boring first.',
      orientationSummary: 'Orient across the trench.',
      railStrategy: 'Use clean rail pair.',
      supportParts: [],
      cautions: [],
      nextMoves: [],
    },
    pins: [
      {
        id: 'vcc',
        label: 'VCC',
        description: null,
        coord: { type: 'terminal', col: 'e', row: 1 },
        coordLabel: 'e1',
        pixel: { x: 40, y: 40 },
        confidence: 'exact',
        source: 'connector',
        side: 'left',
        role: 'power',
        isCritical: false,
      },
      {
        id: 'gnd',
        label: 'GND',
        description: null,
        coord: { type: 'terminal', col: 'f', row: 1 },
        coordLabel: 'f1',
        pixel: { x: 60, y: 40 },
        confidence: 'exact',
        source: 'connector',
        side: 'right',
        role: 'ground',
        isCritical: false,
      },
    ],
    ...overrides,
  };
}

// Minimal prop set for BreadboardPartInspector
function baseProps(model: BreadboardSelectedPartModel) {
  return {
    canApplyCoachPlan: false,
    coachActionCount: 0,
    coachActions: [],
    coachPlanVisible: false,
    layoutQuality: null,
    model,
    onApplyCoachPlan: vi.fn(),
    valueEditor: null,
    onHoverPin: vi.fn(),
    onSelectionAiAction: vi.fn(),
    onToggleCoachPlan: vi.fn(),
    onValueChange: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BreadboardPartInspector — 4-canonical-tier trust badge (audit #173)', () => {
  it('renders "Verified exact" label for verified-exact tier', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('verified-exact'))} />);
    expect(screen.getByText('Verified exact')).toBeTruthy();
  });

  it('renders "Connector defined" label for connector-defined tier', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('connector-defined'))} />);
    expect(screen.getByText('Connector defined')).toBeTruthy();
  });

  it('renders "Heuristic" label for heuristic tier', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('heuristic'))} />);
    expect(screen.getByText('Heuristic')).toBeTruthy();
  });

  it('renders "Stash absent" label for stash-absent tier', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('stash-absent'))} />);
    expect(screen.getByText('Stash absent')).toBeTruthy();
  });

  it('does NOT render the old binary "Candidate exact" label', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('connector-defined'))} />);
    expect(screen.queryByText('Candidate exact')).toBeNull();
  });

  it('verified-exact badge uses emerald color class', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('verified-exact'))} />);
    // Get the badge element that contains the tier label text
    const badge = screen.getByText('Verified exact').closest('[class*="border-"]');
    expect(badge).toBeTruthy();
    expect(badge?.className).toContain('emerald');
  });

  it('connector-defined badge uses sky color class', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('connector-defined'))} />);
    const badge = screen.getByText('Connector defined').closest('[class*="border-"]');
    expect(badge).toBeTruthy();
    expect(badge?.className).toContain('sky');
  });

  it('heuristic badge uses amber color class', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('heuristic'))} />);
    const badge = screen.getByText('Heuristic').closest('[class*="border-"]');
    expect(badge).toBeTruthy();
    expect(badge?.className).toContain('amber');
  });

  it('stash-absent badge uses rose color class', () => {
    renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel('stash-absent'))} />);
    const badge = screen.getByText('Stash absent').closest('[class*="border-"]');
    expect(badge).toBeTruthy();
    expect(badge?.className).toContain('rose');
  });

  it('all 4 tiers have distinct badge color classes from each other', () => {
    const tierLabels: [BreadboardTrustTier, string][] = [
      ['verified-exact', 'Verified exact'],
      ['connector-defined', 'Connector defined'],
      ['heuristic', 'Heuristic'],
      ['stash-absent', 'Stash absent'],
    ];

    const colorClasses: string[] = [];

    for (const [tier, label] of tierLabels) {
      renderWithQuery(<BreadboardPartInspector {...baseProps(buildModel(tier))} />);
      // Find by text then walk up to the badge element with a border class
      const badge = screen.getByText(label).closest('[class*="border-"]');
      expect(badge).toBeTruthy();
      // Extract the color-bearing segment from the class list
      const colorClass = Array.from(badge!.classList)
        .filter((c) => c.startsWith('border-') || c.startsWith('bg-'))
        .sort()
        .join(' ');
      colorClasses.push(colorClass);
    }

    // All 4 tiers must have distinct color class combinations
    const uniqueClasses = new Set(colorClasses);
    expect(uniqueClasses.size).toBe(4);
  });
});
