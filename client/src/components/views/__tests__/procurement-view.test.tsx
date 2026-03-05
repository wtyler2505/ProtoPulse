import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { detectEsdSensitivity, detectAssemblyCategory, ASSEMBLY_CATEGORY_INFO } from '../procurement/bom-utils';
import { BomToolbar } from '../procurement/BomToolbar';
import { BomSettings } from '../procurement/BomSettings';
import { CostSummary } from '../procurement/CostSummary';
import { AssemblyGroups } from '../procurement/AssemblyGroups';
import { BomCards } from '../procurement/BomCards';
import { AlternatePartsPanel } from '../procurement/AlternatePartsPanel';
import { SupplierPricingPanel } from '../procurement/SupplierPricingPanel';
import { DamageAssessmentPanel } from '../procurement/DamageAssessmentPanel';
import { AddItemDialog } from '../procurement/AddItemDialog';
import { ComponentReference } from '../procurement/ComponentReference';
import { BomEmptyState } from '../procurement/BomEmptyState';
import type { EnrichedBomItem } from '../procurement/types';
import type { CostBreakdown } from '../procurement/CostSummary';
import type { BomItem } from '@/lib/project-context';

// ── Mock dependencies ──

vi.mock('@/lib/damage-assessment', () => ({
  DamageAssessor: vi.fn().mockImplementation(() => ({
    getIndicators: () => [{ indicator: 'Burnt marks', category: 'visual', defaultSeverity: 'severe' }],
  })),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/constants', () => ({
  STORAGE_KEYS: { OPTIMIZATION_GOAL: 'opt_goal', PREFERRED_SUPPLIERS: 'pref_sup', BOM_SORT_ORDER: 'sort_order' },
  DEFAULT_PREFERRED_SUPPLIERS: { 'Digi-Key': true, Mouser: true, LCSC: false },
  OPTIMIZATION_GOALS: { Cost: 'Minimize cost', Power: 'Minimize power', Size: 'Minimize size', Avail: 'Best availability' } as Record<string, string>,
  getSupplierSearchUrl: (s: string) => s === 'Digi-Key' ? 'https://digikey.com/search?q=' : null,
}));

// ── Test data factories ──

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'STM32F407',
    manufacturer: 'STMicro',
    description: 'MCU ARM Cortex-M4',
    quantity: 2,
    unitPrice: '5.50',
    totalPrice: '11.00',
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    esdSensitive: null,
    assemblyCategory: null,
    ...overrides,
  } as BomItem;
}

function makeEnrichedItem(overrides: Partial<EnrichedBomItem> = {}): EnrichedBomItem {
  return { ...makeBomItem(), _isEsd: true, _assemblyCategory: 'smt', ...overrides } as EnrichedBomItem;
}

function makeCostBreakdown(): CostBreakdown {
  return {
    statusCategories: {
      'In Stock': { total: 11, count: 1, color: 'bg-emerald-500' },
      'Low Stock': { total: 0, count: 0, color: 'bg-yellow-500' },
      'Out of Stock': { total: 0, count: 0, color: 'bg-destructive' },
      'On Order': { total: 0, count: 0, color: 'bg-blue-500' },
    },
    avgUnitCost: 5.5,
    totalBomCost: 11,
    topItems: [makeBomItem()],
    maxItemCost: 11,
  };
}

const noop = vi.fn();
const mockToast = vi.fn() as ReturnType<typeof import('@/hooks/use-toast').useToast>['toast'];

// ── Tests: bom-utils ──

describe('detectEsdSensitivity', () => {
  it('detects MCU as ESD sensitive', () => {
    expect(detectEsdSensitivity('MCU ARM Cortex-M4', 'STM32F407')).toBe(true);
  });

  it('detects ESP32 as ESD sensitive', () => {
    expect(detectEsdSensitivity('WiFi module', 'ESP32-WROOM')).toBe(true);
  });

  it('does not flag a resistor', () => {
    expect(detectEsdSensitivity('10k resistor', 'RC0805')).toBe(false);
  });

  it('detects MOSFET as ESD sensitive', () => {
    expect(detectEsdSensitivity('N-channel MOSFET', 'IRF540N')).toBe(true);
  });
});

describe('detectAssemblyCategory', () => {
  it('detects SMT from package code', () => {
    expect(detectAssemblyCategory('capacitor 0805', '')).toBe('smt');
  });

  it('detects through-hole from DIP', () => {
    expect(detectAssemblyCategory('DIP-8 package', '')).toBe('through_hole');
  });

  it('detects hand-solder from connector', () => {
    expect(detectAssemblyCategory('JST connector 2-pin', '')).toBe('hand_solder');
  });

  it('detects mechanical from standoff', () => {
    expect(detectAssemblyCategory('M3 standoff', '')).toBe('mechanical');
  });

  it('returns null for unknown', () => {
    expect(detectAssemblyCategory('generic part', '')).toBeNull();
  });
});

