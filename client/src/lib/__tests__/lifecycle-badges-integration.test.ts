import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  classifyLifecycle,
  getLifecycleColor,
  getLifecycleLabel,
} from '@/lib/lifecycle-badges';
import type { LifecycleStatus } from '@/lib/lifecycle-badges';

// ── classifyLifecycle unit tests ──

describe('classifyLifecycle', () => {
  it('classifies LM7805CT as nrnd', () => {
    expect(classifyLifecycle('LM7805CT')).toBe('nrnd');
  });

  it('classifies ATmega328P-PU as active', () => {
    expect(classifyLifecycle('ATmega328P-PU')).toBe('active');
  });

  it('classifies ESP32-WROOM-32 as active', () => {
    expect(classifyLifecycle('ESP32-WROOM-32')).toBe('active');
  });

  it('classifies LM317K as obsolete', () => {
    expect(classifyLifecycle('LM317K')).toBe('obsolete');
  });

  it('classifies NE555P as nrnd', () => {
    expect(classifyLifecycle('NE555P')).toBe('nrnd');
  });

  it('classifies RP2350 as preliminary', () => {
    expect(classifyLifecycle('RP2350')).toBe('preliminary');
  });

  it('classifies UA7805 with Fairchild manufacturer as obsolete', () => {
    expect(classifyLifecycle('UA7805', 'Fairchild')).toBe('obsolete');
  });

  it('classifies SN754410NE as obsolete', () => {
    expect(classifyLifecycle('SN754410NE')).toBe('obsolete');
  });

  it('classifies unknown part as unknown', () => {
    expect(classifyLifecycle('XYZZY-9999')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(classifyLifecycle('')).toBe('unknown');
  });

  it('returns unknown for whitespace-only string', () => {
    expect(classifyLifecycle('   ')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(classifyLifecycle('lm7805ct')).toBe('nrnd');
    expect(classifyLifecycle('LM7805CT')).toBe('nrnd');
    expect(classifyLifecycle('Lm7805Ct')).toBe('nrnd');
  });

  it('strips /NOPB suffix', () => {
    expect(classifyLifecycle('LM741CN/NOPB')).toBe('nrnd');
  });
});

// ── getLifecycleColor tests ──

describe('getLifecycleColor', () => {
  it('returns amber colors for nrnd', () => {
    const colors = getLifecycleColor('nrnd');
    expect(colors.text).toContain('amber');
  });

  it('returns orange colors for eol', () => {
    const colors = getLifecycleColor('eol');
    expect(colors.text).toContain('orange');
  });

  it('returns red colors for obsolete', () => {
    const colors = getLifecycleColor('obsolete');
    expect(colors.text).toContain('red');
  });

  it('returns blue colors for preliminary', () => {
    const colors = getLifecycleColor('preliminary');
    expect(colors.text).toContain('blue');
  });

  it('returns emerald colors for active', () => {
    const colors = getLifecycleColor('active');
    expect(colors.text).toContain('emerald');
  });
});

// ── getLifecycleLabel tests ──

describe('getLifecycleLabel', () => {
  it('returns correct label for each status', () => {
    expect(getLifecycleLabel('active')).toBe('Active');
    expect(getLifecycleLabel('nrnd')).toBe('NRND');
    expect(getLifecycleLabel('eol')).toBe('EOL');
    expect(getLifecycleLabel('obsolete')).toBe('Obsolete');
    expect(getLifecycleLabel('preliminary')).toBe('Preliminary');
    expect(getLifecycleLabel('unknown')).toBe('Unknown');
  });
});

// ── LifecycleBadge visibility tests ──

describe('LifecycleBadge visibility', () => {
  // We test the component rendering logic via the underlying classifyLifecycle
  // and the LifecycleBadge component's render behavior.
  // LifecycleBadge returns null for 'active' and 'unknown'.

  // Dynamic import to avoid module resolution issues in test env
  let LifecycleBadge: React.ComponentType<{
    partNumber: string;
    manufacturer?: string;
    status?: LifecycleStatus;
  }>;

  beforeEach(async () => {
    const mod = await import('@/components/ui/LifecycleBadge');
    LifecycleBadge = mod.LifecycleBadge;
  });

  function renderWithTooltip(element: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(TooltipProvider, null, element),
      ),
    );
  }

  it('renders nothing for active parts', () => {
    const { container } = renderWithTooltip(
      createElement(LifecycleBadge, { partNumber: 'ATmega328P-PU' }),
    );
    // TooltipProvider renders a wrapper, but LifecycleBadge returns null for active
    expect(container.querySelector('[data-testid]')).toBeNull();
  });

  it('renders nothing for unknown parts', () => {
    const { container } = renderWithTooltip(
      createElement(LifecycleBadge, { partNumber: 'UNKNOWN-PART-999' }),
    );
    expect(container.querySelector('[data-testid]')).toBeNull();
  });

  it('renders badge for nrnd parts', () => {
    renderWithTooltip(createElement(LifecycleBadge, { partNumber: 'LM7805CT' }));
    expect(screen.getByTestId('lifecycle-badge-nrnd')).toBeDefined();
  });

  it('renders badge for obsolete parts', () => {
    renderWithTooltip(createElement(LifecycleBadge, { partNumber: 'LM317K' }));
    expect(screen.getByTestId('lifecycle-badge-obsolete')).toBeDefined();
  });

  it('renders badge for eol status override', () => {
    renderWithTooltip(createElement(LifecycleBadge, { partNumber: 'anything', status: 'eol' }));
    expect(screen.getByTestId('lifecycle-badge-eol')).toBeDefined();
  });

  it('renders badge for preliminary parts', () => {
    renderWithTooltip(createElement(LifecycleBadge, { partNumber: 'RP2350' }));
    expect(screen.getByTestId('lifecycle-badge-preliminary')).toBeDefined();
  });
});

