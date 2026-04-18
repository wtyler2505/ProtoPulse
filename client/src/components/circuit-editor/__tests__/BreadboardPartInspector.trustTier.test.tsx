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

import BreadboardPartInspector from '../BreadboardPartInspector';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import type { BreadboardTrustTier } from '@/lib/breadboard-part-inspector';

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
    verificationLevel: 'full',
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
    render(<BreadboardPartInspector {...baseProps(buildModel('verified-exact'))} />);
    expect(screen.getByText('Verified exact')).toBeTruthy();
  });

  it('renders "Connector defined" label for connector-defined tier', () => {
    render(<BreadboardPartInspector {...baseProps(buildModel('connector-defined'))} />);
    expect(screen.getByText('Connector defined')).toBeTruthy();
  });

  it('renders "Heuristic" label for heuristic tier', () => {
    render(<BreadboardPartInspector {...baseProps(buildModel('heuristic'))} />);
    expect(screen.getByText('Heuristic')).toBeTruthy();
  });

  it('renders "Stash absent" label for stash-absent tier', () => {
    render(<BreadboardPartInspector {...baseProps(buildModel('stash-absent'))} />);
    expect(screen.getByText('Stash absent')).toBeTruthy();
  });

  it('does NOT render the old binary "Candidate exact" label', () => {
    render(<BreadboardPartInspector {...baseProps(buildModel('connector-defined'))} />);
    expect(screen.queryByText('Candidate exact')).toBeNull();
  });

  it('verified-exact badge uses emerald color class', () => {
    const { container } = render(
      <BreadboardPartInspector {...baseProps(buildModel('verified-exact'))} />,
    );
    const badge = container.querySelector('.border-emerald-400\\/30.bg-emerald-400\\/10');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Verified exact');
  });

  it('connector-defined badge uses sky color class', () => {
    const { container } = render(
      <BreadboardPartInspector {...baseProps(buildModel('connector-defined'))} />,
    );
    const badge = container.querySelector('.border-sky-400\\/30.bg-sky-400\\/10');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Connector defined');
  });

  it('heuristic badge uses amber color class', () => {
    const { container } = render(
      <BreadboardPartInspector {...baseProps(buildModel('heuristic'))} />,
    );
    const badge = container.querySelector('.border-amber-400\\/30.bg-amber-400\\/10');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Heuristic');
  });

  it('stash-absent badge uses rose color class', () => {
    const { container } = render(
      <BreadboardPartInspector {...baseProps(buildModel('stash-absent'))} />,
    );
    const badge = container.querySelector('.border-rose-500\\/30.bg-rose-500\\/10');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Stash absent');
  });

  it('all 4 tiers have distinct badge color classes from each other', () => {
    const colorClasses: string[] = [];

    for (const tier of ['verified-exact', 'connector-defined', 'heuristic', 'stash-absent'] as BreadboardTrustTier[]) {
      const { container } = render(
        <BreadboardPartInspector {...baseProps(buildModel(tier))} />,
      );
      // Find the trust-tier badge by looking for the badge that contains the
      // tier-specific label text
      const allBadges = container.querySelectorAll('[class*="border-"][class*="bg-"]');
      let tierBadgeClass: string | undefined;
      for (const badge of Array.from(allBadges)) {
        const text = badge.textContent ?? '';
        if (
          (tier === 'verified-exact' && text.includes('Verified exact')) ||
          (tier === 'connector-defined' && text.includes('Connector defined')) ||
          (tier === 'heuristic' && text.includes('Heuristic')) ||
          (tier === 'stash-absent' && text.includes('Stash absent'))
        ) {
          // Extract the color-bearing classes
          tierBadgeClass = Array.from(badge.classList)
            .filter((c) => c.startsWith('border-') || c.startsWith('bg-'))
            .join(' ');
          break;
        }
      }
      expect(tierBadgeClass).toBeTruthy();
      colorClasses.push(tierBadgeClass!);
    }

    // All 4 tiers must have distinct color class combinations
    const uniqueClasses = new Set(colorClasses);
    expect(uniqueClasses.size).toBe(4);
  });
});