describe('ASSEMBLY_CATEGORY_INFO', () => {
  it('has all 5 categories', () => {
    expect(Object.keys(ASSEMBLY_CATEGORY_INFO)).toHaveLength(5);
    expect(ASSEMBLY_CATEGORY_INFO.smt.label).toContain('SMT');
    expect(ASSEMBLY_CATEGORY_INFO.unassigned.label).toBe('Unassigned');
  });
});

// ── Tests: sub-components ──

describe('BomToolbar', () => {
  it('renders search input and buttons', () => {
    render(<BomToolbar searchTerm="" onSearchChange={noop} showSettings={false} onToggleSettings={noop} esdFilterOnly={false} onToggleEsdFilter={noop} esdCount={3} showAssemblyGroups={false} onToggleAssemblyGroups={noop} onAddItem={noop} totalCost={42.5} onExportCSV={noop} />);
    expect(screen.getByTestId('input-search-bom')).toBeDefined();
    expect(screen.getByTestId('button-export-csv')).toBeDefined();
    expect(screen.getByTestId('text-total-cost')).toBeDefined();
  });

  it('displays total cost', () => {
    render(<BomToolbar searchTerm="" onSearchChange={noop} showSettings={false} onToggleSettings={noop} esdFilterOnly={false} onToggleEsdFilter={noop} esdCount={0} showAssemblyGroups={false} onToggleAssemblyGroups={noop} onAddItem={noop} totalCost={123.45} onExportCSV={noop} />);
    expect(screen.getByTestId('text-total-cost').textContent).toContain('123.45');
  });
});

describe('BomSettings', () => {
  it('renders optimization goals', () => {
    render(<BomSettings bomSettings={{ batchSize: 1000, maxCost: 50, inStockOnly: false }} onBomSettingsChange={noop} optimizationGoal="Cost" onOptimizationGoalChange={noop} preferredSuppliers={{ 'Digi-Key': true }} onPreferredSuppliersChange={noop} showSupplierEdit={false} onToggleSupplierEdit={noop} />);
    expect(screen.getByTestId('panel-settings')).toBeDefined();
    expect(screen.getByTestId('button-goal-cost')).toBeDefined();
  });
});

describe('CostSummary', () => {
  it('renders cost cards', () => {
    render(<CostSummary costBreakdown={makeCostBreakdown()} />);
    expect(screen.getByTestId('card-total-bom-cost')).toBeDefined();
    expect(screen.getByTestId('card-avg-unit-cost')).toBeDefined();
    expect(screen.getByTestId('text-summary-total-cost').textContent).toContain('11.00');
  });
});

describe('AssemblyGroups', () => {
  it('renders groups with items', () => {
    const groups = { smt: [makeEnrichedItem()], through_hole: [], hand_solder: [], mechanical: [], unassigned: [] };
    render(<AssemblyGroups assemblyGroups={groups} />);
    expect(screen.getByTestId('assembly-group-smt')).toBeDefined();
    expect(screen.getByTestId('assembly-group-label-smt').textContent).toContain('SMT');
  });

  it('skips empty groups', () => {
    const groups = { smt: [], through_hole: [], hand_solder: [], mechanical: [], unassigned: [] };
    render(<AssemblyGroups assemblyGroups={groups} />);
    expect(screen.queryByTestId('assembly-group-smt')).toBeNull();
  });
});

describe('BomCards', () => {
  it('renders mobile card layout', () => {
    render(<BomCards filteredBom={[makeEnrichedItem()]} deleteBomItem={noop} toast={mockToast} />);
    expect(screen.getByTestId('card-bom-1')).toBeDefined();
  });

  it('shows ESD badge for ESD-sensitive items', () => {
    render(<BomCards filteredBom={[makeEnrichedItem({ _isEsd: true })]} deleteBomItem={noop} toast={mockToast} />);
    expect(screen.getByTestId('esd-badge-card-1')).toBeDefined();
  });
});