// ── Lifecycle summary counter logic tests ──

describe('lifecycle summary counter logic', () => {
  // Test the counting logic that will be used in ProcurementView

  function computeLifecycleWarnings(items: Array<{ partNumber: string; manufacturer: string }>) {
    let nrndCount = 0;
    let eolCount = 0;
    let obsoleteCount = 0;

    for (const item of items) {
      const status = classifyLifecycle(item.partNumber, item.manufacturer);
      if (status === 'nrnd') { nrndCount++; }
      if (status === 'eol') { eolCount++; }
      if (status === 'obsolete') { obsoleteCount++; }
    }

    const total = nrndCount + eolCount + obsoleteCount;
    const hasEolOrObsolete = eolCount > 0 || obsoleteCount > 0;

    return { nrndCount, eolCount, obsoleteCount, total, hasEolOrObsolete };
  }

  it('returns 0 warnings for all active parts', () => {
    const items = [
      { partNumber: 'ATmega328P-PU', manufacturer: 'Microchip' },
      { partNumber: 'ESP32-WROOM-32', manufacturer: 'Espressif' },
      { partNumber: 'STM32F103C8T6', manufacturer: 'STMicroelectronics' },
    ];
    const result = computeLifecycleWarnings(items);
    expect(result.total).toBe(0);
    expect(result.hasEolOrObsolete).toBe(false);
  });

  it('returns 0 warnings for empty BOM', () => {
    const result = computeLifecycleWarnings([]);
    expect(result.total).toBe(0);
  });

  it('counts NRND warnings correctly', () => {
    const items = [
      { partNumber: 'LM7805CT', manufacturer: '' },
      { partNumber: 'NE555P', manufacturer: '' },
      { partNumber: 'ATmega328P-PU', manufacturer: 'Microchip' },
    ];
    const result = computeLifecycleWarnings(items);
    expect(result.nrndCount).toBe(2);
    expect(result.total).toBe(2);
    expect(result.hasEolOrObsolete).toBe(false);
  });

  it('counts mixed statuses correctly', () => {
    const items = [
      { partNumber: 'LM7805CT', manufacturer: '' },        // nrnd
      { partNumber: 'LM317K', manufacturer: '' },           // obsolete
      { partNumber: 'SN754410NE', manufacturer: '' },       // obsolete
      { partNumber: 'ATmega328P-PU', manufacturer: '' },    // active
    ];
    const result = computeLifecycleWarnings(items);
    expect(result.nrndCount).toBe(1);
    expect(result.obsoleteCount).toBe(2);
    expect(result.total).toBe(3);
    expect(result.hasEolOrObsolete).toBe(true);
  });

  it('identifies hasEolOrObsolete when EOL/obsolete present', () => {
    const items = [
      { partNumber: 'LM317K', manufacturer: '' },  // obsolete
    ];
    const result = computeLifecycleWarnings(items);
    expect(result.hasEolOrObsolete).toBe(true);
  });

  it('sets hasEolOrObsolete false for NRND-only', () => {
    const items = [
      { partNumber: 'LM7805CT', manufacturer: '' },  // nrnd
      { partNumber: 'NE555P', manufacturer: '' },     // nrnd
    ];
    const result = computeLifecycleWarnings(items);
    expect(result.hasEolOrObsolete).toBe(false);
  });

  it('handles items with unknown parts gracefully', () => {
    const items = [
      { partNumber: 'XYZZY-123', manufacturer: 'Acme' },
      { partNumber: '', manufacturer: '' },
    ];
    const result = computeLifecycleWarnings(items);
    expect(result.total).toBe(0);
  });

  it('handles null-like partNumber gracefully', () => {
    // classifyLifecycle returns 'unknown' for empty string
    const result = computeLifecycleWarnings([{ partNumber: '', manufacturer: '' }]);
    expect(result.total).toBe(0);
  });
});