describe('AlternatePartsPanel', () => {
  it('renders search bar', () => {
    render(<AlternatePartsPanel bom={[]} altSearchPartNumber="" onAltSearchChange={noop} altResults={[]} altSearching={false} onFindAlternates={noop} />);
    expect(screen.getByTestId('input-alternate-search')).toBeDefined();
    expect(screen.getByTestId('button-find-alternates')).toBeDefined();
  });

  it('renders BOM quick-search buttons', () => {
    render(<AlternatePartsPanel bom={[makeBomItem()]} altSearchPartNumber="" onAltSearchChange={noop} altResults={[]} altSearching={false} onFindAlternates={noop} />);
    expect(screen.getByTestId('button-alt-bom-1')).toBeDefined();
  });

  it('shows empty state when no results', () => {
    render(<AlternatePartsPanel bom={[]} altSearchPartNumber="XYZ" onAltSearchChange={noop} altResults={[]} altSearching={false} onFindAlternates={noop} />);
    expect(screen.getByTestId('alternates-empty-state')).toBeDefined();
  });
});

describe('SupplierPricingPanel', () => {
  it('renders quote button and search', () => {
    render(<SupplierPricingPanel bom={[makeBomItem()]} bomQuote={null} pricingSearching={false} pricingPartMpn="" onPricingPartMpnChange={noop} onQuoteBom={noop} onSearchPartPricing={noop} distributors={[{ distributorId: 'dk', name: 'Digi-Key', enabled: true }]} currency="USD" />);
    expect(screen.getByTestId('button-quote-bom')).toBeDefined();
    expect(screen.getByTestId('input-pricing-search')).toBeDefined();
    expect(screen.getByTestId('distributor-card-dk')).toBeDefined();
  });

  it('shows empty state when no quote', () => {
    render(<SupplierPricingPanel bom={[]} bomQuote={null} pricingSearching={false} pricingPartMpn="" onPricingPartMpnChange={noop} onQuoteBom={noop} onSearchPartPricing={noop} distributors={[]} currency="USD" />);
    expect(screen.getByTestId('pricing-empty-state')).toBeDefined();
  });
});

describe('DamageAssessmentPanel', () => {
  it('renders dialog when item provided', () => {
    render(<DamageAssessmentPanel damageDialogItem={makeBomItem()} onClose={noop} damageComponentType="generic" onComponentTypeChange={noop} damageObservations={[]} onObservationsChange={noop} currentDamageReport={null} onRunAssessment={noop} />);
    expect(screen.getByTestId('dialog-damage-assessment')).toBeDefined();
    expect(screen.getByTestId('select-damage-type')).toBeDefined();
    expect(screen.getByTestId('button-run-assessment')).toBeDefined();
  });
});

describe('AddItemDialog', () => {
  it('renders form fields when open', () => {
    render(<AddItemDialog open={true} onOpenChange={noop} newItem={{ partNumber: '', manufacturer: '', description: '', quantity: 1, unitPrice: 0, supplier: 'Digi-Key' }} onNewItemChange={noop} onAddItem={noop} />);
    expect(screen.getByTestId('dialog-add-bom-item')).toBeDefined();
    expect(screen.getByTestId('input-add-part-number')).toBeDefined();
    expect(screen.getByTestId('button-confirm-add-item')).toBeDefined();
  });
});

describe('ComponentReference', () => {
  it('renders toggle button', () => {
    render(<ComponentReference showComponentRef={false} onToggleComponentRef={noop} componentParts={[]} partsLoading={false} />);
    expect(screen.getByTestId('button-toggle-component-ref')).toBeDefined();
  });

  it('shows parts table when expanded', () => {
    render(<ComponentReference showComponentRef={true} onToggleComponentRef={noop} componentParts={[{ id: 1, meta: { title: 'Test', manufacturer: 'Mfr', mpn: 'MPN1', packageType: 'QFP', mountingType: 'SMD', description: 'desc' } }]} partsLoading={false} />);
    expect(screen.getByTestId('table-component-parts')).toBeDefined();
    expect(screen.getByTestId('text-part-title-1').textContent).toBe('Test');
  });

  it('shows loading state', () => {
    render(<ComponentReference showComponentRef={true} onToggleComponentRef={noop} componentParts={undefined} partsLoading={true} />);
    expect(screen.getByText('Loading component parts...')).toBeDefined();
  });
});

describe('BomEmptyState', () => {
  it('shows search-clear prompt when searching', () => {
    render(<BomEmptyState searchTerm="xyz" onClearSearch={noop} onAddItem={noop} />);
    expect(screen.getByTestId('button-clear-search')).toBeDefined();
  });

  it('shows add-first-item prompt when empty', () => {
    render(<BomEmptyState searchTerm="" onClearSearch={noop} onAddItem={noop} />);
    expect(screen.getByTestId('button-add-first-item')).toBeDefined();
  });
});
